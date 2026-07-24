-- ROLLBACK for 20260723110100_hierarchy_rj_adarsh_to_arka.sql
--
-- Returns the Rajasthan team's level-1 approver from Arka Prabha Ghosh to
-- Adarsh Anand Digal, including Adarsh's own pre-existing self-loop.
--
-- ⚠ Roll back in REVERSE ORDER: Phase 4 must already be reverted. If Adarsh has
-- been demoted to ABH his stage-1 flow is [1,2,3] and making him his own
-- approver again is not a valid resting state. This script checks his
-- designation and refuses if it is not SBH.
--
-- ⚠ SPARSH GUPTA IS DELIBERATELY EXCLUDED. He is the new Rajasthan ABH created
-- in Phase 2 and was wired to point at Arka on creation — this migration never
-- moved him, so returning him to Adarsh would invent a state that never existed.
-- If Phase 2 is also being rolled back, its own script deletes him.

DO $$
DECLARE
  v_old_sbh uuid;
  v_new_sbh uuid;
  v_designation text;
  v_moved int;
BEGIN
  SELECT id INTO v_old_sbh
  FROM public.employees WHERE lower(employee_email) = 'adarshanand.digal@nxtwave.co.in';

  SELECT id INTO v_new_sbh
  FROM public.employees WHERE lower(employee_email) = 'arkaprabha.ghosh@nxtwave.co.in';

  IF v_old_sbh IS NULL OR v_new_sbh IS NULL THEN
    RAISE EXCEPTION 'Rollback aborted: Adarsh and/or Arka not found.';
  END IF;

  SELECT d.designation_code INTO v_designation
  FROM public.employees e
  JOIN public.designations d ON d.id = e.designation_id
  WHERE e.id = v_old_sbh;

  IF v_designation <> 'SBH' THEN
    RAISE EXCEPTION
      'Rollback refused: Adarsh is currently %, not SBH. Roll back the Phase 4 migration first.',
      v_designation;
  END IF;

  UPDATE public.employees e
  SET approval_employee_id_level_1 = v_old_sbh,
      updated_at = now()
  FROM public.employee_states es
  JOIN public.states s ON s.id = es.state_id
  WHERE es.employee_id = e.id
    AND es.is_primary
    AND s.state_code = 'RJ'
    AND e.approval_employee_id_level_1 = v_new_sbh
    AND lower(e.employee_email) <> 'sparsh.gupta@nxtwave.co.in';

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'Rajasthan rollback: returned % report(s) to Adarsh Anand Digal.', v_moved;
END $$;

DELETE FROM public.config_versions
WHERE change_scope = 'employee_hierarchy'
  AND change_summary LIKE 'Hierarchy changes 2026-07 Phase 3 step 2 (Rajasthan):%'
  AND NOT EXISTS (
    SELECT 1 FROM public.claim_config_snapshots s
    WHERE s.config_version_id = config_versions.id
  );
