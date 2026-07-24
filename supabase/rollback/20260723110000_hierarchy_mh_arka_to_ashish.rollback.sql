-- ROLLBACK for 20260723110000_hierarchy_mh_arka_to_ashish.sql
--
-- Moves the Maharashtra team's level-1 approver back from Ashish Prakash Patil
-- to Arka Prabha Ghosh.
--
-- ⚠ Roll back in REVERSE ORDER: the Rajasthan step (20260723110100) and
-- everything after it must be rolled back first, otherwise Arka would hold both
-- the Maharashtra and the Rajasthan queue at once — the exact state the forward
-- ordering existed to avoid. This script checks for that.
--
-- Scoped to MH-primary reports, mirroring the corrected forward migration.
--
-- ⚠ PRATHAMESH PAWAR IS DELIBERATELY EXCLUDED. He is the new Maharashtra ABH
-- created in Phase 2 and wired to Ashish on creation — the forward migration
-- never moved him, so handing him to Arka would invent a state that never
-- existed. If Phase 2 is also being rolled back, its own script deletes him.
--
-- ⚠ Sparsh Gupta is likewise untouched: he is a Rajasthan report and the
-- corrected forward migration never moves him. See
-- 20260723130000_hierarchy_fix_sparsh_rj_approver.sql.

DO $$
DECLARE
  v_old_sbh uuid;
  v_new_sbh uuid;
  v_rj_still_moved int;
  v_moved int;
BEGIN
  SELECT id INTO v_old_sbh
  FROM public.employees WHERE lower(employee_email) = 'arkaprabha.ghosh@nxtwave.co.in';

  SELECT id INTO v_new_sbh
  FROM public.employees WHERE lower(employee_email) = 'ashish.prakashpatil@nxtwave.co.in';

  IF v_old_sbh IS NULL OR v_new_sbh IS NULL THEN
    RAISE EXCEPTION 'Rollback aborted: Arka and/or Ashish not found.';
  END IF;

  -- ── Ordering guard: has Rajasthan already been reverted? If Adarsh's old
  --    reports still point at Arka, the Rajasthan step is still applied. ──
  SELECT count(*) INTO v_rj_still_moved
  FROM public.employees e
  JOIN public.employee_states es ON es.employee_id = e.id AND es.is_primary
  JOIN public.states s ON s.id = es.state_id
  WHERE e.approval_employee_id_level_1 = v_old_sbh
    AND s.state_code = 'RJ';

  IF v_rj_still_moved > 0 THEN
    RAISE EXCEPTION
      'Rollback refused: % Rajasthan report(s) still point at Arka. Roll back 20260723110100 (Rajasthan) first.',
      v_rj_still_moved;
  END IF;

  UPDATE public.employees e
  SET approval_employee_id_level_1 = v_old_sbh,
      updated_at = now()
  FROM public.employee_states es
  JOIN public.states s ON s.id = es.state_id
  WHERE es.employee_id = e.id
    AND es.is_primary
    AND s.state_code = 'MH'
    AND e.approval_employee_id_level_1 = v_new_sbh
    AND lower(e.employee_email) <> 'prathamesh.pawar@nxtwave.co.in';

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'Maharashtra rollback: returned % report(s) to Arka Prabha Ghosh.', v_moved;
END $$;

DELETE FROM public.config_versions
WHERE change_scope = 'employee_hierarchy'
  AND change_summary LIKE 'Hierarchy changes 2026-07 Phase 3 step 1 (Maharashtra):%'
  AND NOT EXISTS (
    SELECT 1 FROM public.claim_config_snapshots s
    WHERE s.config_version_id = config_versions.id
  );
