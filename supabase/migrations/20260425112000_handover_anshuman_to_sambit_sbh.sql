BEGIN;

DO $$
DECLARE
  v_old_employee public.employees%ROWTYPE;
  v_new_employee public.employees%ROWTYPE;
  v_pm_employee public.employees%ROWTYPE;
  v_admin_employee public.employees%ROWTYPE;
  v_sbh_designation_id uuid;
  v_abh_designation_id uuid;
  v_pm_designation_id uuid;
  v_inactive_status_id uuid;
  v_odisha_state_id uuid;
  v_west_bengal_state_id uuid;
  v_approver_l1_role_id uuid;
  v_approver_l2_role_id uuid;
  v_admin_role_id uuid;
  v_admin_log_id uuid;
  v_previous_sambit_designation_name text;
  v_previous_sambit_l3_email text;
  v_replacement_reason text :=
    'System migration handover for Odisha and West Bengal SBH coverage from Anshuman Chatterjee to Sambit Kumar Aich.';
  v_l1_ref_count integer := 0;
  v_l2_ref_count integer := 0;
  v_l3_ref_count integer := 0;
  v_pending_claim_count integer := 0;
  v_reassigned_count integer := 0;
  v_row_count integer := 0;
  v_mutation_count integer := 0;
BEGIN
  SELECT *
  INTO v_old_employee
  FROM public.employees
  WHERE lower(employee_email) = 'anshuman.chatterjee@nxtwave.co.in'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Handover aborted: old employee record for Anshuman not found.';
  END IF;

  SELECT *
  INTO v_new_employee
  FROM public.employees
  WHERE lower(employee_email) = 'sambitkumar.aich@nxtwave.co.in'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Handover aborted: successor employee record for Sambit not found.';
  END IF;

  SELECT *
  INTO v_pm_employee
  FROM public.employees
  WHERE lower(employee_email) = 'mansoor@nxtwave.co.in'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Handover aborted: PM/HOD record for Mansoor not found.';
  END IF;

  SELECT *
  INTO v_admin_employee
  FROM public.employees
  WHERE lower(employee_email) = 'expenseadmin@nxtwave.co.in'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Handover aborted: seeded admin employee expenseadmin@nxtwave.co.in not found.';
  END IF;

  SELECT id
  INTO v_sbh_designation_id
  FROM public.designations
  WHERE designation_code = 'SBH'
    AND is_active = true
  LIMIT 1;

  SELECT id
  INTO v_abh_designation_id
  FROM public.designations
  WHERE designation_code = 'ABH'
    AND is_active = true
  LIMIT 1;

  SELECT id
  INTO v_pm_designation_id
  FROM public.designations
  WHERE designation_code = 'PM'
    AND is_active = true
  LIMIT 1;

  SELECT id
  INTO v_inactive_status_id
  FROM public.employee_statuses
  WHERE status_code = 'INACTIVE'
  LIMIT 1;

  SELECT id
  INTO v_odisha_state_id
  FROM public.states
  WHERE state_name = 'Odisha'
  LIMIT 1;

  SELECT id
  INTO v_west_bengal_state_id
  FROM public.states
  WHERE state_name = 'West Bengal'
  LIMIT 1;

  SELECT id
  INTO v_approver_l1_role_id
  FROM public.roles
  WHERE role_code = 'APPROVER_L1'
  LIMIT 1;

  SELECT id
  INTO v_approver_l2_role_id
  FROM public.roles
  WHERE role_code = 'APPROVER_L2'
  LIMIT 1;

  SELECT id
  INTO v_admin_role_id
  FROM public.roles
  WHERE role_code = 'ADMIN'
  LIMIT 1;

  IF v_sbh_designation_id IS NULL OR v_abh_designation_id IS NULL OR v_pm_designation_id IS NULL THEN
    RAISE EXCEPTION 'Handover aborted: required ABH/SBH/PM designations are not configured.';
  END IF;

  IF v_inactive_status_id IS NULL THEN
    RAISE EXCEPTION 'Handover aborted: INACTIVE employee status is not configured.';
  END IF;

  IF v_odisha_state_id IS NULL OR v_west_bengal_state_id IS NULL THEN
    RAISE EXCEPTION 'Handover aborted: Odisha or West Bengal state lookup is missing.';
  END IF;

  IF v_approver_l1_role_id IS NULL OR v_approver_l2_role_id IS NULL OR v_admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Handover aborted: APPROVER_L1, APPROVER_L2, or ADMIN role is not configured.';
  END IF;

  IF v_old_employee.id = v_new_employee.id THEN
    RAISE EXCEPTION 'Handover aborted: old and new employee rows are identical.';
  END IF;

  IF v_old_employee.designation_id <> v_sbh_designation_id THEN
    RAISE EXCEPTION 'Handover aborted: Anshuman is no longer mapped to SBH.';
  END IF;

  IF v_new_employee.designation_id NOT IN (v_abh_designation_id, v_sbh_designation_id) THEN
    RAISE EXCEPTION 'Handover aborted: Sambit must currently be ABH or already promoted to SBH.';
  END IF;

  IF v_pm_employee.designation_id <> v_pm_designation_id THEN
    RAISE EXCEPTION 'Handover aborted: Mansoor must remain mapped to PM/HOD for SBH routing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_roles er
    WHERE er.employee_id = v_admin_employee.id
      AND er.role_id = v_admin_role_id
      AND er.is_active = true
  ) THEN
    RAISE EXCEPTION 'Handover aborted: expenseadmin@nxtwave.co.in does not have an active ADMIN role.';
  END IF;

  SELECT d.designation_name
  INTO v_previous_sambit_designation_name
  FROM public.designations d
  WHERE d.id = v_new_employee.designation_id;

  SELECT approver.employee_email
  INTO v_previous_sambit_l3_email
  FROM public.employees approver
  WHERE approver.id = v_new_employee.approval_employee_id_level_3;

  SELECT COUNT(*)
  INTO v_l1_ref_count
  FROM public.employees
  WHERE approval_employee_id_level_1 = v_old_employee.id;

  SELECT COUNT(*)
  INTO v_l2_ref_count
  FROM public.employees
  WHERE approval_employee_id_level_2 = v_old_employee.id;

  SELECT COUNT(*)
  INTO v_l3_ref_count
  FROM public.employees
  WHERE approval_employee_id_level_3 = v_old_employee.id;

  IF v_l2_ref_count > 0 OR v_l3_ref_count > 0 THEN
    RAISE EXCEPTION
      'Handover aborted: unexpected non-L1 references remain for Anshuman (L2: %, L3: %).',
      v_l2_ref_count,
      v_l3_ref_count;
  END IF;

  SELECT COUNT(*)
  INTO v_pending_claim_count
  FROM public.expense_claims c
  JOIN public.claim_statuses cs ON cs.id = c.status_id
  JOIN public.employees owner ON owner.id = c.employee_id
  WHERE cs.is_terminal = false
    AND c.current_approval_level = 1
    AND owner.approval_employee_id_level_1 = v_old_employee.id;

  IF EXISTS (
    SELECT 1
    FROM public.employee_replacements er
    WHERE (er.old_employee_id = v_old_employee.id AND er.new_employee_id <> v_new_employee.id)
       OR (er.new_employee_id = v_new_employee.id AND er.old_employee_id <> v_old_employee.id)
  ) THEN
    RAISE EXCEPTION
      'Handover aborted: employee_replacements already contains a conflicting mapping for Anshuman or Sambit.';
  END IF;

  INSERT INTO public.employee_replacements (
    old_employee_id,
    new_employee_id,
    replaced_by_admin_id,
    replacement_reason
  )
  SELECT
    v_old_employee.id,
    v_new_employee.id,
    v_admin_employee.id,
    v_replacement_reason
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.employee_replacements er
    WHERE er.old_employee_id = v_old_employee.id
      AND er.new_employee_id = v_new_employee.id
  );
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_mutation_count := v_mutation_count + v_row_count;

  INSERT INTO public.employee_states (employee_id, state_id, is_primary)
  SELECT v_new_employee.id, v_odisha_state_id, true
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.employee_states es
    WHERE es.employee_id = v_new_employee.id
      AND es.state_id = v_odisha_state_id
  );
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_mutation_count := v_mutation_count + v_row_count;

  INSERT INTO public.employee_states (employee_id, state_id, is_primary)
  SELECT v_new_employee.id, v_west_bengal_state_id, false
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.employee_states es
    WHERE es.employee_id = v_new_employee.id
      AND es.state_id = v_west_bengal_state_id
  );
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_mutation_count := v_mutation_count + v_row_count;

  UPDATE public.employee_states
  SET is_primary = state_id = v_odisha_state_id
  WHERE employee_id = v_new_employee.id
    AND is_primary IS DISTINCT FROM (state_id = v_odisha_state_id);
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_mutation_count := v_mutation_count + v_row_count;

  INSERT INTO public.employee_roles (employee_id, role_id, is_active)
  VALUES (v_new_employee.id, v_approver_l1_role_id, true)
  ON CONFLICT (employee_id, role_id)
  DO UPDATE SET is_active = true
  WHERE public.employee_roles.is_active IS DISTINCT FROM true;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_mutation_count := v_mutation_count + v_row_count;

  UPDATE public.employee_roles
  SET is_active = false
  WHERE employee_id = v_old_employee.id
    AND role_id = v_approver_l1_role_id
    AND is_active = true;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_mutation_count := v_mutation_count + v_row_count;

  UPDATE public.employee_roles
  SET is_active = false
  WHERE employee_id = v_new_employee.id
    AND role_id = v_approver_l2_role_id
    AND is_active = true;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_mutation_count := v_mutation_count + v_row_count;

  UPDATE public.employees
  SET
    designation_id = v_sbh_designation_id,
    approval_employee_id_level_1 = NULL,
    approval_employee_id_level_2 = NULL,
    approval_employee_id_level_3 = v_pm_employee.id,
    updated_at = now()
  WHERE id = v_new_employee.id
    AND (
      designation_id IS DISTINCT FROM v_sbh_designation_id
      OR approval_employee_id_level_1 IS NOT NULL
      OR approval_employee_id_level_2 IS NOT NULL
      OR approval_employee_id_level_3 IS DISTINCT FROM v_pm_employee.id
    );
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_mutation_count := v_mutation_count + v_row_count;

  UPDATE public.employees
  SET
    approval_employee_id_level_1 = v_new_employee.id,
    updated_at = now()
  WHERE approval_employee_id_level_1 = v_old_employee.id
    AND id <> v_new_employee.id;
  GET DIAGNOSTICS v_reassigned_count = ROW_COUNT;
  v_mutation_count := v_mutation_count + v_reassigned_count;

  UPDATE public.employees
  SET
    employee_status_id = v_inactive_status_id,
    updated_at = now()
  WHERE id = v_old_employee.id
    AND employee_status_id IS DISTINCT FROM v_inactive_status_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_mutation_count := v_mutation_count + v_row_count;

  IF v_mutation_count > 0 THEN
    INSERT INTO public.admin_logs (
      admin_id,
      action_type,
      entity_type,
      entity_id,
      old_value,
      new_value
    )
    VALUES (
      v_admin_employee.id,
      'employee_handover_migration',
      'employee_replacement',
      v_new_employee.id,
      jsonb_build_object(
        'old_employee_id', v_old_employee.id,
        'old_employee_email', v_old_employee.employee_email,
        'new_employee_id', v_new_employee.id,
        'new_employee_email', v_new_employee.employee_email,
        'sambit_previous_designation', coalesce(v_previous_sambit_designation_name, 'UNKNOWN'),
        'sambit_previous_designation_id', v_new_employee.designation_id,
        'sambit_previous_l3_approver_id', v_new_employee.approval_employee_id_level_3,
        'sambit_previous_l3_approver_email', coalesce(v_previous_sambit_l3_email, 'NONE')
      ),
      jsonb_build_object(
        'new_designation_code', 'SBH',
        'new_primary_state', 'Odisha',
        'new_secondary_state', 'West Bengal',
        'new_l3_approver_id', v_pm_employee.id,
        'new_l3_approver_email', v_pm_employee.employee_email,
        'replacement_reason', v_replacement_reason
      )
    )
    RETURNING id INTO v_admin_log_id;

    INSERT INTO public.config_versions (
      source_admin_log_id,
      change_scope,
      change_summary,
      created_by
    )
    VALUES (
      v_admin_log_id,
      'employee_handover',
      format(
        'System handover migrated SBH approval ownership from %s to %s for Odisha and West Bengal. Reassigned %s level-1 approval chains, routed Sambit''s own SBH claims to %s as PM/HOD, and observed %s non-terminal claims pending at execution time. Previous Sambit designation: %s. Previous Sambit L3 approver: %s. Primary state enforced: Odisha.',
        v_old_employee.employee_email,
        v_new_employee.employee_email,
        v_reassigned_count,
        v_pm_employee.employee_email,
        v_pending_claim_count,
        coalesce(v_previous_sambit_designation_name, 'UNKNOWN'),
        coalesce(v_previous_sambit_l3_email, 'NONE')
      ),
      v_admin_employee.id
    );
  END IF;
END
$$;

COMMIT;