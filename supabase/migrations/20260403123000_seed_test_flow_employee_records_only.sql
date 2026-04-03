BEGIN;

-- Safe replacement for test-flow seed:
-- This migration manages only public schema records (employees/roles/approval chain).
-- Auth users must be provisioned via Auth Admin API script, not direct SQL to auth.* tables.
DO $$
DECLARE
  v_now timestamptz := now();
  v_active_status_id uuid;
  v_employee_role_id uuid;
  v_finance_role_id uuid;
  v_sro_designation_id uuid;
  v_sbh_designation_id uuid;
  v_pm_designation_id uuid;
  v_fin_designation_id uuid;
  v_employee_code text;
  v_employee_name text;
  v_employee_email text;
  v_email_domain text;
  v_designation_code text;
  v_designation_id uuid;
  v_should_have_finance_role boolean;
  v_employee_uuid uuid;
  v_employee_uuid_by_email uuid;
  v_employee_uuid_by_code uuid;
  v_sro_employee_uuid uuid;
  v_sbh_employee_uuid uuid;
  v_pm_employee_uuid uuid;
  v_fin_employee_uuid uuid;
  r record;
BEGIN
  INSERT INTO public.roles (role_code, role_name, is_finance_role, is_active, updated_at)
  VALUES ('FINANCE_TEAM', 'Finance Team', true, true, v_now)
  ON CONFLICT (role_code) DO UPDATE
  SET role_name = EXCLUDED.role_name, is_finance_role = true, is_active = true, updated_at = v_now;

  SELECT id INTO v_active_status_id FROM public.employee_statuses WHERE status_code = 'ACTIVE' LIMIT 1;
  IF v_active_status_id IS NULL THEN RAISE EXCEPTION 'ACTIVE employee status is not configured.'; END IF;

  SELECT id INTO v_employee_role_id FROM public.roles WHERE role_code = 'EMPLOYEE' AND is_active = true LIMIT 1;
  IF v_employee_role_id IS NULL THEN RAISE EXCEPTION 'EMPLOYEE role is not configured as active.'; END IF;

  SELECT id INTO v_finance_role_id FROM public.roles WHERE role_code = 'FINANCE_TEAM' AND is_active = true LIMIT 1;
  IF v_finance_role_id IS NULL THEN RAISE EXCEPTION 'FINANCE_TEAM role is not configured as active.'; END IF;

  SELECT id INTO v_sro_designation_id FROM public.designations WHERE designation_code = 'SRO' AND is_active = true LIMIT 1;
  SELECT id INTO v_sbh_designation_id FROM public.designations WHERE designation_code = 'SBH' AND is_active = true LIMIT 1;
  SELECT id INTO v_pm_designation_id FROM public.designations WHERE designation_code = 'PM' AND is_active = true LIMIT 1;
  SELECT id INTO v_fin_designation_id FROM public.designations WHERE designation_code = 'FIN' AND is_active = true LIMIT 1;

  IF v_sro_designation_id IS NULL OR v_sbh_designation_id IS NULL OR v_pm_designation_id IS NULL OR v_fin_designation_id IS NULL THEN
    RAISE EXCEPTION 'One or more required designations (SRO, SBH, PM, FIN) are missing or inactive.';
  END IF;

  FOR r IN
    SELECT * FROM (
      VALUES
        ('TSTSRO001', 'Test Flow SRO', 'sro@nxtwave.co.in', 'SRO'),
        ('TSTSBH001', 'Test Flow SBH', 'sbh@nxtwave.co.in', 'SBH'),
        ('TSTPM001', 'Test Flow PM', 'hod@nxtwave.co.in', 'PM'),
        ('TSTFIN001', 'Test Flow Finance 1', 'finance1@nxtwave.co.in', 'FIN')
    ) AS seed_rows(employee_code, employee_name, employee_email, designation_code)
  LOOP
    v_employee_code := upper(trim(r.employee_code));
    v_employee_name := trim(r.employee_name);
    v_employee_email := lower(trim(r.employee_email));
    v_designation_code := upper(trim(r.designation_code));
    v_email_domain := split_part(v_employee_email, '@', 2);
    v_should_have_finance_role := (v_designation_code = 'FIN');

    IF v_employee_code = '' OR v_employee_name = '' OR v_employee_email = '' THEN
      RAISE EXCEPTION 'Invalid seed row: employee_code, employee_name, and employee_email are required. Row=%', row_to_json(r);
    END IF;

    IF position('@' in v_employee_email) = 0 OR v_email_domain = '' THEN
      RAISE EXCEPTION 'Invalid employee_email for employee_code %: %', v_employee_code, v_employee_email;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.allowed_email_domains d
      WHERE lower(d.domain_name) = v_email_domain AND d.is_active = true
    ) THEN
      RAISE EXCEPTION 'Email domain % is not active in allowed_email_domains for employee_code %', v_email_domain, v_employee_code;
    END IF;

    CASE v_designation_code
      WHEN 'SRO' THEN v_designation_id := v_sro_designation_id;
      WHEN 'SBH' THEN v_designation_id := v_sbh_designation_id;
      WHEN 'PM' THEN v_designation_id := v_pm_designation_id;
      WHEN 'FIN' THEN v_designation_id := v_fin_designation_id;
      ELSE RAISE EXCEPTION 'Unsupported designation_code % for employee_email %', v_designation_code, v_employee_email;
    END CASE;

    SELECT id INTO v_employee_uuid_by_email FROM public.employees WHERE lower(employee_email) = v_employee_email LIMIT 1;
    SELECT id INTO v_employee_uuid_by_code FROM public.employees WHERE employee_id = v_employee_code LIMIT 1;

    IF v_employee_uuid_by_email IS NOT NULL
       AND v_employee_uuid_by_code IS NOT NULL
       AND v_employee_uuid_by_email <> v_employee_uuid_by_code THEN
      RAISE EXCEPTION 'Conflict detected: email % and employee_code % map to different employees.', v_employee_email, v_employee_code;
    END IF;

    v_employee_uuid := coalesce(v_employee_uuid_by_email, v_employee_uuid_by_code);

    IF v_employee_uuid IS NULL THEN
      INSERT INTO public.employees (
        employee_id,
        employee_name,
        employee_email,
        designation_id,
        employee_status_id,
        approval_employee_id_level_1,
        approval_employee_id_level_2,
        approval_employee_id_level_3,
        created_at,
        updated_at
      ) VALUES (
        v_employee_code,
        v_employee_name,
        v_employee_email,
        v_designation_id,
        v_active_status_id,
        NULL,
        NULL,
        NULL,
        v_now,
        v_now
      ) RETURNING id INTO v_employee_uuid;
    ELSE
      UPDATE public.employees
      SET
        employee_id = v_employee_code,
        employee_name = v_employee_name,
        employee_email = v_employee_email,
        designation_id = v_designation_id,
        employee_status_id = v_active_status_id,
        updated_at = v_now
      WHERE id = v_employee_uuid;
    END IF;

    INSERT INTO public.employee_roles (employee_id, role_id, is_active)
    VALUES (v_employee_uuid, v_employee_role_id, true)
    ON CONFLICT (employee_id, role_id) DO UPDATE SET is_active = true;

    IF v_should_have_finance_role THEN
      INSERT INTO public.employee_roles (employee_id, role_id, is_active)
      VALUES (v_employee_uuid, v_finance_role_id, true)
      ON CONFLICT (employee_id, role_id) DO UPDATE SET is_active = true;
    ELSE
      UPDATE public.employee_roles
      SET is_active = false
      WHERE employee_id = v_employee_uuid AND role_id = v_finance_role_id;
    END IF;

    IF v_employee_email = 'sro@nxtwave.co.in' THEN
      v_sro_employee_uuid := v_employee_uuid;
    ELSIF v_employee_email = 'sbh@nxtwave.co.in' THEN
      v_sbh_employee_uuid := v_employee_uuid;
    ELSIF v_employee_email = 'hod@nxtwave.co.in' THEN
      v_pm_employee_uuid := v_employee_uuid;
    ELSIF v_employee_email = 'finance1@nxtwave.co.in' THEN
      v_fin_employee_uuid := v_employee_uuid;
    END IF;
  END LOOP;

  IF v_sro_employee_uuid IS NULL OR v_sbh_employee_uuid IS NULL OR v_pm_employee_uuid IS NULL OR v_fin_employee_uuid IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve all seeded employee IDs for test flow account wiring.';
  END IF;

  UPDATE public.employees
  SET
    approval_employee_id_level_1 = v_sbh_employee_uuid,
    approval_employee_id_level_2 = NULL,
    approval_employee_id_level_3 = v_pm_employee_uuid,
    updated_at = v_now
  WHERE id = v_sro_employee_uuid;

  UPDATE public.employees
  SET
    approval_employee_id_level_1 = NULL,
    approval_employee_id_level_2 = NULL,
    approval_employee_id_level_3 = v_pm_employee_uuid,
    updated_at = v_now
  WHERE id = v_sbh_employee_uuid;

  UPDATE public.employees
  SET
    approval_employee_id_level_1 = NULL,
    approval_employee_id_level_2 = v_pm_employee_uuid,
    approval_employee_id_level_3 = v_pm_employee_uuid,
    updated_at = v_now
  WHERE id = v_pm_employee_uuid;

  UPDATE public.employees
  SET
    approval_employee_id_level_1 = NULL,
    approval_employee_id_level_2 = NULL,
    approval_employee_id_level_3 = NULL,
    updated_at = v_now
  WHERE id = v_fin_employee_uuid;
END;
$$;

COMMIT;