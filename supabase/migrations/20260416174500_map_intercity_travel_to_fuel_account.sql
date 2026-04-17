BEGIN;

DO $$
DECLARE
  fuel_bal_account_no varchar(20);
BEGIN
  SELECT bal_account_no
  INTO fuel_bal_account_no
  FROM public.expense_type_account_mappings
  WHERE expense_item_type = 'fuel'
    AND is_active = true
  ORDER BY updated_at DESC
  LIMIT 1;

  IF fuel_bal_account_no IS NULL THEN
    RAISE EXCEPTION 'Cannot map intercity_travel export account: active fuel mapping not found.';
  END IF;

  INSERT INTO public.expense_type_account_mappings (
    expense_item_type,
    bal_account_no,
    is_active
  )
  VALUES (
    'intercity_travel',
    fuel_bal_account_no,
    true
  )
  ON CONFLICT (expense_item_type)
  DO UPDATE SET
    bal_account_no = EXCLUDED.bal_account_no,
    is_active = true,
    updated_at = now();
END $$;

COMMIT;
