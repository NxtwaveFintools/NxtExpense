-- ROLLBACK for 20260723110200_hierarchy_kl_hari_to_jijo.sql
--
-- Returns Kerala reports from Jijo Varghese to Hari Haran S.
--
-- ⚠ Roll back in REVERSE ORDER: Phase 4 must already be reverted. Hari is set
-- INACTIVE there, and an inactive employee cannot log in (getEmployeeByEmail
-- filters on ACTIVE), so handing him a queue he cannot reach would strand every
-- claim in it. This script refuses unless he is ACTIVE.
--
-- Scoped to KL-primary reports currently pointing at Jijo. Jijo has no reports
-- of his own outside this migration, so the scope is exact.

DO $$
DECLARE
  v_old_sbh uuid;
  v_new_sbh uuid;
  v_status text;
  v_moved int;
BEGIN
  SELECT id INTO v_old_sbh
  FROM public.employees WHERE lower(employee_email) = 'hari.haran@nxtwave.co.in';

  SELECT id INTO v_new_sbh
  FROM public.employees WHERE lower(employee_email) = 'jijo.varghese@nxtwave.co.in';

  IF v_old_sbh IS NULL OR v_new_sbh IS NULL THEN
    RAISE EXCEPTION 'Rollback aborted: Hari and/or Jijo not found.';
  END IF;

  SELECT st.status_code INTO v_status
  FROM public.employees e
  JOIN public.employee_statuses st ON st.id = e.employee_status_id
  WHERE e.id = v_old_sbh;

  IF v_status <> 'ACTIVE' THEN
    RAISE EXCEPTION
      'Rollback refused: Hari Haran S is %, not ACTIVE — he could not log in to action the returned queue. Roll back the Phase 4 migration first.',
      v_status;
  END IF;

  UPDATE public.employees e
  SET approval_employee_id_level_1 = v_old_sbh,
      updated_at = now()
  FROM public.employee_states es
  JOIN public.states s ON s.id = es.state_id
  WHERE es.employee_id = e.id
    AND es.is_primary
    AND s.state_code = 'KL'
    AND e.approval_employee_id_level_1 = v_new_sbh;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'Kerala rollback: returned % report(s) to Hari Haran S.', v_moved;
END $$;

DELETE FROM public.config_versions
WHERE change_scope = 'employee_hierarchy'
  AND change_summary LIKE 'Hierarchy changes 2026-07 Phase 3 step 3 (Kerala):%'
  AND NOT EXISTS (
    SELECT 1 FROM public.claim_config_snapshots s
    WHERE s.config_version_id = config_versions.id
  );
