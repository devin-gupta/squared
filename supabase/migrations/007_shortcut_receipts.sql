-- Revocable, trip-scoped credentials for opt-in iOS Shortcut receipt entry.
-- Raw credentials are never stored. The service role can exchange a hash for
-- the minimum member context needed to process and atomically save a receipt.
BEGIN;

CREATE TABLE IF NOT EXISTS public.shortcut_receipt_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '180 days',
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  rate_window_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rate_count INTEGER NOT NULL DEFAULT 0 CHECK(rate_count BETWEEN 0 AND 20),
  UNIQUE(user_id, trip_id)
);
ALTER TABLE public.shortcut_receipt_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shortcut_receipt_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.shortcut_receipt_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.claim_shortcut_receipt(
  presented_hash TEXT,
  operation_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  credential shortcut_receipt_tokens%ROWTYPE;
  payer trip_members%ROWTYPE;
  previous expense_changes%ROWTYPE;
BEGIN
  IF presented_hash !~ '^[0-9a-f]{64}$' OR operation_id IS NULL THEN
    RAISE EXCEPTION 'Invalid shortcut request' USING ERRCODE='42501';
  END IF;
  SELECT * INTO credential FROM shortcut_receipt_tokens
   WHERE token_hash=presented_hash AND revoked_at IS NULL AND expires_at>now()
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This shortcut upload key is invalid or expired' USING ERRCODE='42501';
  END IF;
  SELECT * INTO payer FROM trip_members
   WHERE trip_id=credential.trip_id AND user_id=credential.user_id
   ORDER BY joined_at LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This shortcut is no longer connected to that trip' USING ERRCODE='42501';
  END IF;
  SELECT * INTO previous FROM expense_changes WHERE id=operation_id;
  IF FOUND THEN
    IF previous.actor_id IS DISTINCT FROM credential.user_id OR previous.trip_id IS DISTINCT FROM credential.trip_id THEN
      RAISE EXCEPTION 'This receipt request was already used' USING ERRCODE='40001';
    END IF;
    RETURN jsonb_build_object(
      'existing', true,
      'userId', credential.user_id,
      'tripId', credential.trip_id,
      'payerId', payer.id,
      'payerName', payer.display_name,
      'result', jsonb_build_object(
        'transactionId', previous.expense_id,
        'changeId', previous.id,
        'description', COALESCE(previous.after_state,previous.before_state)->'expense'->>'description',
        'totalAmount', COALESCE(previous.after_state,previous.before_state)->'expense'->'total_amount'
      )
    );
  END IF;
  IF credential.rate_window_at <= now() - interval '1 hour' THEN
    UPDATE shortcut_receipt_tokens SET rate_window_at=now(), rate_count=1 WHERE id=credential.id;
  ELSIF credential.rate_count >= 20 THEN
    RAISE EXCEPTION 'This shortcut has reached its hourly receipt limit' USING ERRCODE='22023';
  ELSE
    UPDATE shortcut_receipt_tokens SET rate_count=rate_count+1 WHERE id=credential.id;
  END IF;
  RETURN jsonb_build_object(
    'existing', false,
    'userId', credential.user_id,
    'tripId', credential.trip_id,
    'payerId', payer.id,
    'payerName', payer.display_name,
    'memberNames', COALESCE((
      SELECT jsonb_agg(display_name ORDER BY joined_at)
      FROM trip_members WHERE trip_id=credential.trip_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_shortcut_receipt(
  presented_hash TEXT,
  operation_id UUID,
  payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  credential shortcut_receipt_tokens%ROWTYPE;
  result JSONB;
BEGIN
  IF presented_hash !~ '^[0-9a-f]{64}$' OR operation_id IS NULL THEN
    RAISE EXCEPTION 'Invalid shortcut request' USING ERRCODE='42501';
  END IF;
  SELECT * INTO credential FROM shortcut_receipt_tokens
   WHERE token_hash=presented_hash AND revoked_at IS NULL AND expires_at>now()
   FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(
    SELECT 1 FROM trip_members WHERE trip_id=credential.trip_id AND user_id=credential.user_id
  ) THEN
    RAISE EXCEPTION 'This shortcut upload key is invalid or expired' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', credential.user_id::text, true);
  result := commit_expense(operation_id, 'create', credential.trip_id, NULL, payload, NULL, NULL);
  UPDATE shortcut_receipt_tokens SET last_used_at=now() WHERE id=credential.id;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_shortcut_receipt(TEXT,UUID), public.commit_shortcut_receipt(TEXT,UUID,JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_shortcut_receipt(TEXT,UUID), public.commit_shortcut_receipt(TEXT,UUID,JSONB)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
