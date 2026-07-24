-- ROLLBACK for 20260723100000_hierarchy_phase2_new_joiners_and_fixes.sql
--
-- ⚠ PRECONDITION: roll back in REVERSE ORDER. Phase 3 (the per-state pointer
-- moves) and Phase 4 must already be rolled back before this runs. This script
-- refuses to proceed otherwise, because deleting a person who is still somebody's
-- approver would strand claims with a dangling pointer.
--
-- The 9 new employees are DELETED, not inactivated — they were created by this
-- migration and never existed before it. That is only safe while they have no
-- footprint (no claims, no approval history, no reports). All three are checked.
--
-- The repairs to the 3 existing records are reverted to their pre-migration
-- values, which were captured from the live database before this change:
--   Sreejish Mohana Kumar (NW0000744): INACTIVE, EMPLOYEE role only, KL primary + TN secondary
--   Muhammed Hijas:                    employee_id NW1006377
--   Arka Prabha Ghosh (NW0001212):     no employee_states rows at all
--   7 Maharashtra staff under Arka:    no employee_states rows at all

DO $$
DECLARE
  v_blocked text;
  v_count int;
BEGIN
  -- ── Guard 1: nobody may still point at the people we are about to delete. ──
  SELECT string_agg(DISTINCT target.employee_name, ', ')
  INTO v_blocked
  FROM public.employees target
  WHERE lower(target.employee_email) IN (
      'ashish.prakashpatil@nxtwave.co.in','bipin.sati@nxtwave.co.in',
      'jijo.varghese@nxtwave.co.in','nithin.k@nxtwave.co.in',
      'siranjeeva.c@nxtwave.co.in','c.rethinakumar@nxtwave.co.in',
      'nilesh.tiwari@nxtwave.co.in','prathamesh.pawar@nxtwave.co.in',
      'sparsh.gupta@nxtwave.co.in')
    AND EXISTS (
      SELECT 1 FROM public.employees r
      WHERE r.approval_employee_id_level_1 = target.id
         OR r.approval_employee_id_level_2 = target.id
         OR r.approval_employee_id_level_3 = target.id
    );

  IF v_blocked IS NOT NULL THEN
    RAISE EXCEPTION
      'Rollback refused: % still hold(s) approver assignments. Roll back Phase 3/4 first.',
      v_blocked;
  END IF;

  -- ── Guard 2: no claims and no approval history. ──
  SELECT string_agg(DISTINCT target.employee_name, ', ')
  INTO v_blocked
  FROM public.employees target
  WHERE lower(target.employee_email) IN (
      'ashish.prakashpatil@nxtwave.co.in','bipin.sati@nxtwave.co.in',
      'jijo.varghese@nxtwave.co.in','nithin.k@nxtwave.co.in',
      'siranjeeva.c@nxtwave.co.in','c.rethinakumar@nxtwave.co.in',
      'nilesh.tiwari@nxtwave.co.in','prathamesh.pawar@nxtwave.co.in',
      'sparsh.gupta@nxtwave.co.in')
    AND (
      EXISTS (SELECT 1 FROM public.expense_claims c WHERE c.employee_id = target.id)
      OR EXISTS (SELECT 1 FROM public.approval_history ah WHERE ah.approver_employee_id = target.id)
    );

  IF v_blocked IS NOT NULL THEN
    RAISE EXCEPTION
      'Rollback refused: % already filed claims or acted on approvals. Inactivate instead of deleting.',
      v_blocked;
  END IF;

  -- ── 1. Delete the 9 new employees (children first). ──
  DELETE FROM public.employee_roles er
  USING public.employees e
  WHERE er.employee_id = e.id
    AND lower(e.employee_email) IN (
      'ashish.prakashpatil@nxtwave.co.in','bipin.sati@nxtwave.co.in',
      'jijo.varghese@nxtwave.co.in','nithin.k@nxtwave.co.in',
      'siranjeeva.c@nxtwave.co.in','c.rethinakumar@nxtwave.co.in',
      'nilesh.tiwari@nxtwave.co.in','prathamesh.pawar@nxtwave.co.in',
      'sparsh.gupta@nxtwave.co.in');

  DELETE FROM public.employee_states es
  USING public.employees e
  WHERE es.employee_id = e.id
    AND lower(e.employee_email) IN (
      'ashish.prakashpatil@nxtwave.co.in','bipin.sati@nxtwave.co.in',
      'jijo.varghese@nxtwave.co.in','nithin.k@nxtwave.co.in',
      'siranjeeva.c@nxtwave.co.in','c.rethinakumar@nxtwave.co.in',
      'nilesh.tiwari@nxtwave.co.in','prathamesh.pawar@nxtwave.co.in',
      'sparsh.gupta@nxtwave.co.in');

  DELETE FROM public.employees e
  WHERE lower(e.employee_email) IN (
    'ashish.prakashpatil@nxtwave.co.in','bipin.sati@nxtwave.co.in',
    'jijo.varghese@nxtwave.co.in','nithin.k@nxtwave.co.in',
    'siranjeeva.c@nxtwave.co.in','c.rethinakumar@nxtwave.co.in',
    'nilesh.tiwari@nxtwave.co.in','prathamesh.pawar@nxtwave.co.in',
    'sparsh.gupta@nxtwave.co.in');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % newly-created employee row(s).', v_count;

  -- ── 2. Sreejish back to INACTIVE, EMPLOYEE-only, KL primary.
  --    Matched on email, matching the forward migration: employee_id values in
  --    these files came from the dev database and are not guaranteed elsewhere. ──
  UPDATE public.employees
  SET employee_status_id = (
        SELECT id FROM public.employee_statuses WHERE status_code = 'INACTIVE'
      ),
      updated_at = now()
  WHERE lower(employee_email) = 'sreejish.mohanakumar@nxtwave.co.in';

  DELETE FROM public.employee_roles er
  USING public.employees e, public.roles r
  WHERE er.employee_id = e.id
    AND er.role_id = r.id
    AND lower(e.employee_email) = 'sreejish.mohanakumar@nxtwave.co.in'
    AND r.role_code = 'APPROVER_L1';

  UPDATE public.employee_states es
  SET is_primary = (s.state_code = 'KL')
  FROM public.employees e, public.states s
  WHERE es.employee_id = e.id
    AND es.state_id = s.id
    AND lower(e.employee_email) = 'sreejish.mohanakumar@nxtwave.co.in'
    AND s.state_code IN ('TN', 'KL');

  -- ── 3. Muhammed Hijas back to his intern-series ID.
  --
  --    ⚠ OPERATOR CHECK REQUIRED. 'NW1006377' is the pre-change value observed
  --    on the DEV database. Unlike everything else here, this cannot be derived
  --    from the current state — the old id is gone once the forward migration
  --    has run. If his pre-change id on THIS database was different, take the
  --    real value from the query-D snapshot and edit the literal below before
  --    running. The NOTICE prints what is being written so a mismatch is visible.
  --
  --    A cross-check that needs no snapshot: his existing claim_number values
  --    retain the old prefix, so `select distinct claim_number from
  --    expense_claims where employee_id = <his uuid>` reveals the original id. ──
  UPDATE public.employees
  SET employee_id = 'NW1006377',
      updated_at = now()
  WHERE lower(employee_email) = 'muhammed.hijas@nxtwave.co.in'
    AND employee_id IS DISTINCT FROM 'NW1006377';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RAISE NOTICE 'Muhammed Hijas employee_id reverted to NW1006377 — verify this matches the pre-change value for this database.';
  END IF;

  -- ── 4. Remove Arka's RJ state row (he had none before this migration). ──
  DELETE FROM public.employee_states es
  USING public.employees e, public.states s
  WHERE es.employee_id = e.id
    AND es.state_id = s.id
    AND lower(e.employee_email) = 'arkaprabha.ghosh@nxtwave.co.in'
    AND s.state_code = 'RJ';

  -- ── 5. Remove the MH backfill for Arka's reports.
  --    Selected by the same pointer the forward migration used. This is why the
  --    reverse-order precondition matters: after Phase 3 those reports point at
  --    Ashish, and this statement would match nothing.
  --    Scoped to MH-only holders so anyone who legitimately gained other state
  --    rows in the meantime is left untouched. ──
  DELETE FROM public.employee_states es
  USING public.employees e, public.states s, public.employees arka
  WHERE es.employee_id = e.id
    AND es.state_id = s.id
    AND arka.id = e.approval_employee_id_level_1
    AND lower(arka.employee_email) = 'arkaprabha.ghosh@nxtwave.co.in'
    AND s.state_code = 'MH'
    AND es.is_primary
    AND NOT EXISTS (
      SELECT 1 FROM public.employee_states other
      WHERE other.employee_id = e.id AND other.state_id <> s.id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Removed MH backfill from % employee(s).', v_count;

  RAISE NOTICE 'Phase 2 rollback complete.';
END $$;

DELETE FROM public.config_versions
WHERE change_scope = 'employee_hierarchy'
  AND change_summary LIKE 'Hierarchy changes 2026-07 Phase 2:%'
  AND NOT EXISTS (
    SELECT 1 FROM public.claim_config_snapshots s
    WHERE s.config_version_id = config_versions.id
  );
