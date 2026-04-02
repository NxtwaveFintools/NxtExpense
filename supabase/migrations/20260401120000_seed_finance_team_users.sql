BEGIN;

-- Seed/repair finance-team employees from provided HR list.
-- Safe to re-run: updates existing rows and upserts finance role assignments.
DO $$
DECLARE
  v_fin_designation_id uuid;
  v_active_status_id uuid;
  v_finance_role_id uuid;
  v_employee_role_id uuid;
  v_employee_uuid uuid;
  v_employee_uuid_by_email uuid;
  v_employee_uuid_by_employee_id uuid;
  v_employee_code text;
  v_employee_name text;
  v_employee_email text;
  v_email_domain text;
  v_has_designation_code boolean := false;
  v_now timestamptz := now();
  r record;
BEGIN
  INSERT INTO public.roles (
    role_code,
    role_name,
    is_finance_role,
    is_active,
    updated_at
  )
  VALUES (
    'FINANCE_TEAM',
    'Finance Team',
    true,
    true,
    v_now
  )
  ON CONFLICT (role_code) DO UPDATE
  SET
    role_name = EXCLUDED.role_name,
    is_finance_role = true,
    is_active = true,
    updated_at = v_now;

  SELECT id
  INTO v_fin_designation_id
  FROM public.designations
  WHERE designation_code = 'FIN'
    AND is_active = true
  LIMIT 1;

  IF v_fin_designation_id IS NULL THEN
    RAISE EXCEPTION 'FIN designation is not configured as active.';
  END IF;

  SELECT id
  INTO v_active_status_id
  FROM public.employee_statuses
  WHERE status_code = 'ACTIVE'
  LIMIT 1;

  IF v_active_status_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE employee status is not configured.';
  END IF;

  SELECT id
  INTO v_finance_role_id
  FROM public.roles
  WHERE role_code = 'FINANCE_TEAM'
    AND is_active = true
  LIMIT 1;

  IF v_finance_role_id IS NULL THEN
    RAISE EXCEPTION 'FINANCE_TEAM role is not configured as active.';
  END IF;

  SELECT id
  INTO v_employee_role_id
  FROM public.roles
  WHERE role_code = 'EMPLOYEE'
    AND is_active = true
  LIMIT 1;

  IF v_employee_role_id IS NULL THEN
    RAISE EXCEPTION 'EMPLOYEE role is not configured as active.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'employees'
      AND c.column_name = 'designation_code'
  )
  INTO v_has_designation_code;

  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('NW0005498', 'Mohammed Umanuddin', 'mohammed.umanuddin@nxtwave.co.in'),
        ('NW0001560', 'Madhukar Kurmilla', 'kurmilla.madhukar@nxtwave.co.in'),
        ('NW0004217', 'Puligilla Vishwajith', 'puligilla.vishwajith@nxtwave.co.in'),
        ('NW0001559', 'Konda Chennakesavulu', 'chennakesava.konda@nxtwave.co.in'),
        ('NW0005536', 'Gyara Balraj', 'gyara.balraj@nxtwave.co.in')
    ) AS seed_rows(employee_id, employee_name, employee_email)
  LOOP
    v_employee_code := upper(trim(r.employee_id));
    v_employee_name := trim(r.employee_name);
    v_employee_email := lower(trim(r.employee_email));
    v_email_domain := split_part(v_employee_email, '@', 2);

    IF v_employee_code = '' OR v_employee_name = '' OR v_employee_email = '' THEN
      RAISE EXCEPTION 'Invalid seed row: employee_id, employee_name, and employee_email are required. Row=%', row_to_json(r);
    END IF;

    IF position('@' in v_employee_email) = 0 OR v_email_domain = '' THEN
      RAISE EXCEPTION 'Invalid employee_email for employee_id %: %', v_employee_code, v_employee_email;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.allowed_email_domains d
      WHERE lower(d.domain_name) = v_email_domain
        AND d.is_active = true
    ) THEN
      RAISE EXCEPTION 'Email domain % is not active in allowed_email_domains for employee_id %', v_email_domain, v_employee_code;
    END IF;

    SELECT id
    INTO v_employee_uuid_by_email
    FROM public.employees
    WHERE lower(employee_email) = v_employee_email
    LIMIT 1;

    SELECT id
    INTO v_employee_uuid_by_employee_id
    FROM public.employees
    WHERE employee_id = v_employee_code
    LIMIT 1;

    IF v_employee_uuid_by_email IS NOT NULL
       AND v_employee_uuid_by_employee_id IS NOT NULL
       AND v_employee_uuid_by_email <> v_employee_uuid_by_employee_id THEN
      RAISE EXCEPTION 'Conflict detected: email % and employee_id % map to different employees.', v_employee_email, v_employee_code;
    END IF;

    v_employee_uuid := coalesce(v_employee_uuid_by_email, v_employee_uuid_by_employee_id);

    IF v_employee_uuid IS NULL THEN
      IF v_has_designation_code THEN
        INSERT INTO public.employees (
          employee_id,
          employee_name,
          employee_email,
          designation_id,
          employee_status_id,
          approval_employee_id_level_1,
          approval_employee_id_level_2,
          approval_employee_id_level_3,
          designation_code,
          created_at,
          updated_at
        )
        VALUES (
          v_employee_code,
          v_employee_name,
          v_employee_email,
          v_fin_designation_id,
          v_active_status_id,
          NULL,
          NULL,
          NULL,
          'FIN',
          v_now,
          v_now
        )
        RETURNING id INTO v_employee_uuid;
      ELSE
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
        )
        VALUES (
          v_employee_code,
          v_employee_name,
          v_employee_email,
          v_fin_designation_id,
          v_active_status_id,
          NULL,
          NULL,
          NULL,
          v_now,
          v_now
        )
        RETURNING id INTO v_employee_uuid;
      END IF;
    ELSE
      IF v_has_designation_code THEN
        UPDATE public.employees
        SET
          employee_id = v_employee_code,
          employee_name = v_employee_name,
          employee_email = v_employee_email,
          designation_id = v_fin_designation_id,
          employee_status_id = v_active_status_id,
          approval_employee_id_level_1 = NULL,
          approval_employee_id_level_2 = NULL,
          approval_employee_id_level_3 = NULL,
          designation_code = 'FIN',
          updated_at = v_now
        WHERE id = v_employee_uuid;
      ELSE
        UPDATE public.employees
        SET
          employee_id = v_employee_code,
          employee_name = v_employee_name,
          employee_email = v_employee_email,
          designation_id = v_fin_designation_id,
          employee_status_id = v_active_status_id,
          approval_employee_id_level_1 = NULL,
          approval_employee_id_level_2 = NULL,
          approval_employee_id_level_3 = NULL,
          updated_at = v_now
        WHERE id = v_employee_uuid;
      END IF;
    END IF;

    INSERT INTO public.employee_roles (
      employee_id,
      role_id,
      is_active
    )
    VALUES (
      v_employee_uuid,
      v_finance_role_id,
      true
    )
    ON CONFLICT (employee_id, role_id) DO UPDATE
    SET
      is_active = true;

    INSERT INTO public.employee_roles (
      employee_id,
      role_id,
      is_active
    )
    VALUES (
      v_employee_uuid,
      v_employee_role_id,
      true
    )
    ON CONFLICT (employee_id, role_id) DO UPDATE
    SET
      is_active = true;
  END LOOP;
END;
$$;

COMMIT;
