-- Shared invitations, atomic name claiming, and organizer-managed placeholder names.
-- Apply after 004. No existing members, expenses or balances are reassigned.
BEGIN;

CREATE OR REPLACE FUNCTION public.invite_context(invitation TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t trips%ROWTYPE; existing trip_members%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to join this trip' USING ERRCODE='42501'; END IF;
  SELECT * INTO t FROM trips WHERE invite_code = upper(trim(invitation));
  IF NOT FOUND THEN RAISE EXCEPTION 'This invite is no longer available' USING ERRCODE='22023'; END IF;
  SELECT * INTO existing FROM trip_members WHERE trip_id=t.id AND user_id=auth.uid() ORDER BY joined_at LIMIT 1;
  RETURN jsonb_build_object('tripId',t.id,'tripName',t.name,'memberId',existing.id,'members',
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',display_name) ORDER BY joined_at)
      FROM trip_members WHERE trip_id=t.id AND user_id IS NULL AND display_name<>t.created_by),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.join_invited_trip(invitation TEXT, selected_member UUID DEFAULT NULL, new_name TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t trips%ROWTYPE; member_id UUID; chosen_name TEXT := trim(new_name);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to join this trip' USING ERRCODE='42501'; END IF;
  -- Serialize joining/claiming within a trip. Repeated calls reuse membership.
  SELECT * INTO t FROM trips WHERE invite_code=upper(trim(invitation)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This invite is no longer available' USING ERRCODE='22023'; END IF;
  SELECT id INTO member_id FROM trip_members WHERE trip_id=t.id AND user_id=auth.uid() ORDER BY joined_at LIMIT 1;
  IF member_id IS NOT NULL THEN RETURN t.id; END IF;
  IF selected_member IS NOT NULL THEN
    UPDATE trip_members SET user_id=auth.uid() WHERE id=selected_member AND trip_id=t.id AND user_id IS NULL AND display_name<>t.created_by
      RETURNING id INTO member_id;
    IF member_id IS NULL THEN RAISE EXCEPTION 'That name has already been claimed. Choose another name or add yourself.' USING ERRCODE='40001'; END IF;
  ELSE
    IF chosen_name IS NULL OR length(chosen_name) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Enter a name up to 80 characters' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM trip_members WHERE trip_id=t.id AND lower(display_name)=lower(chosen_name)) THEN
      RAISE EXCEPTION 'That name is already on this trip. Select it above if it is you, or use a distinct name.' USING ERRCODE='22023';
    END IF;
    INSERT INTO trip_members(trip_id,display_name,user_id) VALUES(t.id,chosen_name,auth.uid());
  END IF;
  RETURN t.id;
END $$;

CREATE OR REPLACE FUNCTION public.add_trip_names(selected_trip UUID, names JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE person TEXT; added JSONB := '[]'; m trip_members%ROWTYPE;
BEGIN
  PERFORM 1 FROM trips WHERE id=selected_trip FOR UPDATE;
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM trips t JOIN trip_members tm ON tm.trip_id=t.id
    WHERE t.id=selected_trip AND tm.user_id=auth.uid() AND tm.display_name=t.created_by) THEN
    RAISE EXCEPTION 'Only the organizer can add names in advance' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(names)<>'array' OR jsonb_array_length(names)>50 THEN RAISE EXCEPTION 'Add up to 50 names at a time' USING ERRCODE='22023'; END IF;
  FOR person IN SELECT trim(value) FROM jsonb_array_elements_text(names) LOOP
    IF length(person) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Use names from 1 to 80 characters' USING ERRCODE='22023'; END IF;
    SELECT * INTO m FROM trip_members WHERE trip_id=selected_trip AND lower(display_name)=lower(person) ORDER BY joined_at LIMIT 1;
    IF NOT FOUND THEN INSERT INTO trip_members(trip_id,display_name) VALUES(selected_trip,person) RETURNING * INTO m; END IF;
    added := added || jsonb_build_array(jsonb_build_object('id',m.id,'display_name',m.display_name));
  END LOOP;
  RETURN added;
END $$;

CREATE OR REPLACE FUNCTION public.start_group_trip(trip_name TEXT, your_name TEXT, names JSONB DEFAULT '[]', request_id UUID DEFAULT gen_random_uuid())
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t trips%ROWTYPE; code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to create a trip' USING ERRCODE='42501'; END IF;
  IF length(trim(trip_name)) NOT BETWEEN 1 AND 120 OR length(trim(your_name)) NOT BETWEEN 1 AND 80 OR trip_name IS NULL OR your_name IS NULL OR request_id IS NULL THEN
    RAISE EXCEPTION 'Enter a trip name and your name' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(request_id::text,0));
  SELECT * INTO t FROM trips WHERE id=request_id;
  IF FOUND THEN
    IF NOT EXISTS(SELECT 1 FROM trip_members WHERE trip_id=t.id AND user_id=auth.uid() AND display_name=t.created_by) THEN
      RAISE EXCEPTION 'Trip request already used' USING ERRCODE='42501';
    END IF;
    RETURN jsonb_build_object('tripId',t.id,'inviteCode',t.invite_code);
  END IF;
  code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  INSERT INTO trips(id,name,invite_code,created_by) VALUES(request_id,trim(trip_name),code,trim(your_name)) RETURNING * INTO t;
  INSERT INTO trip_members(trip_id,display_name,user_id) VALUES(t.id,trim(your_name),auth.uid());
  PERFORM add_trip_names(t.id,names);
  RETURN jsonb_build_object('tripId',t.id,'inviteCode',t.invite_code);
END $$;

REVOKE ALL ON FUNCTION public.invite_context(TEXT), public.join_invited_trip(TEXT,UUID,TEXT), public.add_trip_names(UUID,JSONB), public.start_group_trip(TEXT,TEXT,JSONB,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_context(TEXT), public.join_invited_trip(TEXT,UUID,TEXT), public.add_trip_names(UUID,JSONB), public.start_group_trip(TEXT,TEXT,JSONB,UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';


-- Atomic expense writes, idempotency, optimistic concurrency, and undo history.
-- Historical rows remain unchanged except for an initial version number.

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.expense_changes (
  id UUID PRIMARY KEY,
  sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL,
  actor_id UUID,
  actor_name TEXT NOT NULL,
  command TEXT NOT NULL CHECK(command IN ('create','update','delete','undo')),
  request JSONB NOT NULL,
  before_state JSONB,
  after_state JSONB,
  undo_of UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS expense_changes_trip_time ON public.expense_changes(trip_id,created_at DESC);
ALTER TABLE public.expense_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.expense_changes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.expense_changes TO authenticated;
DROP POLICY IF EXISTS "Members can read expense history" ON public.expense_changes;
CREATE POLICY "Members can read expense history" ON public.expense_changes FOR SELECT TO authenticated
  USING(EXISTS(SELECT 1 FROM public.trip_members WHERE trip_id=expense_changes.trip_id AND user_id=auth.uid()));

CREATE OR REPLACE FUNCTION public.bump_expense_version() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.version:=OLD.version+1; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS expense_version ON public.transactions;
CREATE TRIGGER expense_version BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.bump_expense_version();

CREATE OR REPLACE FUNCTION public.expense_snapshot(expense_id UUID) RETURNS JSONB LANGUAGE sql SET search_path=public AS $$
 SELECT jsonb_build_object('expense',to_jsonb(t),'shares',COALESCE((SELECT jsonb_agg(jsonb_build_object('member_id',a.member_id,'amount',a.amount) ORDER BY a.member_id)
   FROM transaction_adjustments a WHERE a.transaction_id=t.id),'[]'::jsonb)) FROM transactions t WHERE t.id=expense_id;
$$;
REVOKE ALL ON FUNCTION public.expense_snapshot(UUID) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.commit_expense(
 operation_id UUID, command TEXT, selected_trip UUID, selected_expense UUID DEFAULT NULL,
 payload JSONB DEFAULT '{}', expected_version BIGINT DEFAULT NULL, undo_change UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 actor TEXT; previous expense_changes%ROWTYPE; target expense_changes%ROWTYPE;
 current_state JSONB; before_state JSONB; after_state JSONB; desired JSONB; shares JSONB;
 exp transactions%ROWTYPE; eid UUID:=selected_expense; req JSONB; conv JSONB;
 amount NUMERIC; split TEXT; item JSONB; latest UUID;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM trip_members WHERE trip_id=selected_trip AND user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Join this trip before changing expenses' USING ERRCODE='42501'; END IF;
 IF operation_id IS NULL OR command NOT IN ('create','update','delete','undo') THEN RAISE EXCEPTION 'Invalid save request' USING ERRCODE='22023'; END IF;
 SELECT display_name INTO actor FROM trip_members WHERE trip_id=selected_trip AND user_id=auth.uid() ORDER BY joined_at LIMIT 1;
 req:=jsonb_build_object('command',command,'trip',selected_trip,'expense',selected_expense,'payload',payload,'version',expected_version,'undo',undo_change);
 -- Same key in another tab/request cannot race the first save.
 PERFORM pg_advisory_xact_lock(hashtextextended(operation_id::text,0));
 SELECT * INTO previous FROM expense_changes WHERE id=operation_id;
 IF FOUND THEN
  IF previous.actor_id IS DISTINCT FROM auth.uid() OR previous.request<>req THEN
   RAISE EXCEPTION 'This save request was already used. Reopen the expense before making another change.' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('transactionId',previous.expense_id,'changeId',previous.id,'description',COALESCE(previous.after_state,previous.before_state)->'expense'->>'description',
    'totalAmount',COALESCE(previous.after_state,previous.before_state)->'expense'->'total_amount','version',previous.after_state->'expense'->'version');
 END IF;
 IF command='undo' THEN
  SELECT * INTO target FROM expense_changes WHERE id=undo_change AND trip_id=selected_trip;
  IF NOT FOUND OR target.actor_id IS DISTINCT FROM auth.uid() OR target.command='undo' THEN RAISE EXCEPTION 'Only your own changes can be undone' USING ERRCODE='42501'; END IF;
  eid:=target.expense_id;
 END IF;
 IF command='create' THEN eid:=operation_id; END IF;
 IF eid IS NULL THEN RAISE EXCEPTION 'Choose an expense' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(eid::text,1));
 SELECT * INTO exp FROM transactions WHERE id=eid FOR UPDATE;
 IF FOUND AND exp.trip_id<>selected_trip THEN RAISE EXCEPTION 'Expense is not in this trip' USING ERRCODE='42501'; END IF;
 current_state:=expense_snapshot(eid); before_state:=current_state;
 IF command IN ('update','delete') THEN
  IF current_state IS NULL OR expected_version IS NULL OR exp.version<>expected_version THEN
   RAISE EXCEPTION 'This expense changed or was removed. Reopen it to see the latest details.' USING ERRCODE='40001'; END IF;
 END IF;
 IF command='create' AND current_state IS NOT NULL THEN RAISE EXCEPTION 'Expense already exists' USING ERRCODE='40001'; END IF;
 IF command='undo' THEN
  SELECT id INTO latest FROM expense_changes WHERE expense_id=eid AND trip_id=selected_trip ORDER BY sequence DESC LIMIT 1;
  IF latest<>target.id OR current_state IS DISTINCT FROM target.after_state THEN
   RAISE EXCEPTION 'Someone changed this expense since then. Reopen it instead of undoing.' USING ERRCODE='40001'; END IF;
  IF target.before_state IS NULL THEN
   DELETE FROM transactions WHERE id=eid;
  ELSE
   desired:=target.before_state->'expense'; shares:=target.before_state->'shares';
   -- Restoring a deleted expense preserves its IDs and original currency evidence.
   -- Existing foreign keys prevent restoring references to removed members.
   IF current_state IS NULL THEN
    INSERT INTO transactions(id,trip_id,description,total_amount,payer_id,split_type,receipt_url,line_items,category,currency_conversion,status,created_at,version)
    VALUES(eid,selected_trip,desired->>'description',(desired->>'total_amount')::numeric,(desired->>'payer_id')::uuid,desired->>'split_type',desired->>'receipt_url',
      NULLIF(desired->'line_items','null'::jsonb),desired->>'category',NULLIF(desired->'currency_conversion','null'::jsonb),desired->>'status',(desired->>'created_at')::timestamptz,(desired->>'version')::bigint+1);
   ELSE
    UPDATE transactions SET description=desired->>'description',total_amount=(desired->>'total_amount')::numeric,payer_id=(desired->>'payer_id')::uuid,
      split_type=desired->>'split_type',receipt_url=desired->>'receipt_url',line_items=NULLIF(desired->'line_items','null'::jsonb),category=desired->>'category',
      currency_conversion=NULLIF(desired->'currency_conversion','null'::jsonb),status=desired->>'status' WHERE id=eid;
   END IF;
   DELETE FROM transaction_adjustments WHERE transaction_id=eid;
   INSERT INTO transaction_adjustments(transaction_id,member_id,amount)
    SELECT eid,(value->>'member_id')::uuid,(value->>'amount')::numeric FROM jsonb_array_elements(shares);
  END IF;
 ELSIF command='delete' THEN
  DELETE FROM transactions WHERE id=eid;
 ELSE
  desired:=COALESCE(current_state->'expense','{}'::jsonb)||payload;
  shares:=COALESCE(payload->'shares',current_state->'shares','[]'::jsonb);
  amount:=(desired->>'total_amount')::numeric; split:=COALESCE(desired->>'split_type','equal');
  IF amount IS NULL OR amount<=0 OR amount>=100000000 OR amount<>round(amount,2)
    OR length(trim(COALESCE(desired->>'description',''))) NOT BETWEEN 1 AND 1000 OR split NOT IN ('equal','custom') THEN
   RAISE EXCEPTION 'Check the expense description, amount and split' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM trip_members WHERE id=(desired->>'payer_id')::uuid AND trip_id=selected_trip) THEN
   RAISE EXCEPTION 'Choose a payer in this trip' USING ERRCODE='22023'; END IF;
  -- Changing the ledger total invalidates its original conversion evidence.
  IF command='update' AND amount<>exp.total_amount THEN desired:=desired||'{"currency_conversion":null}'::jsonb; END IF;
  conv:=NULLIF(desired->'currency_conversion','null'::jsonb);
  IF conv IS NOT NULL AND (jsonb_typeof(conv)<>'object' OR COALESCE(conv->>'original_currency','') !~ '^[A-Z]{3}$'
    OR conv->>'original_currency'='USD' OR COALESCE((conv->>'original_amount')::numeric,0)<=0 OR COALESCE((conv->>'rate')::numeric,0)<=0
    OR COALESCE(conv->>'provider','')<>'Frankfurter' OR COALESCE(conv->>'rate_date','') !~ '^\d{4}-\d{2}-\d{2}$'
    OR amount<>round((conv->>'original_amount')::numeric*(conv->>'rate')::numeric,2)) THEN
   RAISE EXCEPTION 'Invalid currency conversion' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(shares)<>'array' OR jsonb_array_length(shares)>100 THEN RAISE EXCEPTION 'Invalid shares' USING ERRCODE='22023'; END IF;
  -- Validate allocations when they are created or changed. A metadata-only edit
  -- can still fix an old expense whose legacy allocations need separate review.
  IF command='create' OR payload ?| ARRAY['total_amount','split_type','shares','line_items'] THEN
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(shares) s WHERE (s->>'amount')::numeric IS NULL OR (s->>'amount')::numeric<0
     OR (s->>'amount')::numeric<>round((s->>'amount')::numeric,2)
     OR NOT EXISTS(SELECT 1 FROM trip_members WHERE id=(s->>'member_id')::uuid AND trip_id=selected_trip))
     OR (SELECT count(*)<>count(DISTINCT value->>'member_id') FROM jsonb_array_elements(shares)) THEN
    RAISE EXCEPTION 'Choose valid trip members and nonnegative shares' USING ERRCODE='22023'; END IF;
   IF NULLIF(desired->'line_items','null'::jsonb) IS NOT NULL THEN
    IF jsonb_typeof(desired->'line_items')<>'array' THEN RAISE EXCEPTION 'Invalid receipt items' USING ERRCODE='22023'; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(desired->'line_items') LOOP
     IF (item->>'amount')::numeric IS NULL OR (item->>'amount')::numeric<>round((item->>'amount')::numeric,2)
       OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(NULLIF(item->'split_among','null'::jsonb),'[]')) p
         WHERE NOT EXISTS(SELECT 1 FROM trip_members WHERE trip_id=selected_trip AND (id::text=p OR display_name=p))) THEN
      RAISE EXCEPTION 'Check receipt amounts and participants' USING ERRCODE='22023'; END IF;
    END LOOP;
   END IF;
   IF COALESCE(jsonb_array_length(NULLIF(desired->'line_items','null'::jsonb)),0)>0 THEN
    IF (SELECT sum((value->>'amount')::numeric) FROM jsonb_array_elements(desired->'line_items'))<>amount THEN
     RAISE EXCEPTION 'Receipt items must add up to the total' USING ERRCODE='22023'; END IF;
   ELSIF split='custom' AND (SELECT COALESCE(sum((value->>'amount')::numeric),0) FROM jsonb_array_elements(shares))<>amount THEN
    RAISE EXCEPTION 'Custom shares must add up to the total' USING ERRCODE='22023';
   END IF;
  END IF;
  IF split='equal' AND command='update' AND payload ? 'split_type' THEN shares:='[]'; END IF;
  IF command='create' THEN
   INSERT INTO transactions(id,trip_id,description,total_amount,payer_id,split_type,receipt_url,line_items,category,currency_conversion,status)
   VALUES(eid,selected_trip,trim(desired->>'description'),amount,(desired->>'payer_id')::uuid,split,desired->>'receipt_url',NULLIF(desired->'line_items','null'::jsonb),desired->>'category',conv,'finalized');
  ELSE
   UPDATE transactions SET description=trim(desired->>'description'),total_amount=amount,payer_id=(desired->>'payer_id')::uuid,split_type=split,
     receipt_url=desired->>'receipt_url',line_items=NULLIF(desired->'line_items','null'::jsonb),category=desired->>'category',currency_conversion=conv WHERE id=eid;
  END IF;
  IF command='create' OR payload ? 'shares' OR (split='equal' AND payload ? 'split_type') THEN
   DELETE FROM transaction_adjustments WHERE transaction_id=eid;
   INSERT INTO transaction_adjustments(transaction_id,member_id,amount)
    SELECT eid,(value->>'member_id')::uuid,(value->>'amount')::numeric FROM jsonb_array_elements(shares);
  END IF;
 END IF;
 after_state:=expense_snapshot(eid);
 INSERT INTO expense_changes(id,trip_id,expense_id,actor_id,actor_name,command,request,before_state,after_state,undo_of)
  VALUES(operation_id,selected_trip,eid,auth.uid(),actor,command,req,before_state,after_state,undo_change);
 RETURN jsonb_build_object('transactionId',eid,'changeId',operation_id,'description',COALESCE(after_state,before_state)->'expense'->>'description',
   'totalAmount',COALESCE(after_state,before_state)->'expense'->'total_amount','version',after_state->'expense'->'version');
END $$;
REVOKE ALL ON FUNCTION public.commit_expense(UUID,TEXT,UUID,UUID,JSONB,BIGINT,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.commit_expense(UUID,TEXT,UUID,UUID,JSONB,BIGINT,UUID) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
