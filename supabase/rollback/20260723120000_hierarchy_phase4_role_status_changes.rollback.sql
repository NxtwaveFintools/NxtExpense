-- ROLLBACK for 20260723120000_hierarchy_phase4_role_status_changes.sql
--
-- Restores the four Phase 4 changes to their pre-migration values, captured from
-- the live database before the change:
--   Hari Haran S       ACTIVE
--   Adarsh Anand Digal SBH, active APPROVER_L1, approval_employee_id_level_1 = HIMSELF
--   Akshay Kumar Pal   DL primary + UP secondary
--   Arka Prabha Ghosh  level_2 = Tibirisetty V L S Hari Santhosh
--
-- ⚠ Adarsh's restored level-1 is the SELF-LOOP that existed before this change.
-- It is a pre-existing data oddity, not something Phase 4 introduced, and
-- restoring it is what "back to how it was" means. It is only valid while he is
-- an SBH — an SBH's flow is [2,3], so the self-reference is never actually
-- consulted. That is why the designation is restored in the same statement.
--
-- This is the FIRST script to run when unwinding, before any Phase 3 rollback.
-- The Phase 3 scripts check for the state this one restores.

DO $$
DECLARE
  v_hari uuid;
  v_adarsh uuid;
  v_akshay uuid;
  v_arka uuid;
BEGIN
  SELECT id INTO v_hari   FROM public.employees WHERE lower(employee_email) = 'hari.haran@nxtwave.co.in';
  SELECT id INTO v_adarsh FROM public.employees WHERE lower(employee_email) = 'adarshanand.digal@nxtwave.co.in';
  SELECT id INTO v_akshay FROM public.employees WHERE lower(employee_email) = 'akshaykumar.pal@nxtwave.co.in';
  SELECT id INTO v_arka   FROM public.employees WHERE lower(employee_email) = 'arkaprabha.ghosh@nxtwave.co.in';

  IF v_hari IS NULL OR v_adarsh IS NULL OR v_akshay IS NULL OR v_arka IS NULL THEN
    RAISE EXCEPTION 'Rollback aborted: one or more of Hari / Adarsh / Akshay / Arka not found.';
  END IF;

  -- ── 1. Hari back to ACTIVE so he can log in again. ──
  UPDATE public.employees
  SET employee_status_id = (
        SELECT id FROM public.employee_statuses WHERE status_code = 'ACTIVE'
      ),
      updated_at = now()
  WHERE id = v_hari;

  -- ── 2. Adarsh back to SBH, self-loop restored, APPROVER_L1 reinstated. ──
  UPDATE public.employees
  SET designation_id = (
        SELECT id FROM public.designations WHERE designation_code = 'SBH'
      ),
      approval_employee_id_level_1 = v_adarsh,
      updated_at = now()
  WHERE id = v_adarsh;

  INSERT INTO public.employee_roles (employee_id, role_id, is_active)
  SELECT v_adarsh, r.id, true
  FROM public.roles r
  WHERE r.role_code = 'APPROVER_L1'
  ON CONFLICT (employee_id, role_id) DO UPDATE SET is_active = true;

  -- ── 3. Akshay back to DL primary + UP secondary. ──
  INSERT INTO public.employee_states (employee_id, state_id, is_primary)
  SELECT v_akshay, s.id, true
  FROM public.states s
  WHERE s.state_code = 'DL'
  ON CONFLICT (employee_id, state_id) DO UPDATE SET is_primary = true;

  UPDATE public.employee_states es
  SET is_primary = false
  FROM public.states s
  WHERE es.state_id = s.id
    AND es.employee_id = v_akshay
    AND s.state_code = 'UP';

  -- ── 4. Arka's ZBH back to the Maharashtra zone. ──
  UPDATE public.employees e
  SET approval_employee_id_level_2 = zbh.id,
      updated_at = now()
  FROM public.employees zbh
  WHERE lower(zbh.employee_email) = 'harisanthosh.tibirisetty@nxtwave.co.in'
    AND e.id = v_arka;

  RAISE NOTICE 'Phase 4 rollback complete.';
END $$;

DELETE FROM public.config_versions
WHERE change_scope = 'employee_hierarchy'
  AND change_summary LIKE 'Hierarchy changes 2026-07 Phase 4:%'
  AND NOT EXISTS (
    SELECT 1 FROM public.claim_config_snapshots s
    WHERE s.config_version_id = config_versions.id
  );
