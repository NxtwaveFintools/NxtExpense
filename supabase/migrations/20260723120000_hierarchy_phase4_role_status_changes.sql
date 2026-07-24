-- Hierarchy changes 2026-07 — Phase 4: role, status and designation changes.
--
-- ⚠ APPLY LAST. Every change here is destructive to somebody's access, and each
-- one is only safe once the corresponding Phase 3 pointer move has landed and
-- the queues are empty. Each block below re-checks its own precondition rather
-- than trusting the running order.
--
-- Four changes:
--   1. Hari Haran S       → INACTIVE
--   2. Adarsh Anand Digal → ABH, with Arka as his level-1 approver
--   3. Akshay Kumar Pal   → state mapping narrowed to UP only
--   4. Arka Prabha Ghosh  → level_2 (ZBH) switched from the MH zone to the RJ zone
--
-- Idempotent: re-running converges on the same state rather than erroring.

DO $$
DECLARE
  v_hari uuid;
  v_adarsh uuid;
  v_akshay uuid;
  v_arka uuid;
  v_reports int;
  v_own_claims int;
  v_designation text;
BEGIN
  SELECT id INTO v_hari   FROM public.employees WHERE lower(employee_email) = 'hari.haran@nxtwave.co.in';
  SELECT id INTO v_adarsh FROM public.employees WHERE lower(employee_email) = 'adarshanand.digal@nxtwave.co.in';
  SELECT id INTO v_akshay FROM public.employees WHERE lower(employee_email) = 'akshaykumar.pal@nxtwave.co.in';
  SELECT id INTO v_arka   FROM public.employees WHERE lower(employee_email) = 'arkaprabha.ghosh@nxtwave.co.in';

  IF v_hari IS NULL OR v_adarsh IS NULL OR v_akshay IS NULL OR v_arka IS NULL THEN
    RAISE EXCEPTION 'Phase 4 aborted: one or more of Hari / Adarsh / Akshay / Arka not found.';
  END IF;

  -- ════════════════════════════════════════════════════════════════════════
  -- 1. HARI HARAN S → INACTIVE
  --
  -- Two preconditions, both hard, both about the same thing: an INACTIVE
  -- employee cannot log in. getEmployeeByEmail filters on ACTIVE and returns
  -- null otherwise, which lands them on /no-access.
  --
  --   (a) He must hold no approver assignments. If anyone still points at him,
  --       their claims would sit in a queue belonging to someone who cannot
  --       reach it — permanently stuck, with no error anywhere.
  --   (b) His own claims must be settled. Inactivating does not strand them
  --       (the HOD still acts via approval_employee_id_level_3), but Hari loses
  --       all visibility of them the moment he goes inactive.
  --
  -- His approval_history rows are untouched and stay fully visible to Finance
  -- and Admin, so the audit trail survives his deactivation intact.
  -- ════════════════════════════════════════════════════════════════════════
  SELECT count(*) INTO v_reports
  FROM public.employees
  WHERE approval_employee_id_level_1 = v_hari
     OR approval_employee_id_level_2 = v_hari
     OR approval_employee_id_level_3 = v_hari;

  IF v_reports > 0 THEN
    RAISE EXCEPTION
      'Cannot inactivate Hari Haran S: % employee(s) still name him as an approver. Apply the Kerala and Tamil Nadu migrations first.',
      v_reports;
  END IF;

  SELECT count(*) INTO v_own_claims
  FROM public.expense_claims c
  JOIN public.claim_statuses cs ON cs.id = c.status_id
  WHERE c.employee_id = v_hari
    AND cs.status_code IN ('L1_PENDING', 'L2_PENDING', 'L3_PENDING_FINANCE_REVIEW', 'APPROVED');

  IF v_own_claims > 0 THEN
    RAISE EXCEPTION
      'Cannot inactivate Hari Haran S: he has % unsettled claim(s) of his own. He would lose visibility of them.',
      v_own_claims;
  END IF;

  UPDATE public.employees
  SET employee_status_id = (
        SELECT id FROM public.employee_statuses WHERE status_code = 'INACTIVE'
      ),
      updated_at = now()
  WHERE id = v_hari
    AND employee_status_id IS DISTINCT FROM (
      SELECT id FROM public.employee_statuses WHERE status_code = 'INACTIVE'
    );

  RAISE NOTICE 'Hari Haran S set INACTIVE (0 reports, 0 unsettled claims).';

  -- ════════════════════════════════════════════════════════════════════════
  -- 2. ADARSH ANAND DIGAL: SBH → ABH
  --
  -- ⚠ THE DESIGNATION CHANGE AND THE LEVEL-1 ASSIGNMENT MUST HAPPEN TOGETHER.
  -- designation_approval_flow gives SBH the flow [2,3] (straight to the HOD) but
  -- ABH the flow [1,2,3]. The moment he becomes an ABH his claims start at stage
  -- 1 and need a stage-1 approver. shouldBlockForMissingLevel1Approver throws on
  -- submit if that column is NULL — he would be blocked from filing anything at
  -- all. Setting it in the same statement is a hard requirement, not tidiness.
  --
  -- His level-1 becomes Arka, the new Rajasthan SBH. He previously pointed at
  -- HIMSELF (a pre-existing self-loop); the Rajasthan migration already moved
  -- him along with the rest of his team, and this re-asserts it defensively.
  --
  -- Known and accepted side effect: expense_rates is designation-scoped, so his
  -- ACCOMMODATION rate drops from the SBH ₹2000 to the ABH ₹1000 on new claims.
  -- Past claims keep their frozen snapshot value. This is intended — no override.
  --
  -- His APPROVER_L1 role is deactivated rather than deleted. It is inert either
  -- way once nothing points at him, but leaving an active approver role on a
  -- non-approver is the kind of stale data that makes the next audit confusing.
  -- Deactivating keeps the row for history and makes the rollback a flag flip.
  -- ════════════════════════════════════════════════════════════════════════
  SELECT count(*) INTO v_reports
  FROM public.employees
  WHERE approval_employee_id_level_1 = v_adarsh AND id <> v_adarsh;

  IF v_reports > 0 THEN
    RAISE EXCEPTION
      'Cannot demote Adarsh Anand Digal: % report(s) still point at him at level 1. Apply the Rajasthan migration first.',
      v_reports;
  END IF;

  UPDATE public.employees
  SET designation_id = (
        SELECT id FROM public.designations WHERE designation_code = 'ABH'
      ),
      approval_employee_id_level_1 = v_arka,
      updated_at = now()
  WHERE id = v_adarsh;

  UPDATE public.employee_roles er
  SET is_active = false
  FROM public.roles r
  WHERE er.role_id = r.id
    AND er.employee_id = v_adarsh
    AND r.role_code = 'APPROVER_L1'
    AND er.is_active;

  -- Assert the thing that would silently break him.
  SELECT d.designation_code INTO v_designation
  FROM public.employees e
  JOIN public.designations d ON d.id = e.designation_id
  WHERE e.id = v_adarsh;

  IF v_designation = 'ABH' AND NOT EXISTS (
    SELECT 1 FROM public.employees WHERE id = v_adarsh AND approval_employee_id_level_1 IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Adarsh is now an ABH with no level-1 approver; he would be blocked from submitting any claim.';
  END IF;

  RAISE NOTICE 'Adarsh Anand Digal demoted to ABH with Arka Prabha Ghosh as level-1 approver.';

  -- ════════════════════════════════════════════════════════════════════════
  -- 3. AKSHAY KUMAR PAL — state mapping narrowed to Uttar Pradesh.
  --
  -- He keeps his SBH designation, his ACTIVE status, and his entire UP team.
  -- Only the Delhi NCR mapping goes. Without this he keeps surfacing as a Delhi
  -- NCR approver option in the admin dropdown alongside Bipin
  -- (get_admin_approver_options_by_state reads employee_states), which is how
  -- a new Delhi NCR joiner would end up wired to the wrong SBH.
  --
  -- Precondition: the Delhi NCR handover must have happened. Dropping the
  -- mapping while he still holds DL reports would leave those reports pointing
  -- at an approver the admin UI no longer offers for their state.
  -- ════════════════════════════════════════════════════════════════════════
  SELECT count(*) INTO v_reports
  FROM public.employees e
  JOIN public.employee_states es ON es.employee_id = e.id AND es.is_primary
  JOIN public.states s ON s.id = es.state_id
  WHERE e.approval_employee_id_level_1 = v_akshay
    AND s.state_code = 'DL';

  IF v_reports > 0 THEN
    RAISE EXCEPTION
      'Cannot drop Akshay Kumar Pal''s Delhi NCR mapping: % DL report(s) still point at him. Apply the Delhi NCR migration first.',
      v_reports;
  END IF;

  UPDATE public.employee_states es
  SET is_primary = true
  FROM public.states s
  WHERE es.state_id = s.id
    AND es.employee_id = v_akshay
    AND s.state_code = 'UP'
    AND NOT es.is_primary;

  DELETE FROM public.employee_states es
  USING public.states s
  WHERE es.state_id = s.id
    AND es.employee_id = v_akshay
    AND s.state_code = 'DL';

  RAISE NOTICE 'Akshay Kumar Pal narrowed to Uttar Pradesh (primary); Delhi NCR mapping dropped.';

  -- ════════════════════════════════════════════════════════════════════════
  -- 4. ARKA PRABHA GHOSH — level_2 follows him from the Maharashtra zone to the
  --    Rajasthan zone: Tibirisetty V L S Hari Santhosh → Satya Priya Dash.
  --
  -- Reminder: level_2 is the ZBH and IS NOT AN APPROVAL STEP. Nobody ever acts
  -- on this column — submit_approval_action_atomic accepts only level_1 at stage
  -- 1 and level_3 at stage 2. It exists purely so the ZBH can SEE the claims
  -- sitting beneath them in pending_approvals_filtered. Getting it wrong
  -- misdirects visibility, not routing.
  -- ════════════════════════════════════════════════════════════════════════
  UPDATE public.employees e
  SET approval_employee_id_level_2 = zbh.id,
      updated_at = now()
  FROM public.employees zbh
  WHERE lower(zbh.employee_email) = 'satyapriya.dash@nxtwave.co.in'
    AND e.id = v_arka
    AND e.approval_employee_id_level_2 IS DISTINCT FROM zbh.id;

  RAISE NOTICE 'Arka Prabha Ghosh level_2 (ZBH) switched to Satya Priya Dash.';
  RAISE NOTICE 'Phase 4 complete.';
END $$;

-- Record the change as a config version. version_number is GENERATED ALWAYS AS
-- IDENTITY here, which rejects an explicit value — and identity columns report
-- column_default = NULL, so the shape is detected at runtime rather than
-- assumed. See the Phase 2 migration for the full explanation.
DO $$
DECLARE
  v_tag     constant text := 'Hierarchy changes 2026-07 Phase 4:';
  v_summary constant text := v_tag || ' Hari Haran S inactivated; Adarsh Anand '
    'Digal demoted SBH to ABH with Arka Prabha Ghosh as level-1 approver; Akshay '
    'Kumar Pal narrowed to Uttar Pradesh; Arka Prabha Ghosh ZBH switched to '
    'Satya Priya Dash.';
  v_autonumbered boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.config_versions
    WHERE change_scope = 'employee_hierarchy'
      AND change_summary LIKE v_tag || '%'
  ) THEN
    RAISE NOTICE 'config_versions already records this change; skipping.';
    RETURN;
  END IF;

  SELECT (c.is_identity = 'YES' OR c.column_default IS NOT NULL)
  INTO v_autonumbered
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'config_versions'
    AND c.column_name = 'version_number';

  IF coalesce(v_autonumbered, false) THEN
    INSERT INTO public.config_versions (change_scope, change_summary)
    VALUES ('employee_hierarchy', v_summary);
  ELSE
    INSERT INTO public.config_versions (version_number, change_scope, change_summary)
    SELECT coalesce(max(version_number), 0) + 1, 'employee_hierarchy', v_summary
    FROM public.config_versions;
  END IF;
END $$;
