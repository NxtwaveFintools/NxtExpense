-- =============================================================================
--  DELETE ALL EXPENSE CLAIMS
-- =============================================================================
--  Run in: Supabase Dashboard -> SQL Editor
--
--  >>> CHECK THE PROJECT SELECTOR IN THE TOP-LEFT BEFORE YOU RUN THIS. <<<
--  There is no way to assert the project ref from inside Postgres, so the
--  dashboard's project picker is the only guard. This is irreversible.
--
--  DO NOT put this file in supabase/migrations/ -- run-migrations.mjs picks up
--  every .sql in that folder and would replay this on the next db:migrate.
--
--  Cascade map (verified against the live schema -- every FK into
--  expense_claims is ON DELETE CASCADE, so one DELETE clears all five tables):
--
--    expense_claims
--      |- expense_claim_items       (claim_id -> CASCADE)
--      |- approval_history          (claim_id -> CASCADE)
--      |- finance_actions           (claim_id -> CASCADE)
--      `- claim_config_snapshots    (claim_id -> CASCADE)
--
--  expense_claims_status_summary is kept in sync by a FOR EACH ROW trigger
--  (trg_expense_claims_status_summary), so it drains as the DELETE runs. Its
--  DELETE branch subtracts total_amount without a floor, so STEP 2 also zeroes
--  the table outright to guarantee no residue.
--
--  RLS is not a factor: the SQL Editor runs as `postgres`, which owns these
--  tables and they are not FORCE ROW LEVEL SECURITY.
-- =============================================================================


-- -----------------------------------------------------------------------------
--  STEP 1 -- Preview. Run this on its own first; it changes nothing.
-- -----------------------------------------------------------------------------
SELECT 'expense_claims'            AS table_name, count(*) AS rows FROM public.expense_claims
UNION ALL
SELECT 'expense_claim_items',      count(*) FROM public.expense_claim_items
UNION ALL
SELECT 'approval_history',         count(*) FROM public.approval_history
UNION ALL
SELECT 'finance_actions',          count(*) FROM public.finance_actions
UNION ALL
SELECT 'claim_config_snapshots',   count(*) FROM public.claim_config_snapshots
ORDER BY 1;


-- -----------------------------------------------------------------------------
--  STEP 2 -- The delete. Select this whole block and run it.
--
--  It is one transaction. The verification block at the end raises an
--  exception if any row survives, which aborts the transaction and makes the
--  COMMIT a no-op -- so a partial delete cannot be committed.
-- -----------------------------------------------------------------------------
BEGIN;

-- The per-row summary trigger fires ~18k times; don't let the editor's default
-- statement timeout kill this halfway through.
SET LOCAL statement_timeout = '10min';

-- Children go with it via ON DELETE CASCADE.
DELETE FROM public.expense_claims;

-- Reset the claim_number sequence to start from 1 (used by generate_claim_number()).
ALTER SEQUENCE public.claim_number_seq RESTART WITH 1;

-- Belt and braces: the trigger should already have drained this to zero.
UPDATE public.expense_claims_status_summary
SET    claim_count  = 0,
       total_amount = 0
WHERE  claim_count <> 0 OR total_amount <> 0;

DO $$
DECLARE
  leftovers text;
BEGIN
  SELECT string_agg(format('%s (%s rows)', t, n), ', ')
  INTO   leftovers
  FROM (
    SELECT 'expense_claims'          AS t, count(*) AS n FROM public.expense_claims
    UNION ALL
    SELECT 'expense_claim_items',       count(*) FROM public.expense_claim_items
    UNION ALL
    SELECT 'approval_history',          count(*) FROM public.approval_history
    UNION ALL
    SELECT 'finance_actions',           count(*) FROM public.finance_actions
    UNION ALL
    SELECT 'claim_config_snapshots',    count(*) FROM public.claim_config_snapshots
    UNION ALL
    SELECT 'expense_claims_status_summary (non-zero)', count(*)
      FROM public.expense_claims_status_summary
      WHERE claim_count <> 0 OR total_amount <> 0
  ) s
  WHERE n <> 0;

  IF leftovers IS NOT NULL THEN
    RAISE EXCEPTION 'Rows survived the delete, rolling back: %', leftovers;
  END IF;
END $$;

COMMIT;


-- -----------------------------------------------------------------------------
--  STEP 3 -- Verify. Every count must be 0.
-- -----------------------------------------------------------------------------
SELECT 'expense_claims'            AS table_name, count(*) AS rows FROM public.expense_claims
UNION ALL
SELECT 'expense_claim_items',      count(*) FROM public.expense_claim_items
UNION ALL
SELECT 'approval_history',         count(*) FROM public.approval_history
UNION ALL
SELECT 'finance_actions',          count(*) FROM public.finance_actions
UNION ALL
SELECT 'claim_config_snapshots',   count(*) FROM public.claim_config_snapshots
UNION ALL
SELECT 'status_summary (non-zero)', count(*) FROM public.expense_claims_status_summary
  WHERE claim_count <> 0 OR total_amount <> 0
ORDER BY 1;
