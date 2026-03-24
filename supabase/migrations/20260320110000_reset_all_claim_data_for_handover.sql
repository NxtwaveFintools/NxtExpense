BEGIN;

-- Handover reset: remove all claim data while preserving employees, roles, and access configuration.
DO $$
DECLARE
  table_name TEXT;
  claim_tables TEXT[] := ARRAY[
    'public.approval_history',
    'public.finance_actions',
    'public.expense_claim_items',
    'public.expense_claims',
    'public.claim_approvals',
    'public.claim_expenses',
    'public.archive_claim_status_audit',
    'public.archive_claim_expenses'
  ];
BEGIN
  FOREACH table_name IN ARRAY claim_tables
  LOOP
    IF to_regclass(table_name) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE %s RESTART IDENTITY CASCADE;', table_name);
    END IF;
  END LOOP;

  IF to_regclass('public.claim_number_seq') IS NOT NULL THEN
    EXECUTE 'ALTER SEQUENCE public.claim_number_seq RESTART WITH 1;';
  END IF;
END
$$;

COMMIT;
