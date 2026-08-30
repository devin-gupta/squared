-- Store categories independently of receipt line items. Existing expenses,
-- amounts, currency references and member allocations remain unchanged.
-- Apply after 003_currency_conversion.sql, before deploying category editing.
BEGIN;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS category TEXT;

-- Save the USD expense, its original-currency reference, and custom allocations
-- together. SECURITY INVOKER keeps the caller's existing row-level permissions.
CREATE OR REPLACE FUNCTION public.create_converted_expense(expense JSONB, shares JSONB DEFAULT '[]'::jsonb)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  expense_id UUID;
  selected_trip UUID := (expense->>'trip_id')::uuid;
  usd_total NUMERIC := (expense->>'total_amount')::numeric;
  conversion JSONB := expense->'currency_conversion';
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM trip_members WHERE trip_id = selected_trip AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Trip membership required' USING ERRCODE = '42501';
  END IF;
  IF conversion IS NULL OR jsonb_typeof(conversion) <> 'object'
     OR COALESCE(conversion->>'original_currency', '') !~ '^[A-Z]{3}$'
     OR conversion->>'original_currency' = 'USD'
     OR COALESCE((conversion->>'original_amount')::numeric, 0) <= 0
     OR COALESCE((conversion->>'rate')::numeric, 0) <= 0
     OR COALESCE(conversion->>'provider', '') <> 'Frankfurter'
     OR COALESCE(conversion->>'rate_date', '') !~ '^\d{4}-\d{2}-\d{2}$'
     OR usd_total IS NULL OR usd_total <= 0
     OR usd_total <> ROUND((conversion->>'original_amount')::numeric * (conversion->>'rate')::numeric, 2) THEN
    RAISE EXCEPTION 'Invalid currency conversion' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM trip_members WHERE id = (expense->>'payer_id')::uuid AND trip_id = selected_trip
  ) THEN
    RAISE EXCEPTION 'Payer must belong to the trip' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(shares) <> 'array' THEN
    RAISE EXCEPTION 'Invalid custom shares' USING ERRCODE = '22023';
  END IF;
  IF expense->'line_items' IS NOT NULL AND expense->'line_items' <> 'null'::jsonb
     AND jsonb_array_length(expense->'line_items') > 0 THEN
    IF (SELECT COALESCE(SUM((item->>'amount')::numeric), 0) FROM jsonb_array_elements(expense->'line_items') item) <> usd_total THEN
      RAISE EXCEPTION 'Receipt items must sum to the USD total' USING ERRCODE = '22023';
    END IF;
  ELSIF expense->>'split_type' = 'custom' THEN
    IF (SELECT COALESCE(SUM((share->>'amount')::numeric), 0) FROM jsonb_array_elements(shares) share) <> usd_total THEN
      RAISE EXCEPTION 'Custom shares must sum to the USD total' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(shares) share
    WHERE (share->>'amount')::numeric IS NULL OR (share->>'amount')::numeric < 0
       OR NOT EXISTS (SELECT 1 FROM trip_members WHERE id = (share->>'member_id')::uuid AND trip_id = selected_trip)
  ) THEN
    RAISE EXCEPTION 'Invalid member or share' USING ERRCODE = '22023';
  END IF;

  INSERT INTO transactions (trip_id, description, total_amount, payer_id, split_type, receipt_url, line_items, status, currency_conversion, category)
  VALUES (selected_trip, expense->>'description', usd_total, (expense->>'payer_id')::uuid,
          expense->>'split_type', expense->>'receipt_url', NULLIF(expense->'line_items', 'null'::jsonb), 'finalized', conversion, NULLIF(expense->>'category', ''))
  RETURNING id INTO expense_id;

  INSERT INTO transaction_adjustments (transaction_id, member_id, amount)
  SELECT expense_id, (share->>'member_id')::uuid, (share->>'amount')::numeric
  FROM jsonb_array_elements(shares) share;
  RETURN expense_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_converted_expense(JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_converted_expense(JSONB, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
