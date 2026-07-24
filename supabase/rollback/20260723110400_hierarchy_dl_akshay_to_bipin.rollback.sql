-- ROLLBACK for 20260723110400_hierarchy_dl_akshay_to_bipin.sql
--
-- Returns Delhi NCR reports from Bipin Chandra Sati to Akshay Kumar Pal.
--
-- ⚠ Roll back in REVERSE ORDER: Phase 4 must already be reverted. It drops
-- Akshay's DL state mapping, and without a DL link he stops appearing as a Delhi
-- NCR approver option in the admin dropdown even though he would once again hold
-- the Delhi NCR queue. This script refuses unless his DL mapping is present.
--
-- Bipin has no reports of his own outside this migration, so scoping by "points
-- at Bipin, DL primary" is exact.

DO $$
DECLARE
  v_old_sbh uuid;
  v_new_sbh uuid;
  v_moved int;
BEGIN
  SELECT id INTO v_old_sbh
  FROM public.employees WHERE lower(employee_email) = 'akshaykumar.pal@nxtwave.co.in';

  SELECT id INTO v_new_sbh
  FROM public.employees WHERE lower(employee_email) = 'bipin.sati@nxtwave.co.in';

  IF v_old_sbh IS NULL OR v_new_sbh IS NULL THEN
    RAISE EXCEPTION 'Rollback aborted: Akshay and/or Bipin not found.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_states es
    JOIN public.states s ON s.id = es.state_id
    WHERE es.employee_id = v_old_sbh AND s.state_code = 'DL'
  ) THEN
    RAISE EXCEPTION
      'Rollback refused: Akshay Kumar Pal has no Delhi NCR state mapping. Roll back the Phase 4 migration first.';
  END IF;

  UPDATE public.employees e
  SET approval_employee_id_level_1 = v_old_sbh,
      updated_at = now()
  FROM public.employee_states es
  JOIN public.states s ON s.id = es.state_id
  WHERE es.employee_id = e.id
    AND es.is_primary
    AND s.state_code = 'DL'
    AND e.approval_employee_id_level_1 = v_new_sbh;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'Delhi NCR rollback: returned % report(s) to Akshay Kumar Pal.', v_moved;
END $$;

DELETE FROM public.config_versions
WHERE change_scope = 'employee_hierarchy'
  AND change_summary LIKE 'Hierarchy changes 2026-07 Phase 3 step 5 (Delhi NCR):%'
  AND NOT EXISTS (
    SELECT 1 FROM public.claim_config_snapshots s
    WHERE s.config_version_id = config_versions.id
  );
