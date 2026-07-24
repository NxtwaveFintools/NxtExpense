-- ROLLBACK for 20260723110300_hierarchy_tn_hari_to_sreejish.sql
--
-- Returns Tamil Nadu reports from Sreejish Mohana Kumar to Hari Haran S.
--
-- ⚠ Roll back in REVERSE ORDER: Phase 4 must already be reverted, or Hari is
-- INACTIVE and cannot log in to action the queue being handed back to him.
--
-- ⚠ SIRANJEEVA C AND RETHINA KUMAR C ARE DELIBERATELY EXCLUDED. Both are new
-- Tamil Nadu ABHs created in Phase 2 and wired to Sreejish on creation — this
-- migration never moved them, so returning them to Hari would invent a state
-- that never existed. If Phase 2 is also being rolled back, its own script
-- deletes them.

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
  FROM public.employees WHERE lower(employee_email) = 'sreejish.mohanakumar@nxtwave.co.in';

  IF v_old_sbh IS NULL OR v_new_sbh IS NULL THEN
    RAISE EXCEPTION 'Rollback aborted: Hari and/or Sreejish not found.';
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
    AND s.state_code = 'TN'
    AND e.approval_employee_id_level_1 = v_new_sbh
    AND lower(e.employee_email) NOT IN (
      'siranjeeva.c@nxtwave.co.in',
      'c.rethinakumar@nxtwave.co.in'
    );

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'Tamil Nadu rollback: returned % report(s) to Hari Haran S.', v_moved;
END $$;

DELETE FROM public.config_versions
WHERE change_scope = 'employee_hierarchy'
  AND change_summary LIKE 'Hierarchy changes 2026-07 Phase 3 step 4 (Tamil Nadu):%'
  AND NOT EXISTS (
    SELECT 1 FROM public.claim_config_snapshots s
    WHERE s.config_version_id = config_versions.id
  );
