BEGIN;

-- Seeds/repairs the primary expense admin login as an idempotent migration.
-- If the auth user already exists, this migration preserves the existing password.
DO $$
DECLARE
  v_email constant text := 'expenseadmin@nxtwave.co.in';
  v_password constant text := 'Password@123';
  v_now timestamptz := now();
  v_user_id uuid;
  v_admin_designation_id uuid;
  v_active_status_id uuid;
  v_admin_role_id uuid;
BEGIN
  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_sso_user,
      is_anonymous
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      v_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      v_now,
      v_now,
      false,
      false
    );
  ELSE
    UPDATE auth.users
    SET
      email_confirmed_at = coalesce(email_confirmed_at, v_now),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      updated_at = v_now
    WHERE id = v_user_id;
  END IF;

  INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_email,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_now,
    v_now,
    v_now
  )
  ON CONFLICT (provider_id, provider) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    identity_data = EXCLUDED.identity_data,
    updated_at = v_now;

  SELECT id
  INTO v_admin_designation_id
  FROM public.designations
  WHERE designation_code = 'ADM'
  LIMIT 1;

  IF v_admin_designation_id IS NULL THEN
    RAISE EXCEPTION 'ADM designation is not configured.';
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
  INTO v_admin_role_id
  FROM public.roles
  WHERE role_code = 'ADMIN'
  LIMIT 1;

  IF v_admin_role_id IS NULL THEN
    RAISE EXCEPTION 'ADMIN role is not configured.';
  END IF;

  INSERT INTO public.employees (
    employee_id,
    employee_name,
    employee_email,
    designation_id,
    employee_status_id,
    designation_code,
    created_at,
    updated_at
  )
  VALUES (
    'ADMIN001',
    'Expense Admin',
    v_email,
    v_admin_designation_id,
    v_active_status_id,
    'ADM',
    v_now,
    v_now
  )
  ON CONFLICT (employee_email) DO UPDATE
  SET
    employee_name = EXCLUDED.employee_name,
    designation_id = EXCLUDED.designation_id,
    employee_status_id = EXCLUDED.employee_status_id,
    designation_code = EXCLUDED.designation_code,
    updated_at = v_now;

  INSERT INTO public.employee_roles (
    employee_id,
    role_id,
    is_active
  )
  SELECT
    e.id,
    v_admin_role_id,
    true
  FROM public.employees e
  WHERE lower(e.employee_email) = lower(v_email)
  ON CONFLICT (employee_id, role_id) DO UPDATE
  SET
    is_active = true;
END;
$$;

COMMIT;
