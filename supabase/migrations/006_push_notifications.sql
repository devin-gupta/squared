-- Opt-in, per-device Web Push. Apply after 005. No existing trip data changes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 endpoint TEXT NOT NULL UNIQUE CHECK(length(endpoint) BETWEEN 20 AND 2048),
 p256dh TEXT NOT NULL CHECK(length(p256dh)=87),
 auth TEXT NOT NULL CHECK(length(auth)=22),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '90 days'
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
CREATE POLICY "Read own push devices" ON public.push_subscriptions FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "Remove own push devices" ON public.push_subscriptions FOR DELETE TO authenticated USING(user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.register_push_subscription(push_endpoint TEXT, push_p256dh TEXT, push_auth TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE device UUID;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to enable notifications' USING ERRCODE='42501'; END IF;
 IF push_endpoint IS NULL OR length(push_endpoint) NOT BETWEEN 20 AND 2048 OR push_endpoint !~ '^https://'
 OR push_p256dh IS NULL OR push_p256dh !~ '^[A-Za-z0-9_-]{87}$'
 OR push_auth IS NULL OR push_auth !~ '^[A-Za-z0-9_-]{22}$' THEN
  RAISE EXCEPTION 'Invalid push subscription' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,6));
 DELETE FROM push_subscriptions WHERE user_id=auth.uid() AND expires_at<now();
 IF (SELECT count(*) FROM push_subscriptions WHERE user_id=auth.uid())>=5
 AND NOT EXISTS(SELECT 1 FROM push_subscriptions WHERE user_id=auth.uid() AND endpoint=push_endpoint) THEN
  RAISE EXCEPTION 'Notifications are already enabled on five devices. Disable one first.' USING ERRCODE='22023'; END IF;
 -- Possession of the existing subscription's keys is needed to rebind a shared
 -- browser to a different signed-in account. Other accounts cannot read these keys.
 INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth) VALUES(auth.uid(),push_endpoint,push_p256dh,push_auth)
 ON CONFLICT(endpoint) DO UPDATE SET user_id=auth.uid(),updated_at=now(),expires_at=now()+interval '90 days'
 WHERE push_subscriptions.p256dh=excluded.p256dh AND push_subscriptions.auth=excluded.auth
 RETURNING id INTO device;
 IF device IS NULL THEN RAISE EXCEPTION 'Disable notifications on this device and enable them again.' USING ERRCODE='22023'; END IF;
 RETURN device;
END $$;
REVOKE ALL ON FUNCTION public.register_push_subscription(TEXT,TEXT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(TEXT,TEXT,TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS public.push_deliveries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 change_id UUID NOT NULL REFERENCES public.expense_changes(id) ON DELETE CASCADE,
 subscription_id UUID NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
 recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','failed','discarded')),
 attempts INTEGER NOT NULL DEFAULT 0,
 not_before TIMESTAMPTZ NOT NULL DEFAULT now(),
 lease_token UUID,
 lease_until TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(change_id,subscription_id)
);
CREATE INDEX IF NOT EXISTS push_deliveries_pending ON public.push_deliveries(not_before) WHERE state IN ('pending','sending');
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_deliveries FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.push_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.queue_expense_push() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.command='create' THEN
  INSERT INTO push_deliveries(change_id,subscription_id,recipient_id)
  SELECT NEW.id,s.id,s.user_id FROM push_subscriptions s
  WHERE s.user_id IS DISTINCT FROM NEW.actor_id AND s.expires_at>now()
  AND EXISTS(SELECT 1 FROM trip_members m WHERE m.trip_id=NEW.trip_id AND m.user_id=s.user_id)
  ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.queue_expense_push() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER queue_expense_push AFTER INSERT ON public.expense_changes FOR EACH ROW EXECUTE FUNCTION public.queue_expense_push();

CREATE OR REPLACE FUNCTION public.claim_push_deliveries(batch_size INTEGER DEFAULT 20, requested_actor UUID DEFAULT NULL)
RETURNS TABLE(job_id UUID,device_id UUID,recipient UUID,token UUID,attempt INTEGER,endpoint TEXT,p256dh TEXT,auth TEXT,trip_id UUID,change_id UUID,actor_name TEXT,trip_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 -- Access is restricted to the server-only service role. Never expose delivery
 -- endpoints or encryption keys to expense authors or other trip members.
 UPDATE push_deliveries d SET state='discarded',lease_token=NULL,lease_until=NULL
 WHERE d.state IN ('pending','sending') AND (d.created_at<now()-interval '24 hours' OR NOT EXISTS(
  SELECT 1 FROM push_subscriptions s JOIN expense_changes c ON c.id=d.change_id
  WHERE s.id=d.subscription_id AND s.user_id=d.recipient_id AND s.expires_at>now()
  AND EXISTS(SELECT 1 FROM trip_members m WHERE m.trip_id=c.trip_id AND m.user_id=d.recipient_id)
  AND EXISTS(SELECT 1 FROM transactions t WHERE t.id=c.expense_id)
 ));
 RETURN QUERY
 WITH candidates AS (
  SELECT d.id FROM push_deliveries d JOIN expense_changes c ON c.id=d.change_id
  WHERE (requested_actor IS NULL OR c.actor_id=requested_actor)
  AND d.attempts<4 AND d.not_before<=now()
  AND (d.state='pending' OR (d.state='sending' AND d.lease_until<now()))
  ORDER BY d.created_at LIMIT least(greatest(batch_size,1),20) FOR UPDATE OF d SKIP LOCKED
 ), claimed AS (
  UPDATE push_deliveries d SET state='sending',attempts=d.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds'
  FROM candidates WHERE d.id=candidates.id RETURNING d.*
 )
 SELECT d.id,s.id,d.recipient_id,d.lease_token,d.attempts,s.endpoint,s.p256dh,s.auth,c.trip_id,c.id,c.actor_name,t.name
 FROM claimed d JOIN push_subscriptions s ON s.id=d.subscription_id
 JOIN expense_changes c ON c.id=d.change_id JOIN trips t ON t.id=c.trip_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_push_deliveries(INTEGER,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_deliveries(INTEGER,UUID) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
