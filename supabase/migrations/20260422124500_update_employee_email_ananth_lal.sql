BEGIN;

DO $$
DECLARE
  v_old_email CONSTANT text := 'ananth.lal@nxtwave.co.in';
  v_new_email CONSTANT text := 'lal.ananth@nxtwave.co.in';
  v_now timestamptz := now();
  v_new_domain text;

  v_old_employee_id uuid;
  v_new_employee_id uuid;

  v_old_auth_user_id uuid;
  v_new_auth_user_id uuid;

  v_rows_updated integer;
BEGIN
  IF lower(v_old_email) = lower(v_new_email) THEN
    RAISE EXCEPTION 'Old and new emails are identical: %', v_old_email;
  END IF;

  v_new_domain := split_part(lower(v_new_email), '@', 2);

  IF position('@' IN v_new_email) = 0 OR v_new_domain = '' THEN
    RAISE EXCEPTION 'Invalid new email format: %', v_new_email;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.allowed_email_domains d
    WHERE lower(d.domain_name) = v_new_domain
      AND d.is_active = true
  ) THEN
    RAISE EXCEPTION
      'New email domain % is not active in public.allowed_email_domains.',
      v_new_domain;
  END IF;

  SELECT e.id
  INTO v_old_employee_id
  FROM public.employees e
  WHERE lower(e.employee_email) = lower(v_old_email)
  LIMIT 1;

  SELECT e.id
  INTO v_new_employee_id
  FROM public.employees e
  WHERE lower(e.employee_email) = lower(v_new_email)
  LIMIT 1;

  IF v_old_employee_id IS NULL AND v_new_employee_id IS NOT NULL THEN
    RAISE NOTICE 'Employee email already updated to %.', v_new_email;
  ELSIF v_old_employee_id IS NULL THEN
    RAISE EXCEPTION
      'Old employee email % not found in public.employees.',
      v_old_email;
  ELSIF v_new_employee_id IS NOT NULL AND v_new_employee_id <> v_old_employee_id THEN
    RAISE EXCEPTION
      'Cannot update to % because it is already used by a different employee.',
      v_new_email;
  ELSE
    UPDATE public.employees
    SET
      employee_email = lower(v_new_email),
      updated_at = v_now
    WHERE id = v_old_employee_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated <> 1 THEN
      RAISE EXCEPTION
        'Expected exactly 1 employee row update, updated % row(s).',
        v_rows_updated;
    END IF;
  END IF;

  SELECT u.id
  INTO v_old_auth_user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(v_old_email)
    AND u.deleted_at IS NULL
  LIMIT 1;

  SELECT u.id
  INTO v_new_auth_user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(v_new_email)
    AND u.deleted_at IS NULL
  LIMIT 1;

  IF v_old_auth_user_id IS NULL AND v_new_auth_user_id IS NOT NULL THEN
    RAISE NOTICE 'Auth user email already updated to %.', v_new_email;
  ELSIF v_old_auth_user_id IS NOT NULL
     AND v_new_auth_user_id IS NOT NULL
     AND v_new_auth_user_id <> v_old_auth_user_id THEN
    RAISE EXCEPTION
      'Cannot update auth.users email to % because another auth user already has it.',
      v_new_email;
  ELSIF v_old_auth_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET
      email = lower(v_new_email),
      updated_at = v_now
    WHERE id = v_old_auth_user_id;

    IF EXISTS (
      SELECT 1
      FROM auth.identities i
      WHERE lower(i.provider) = 'email'
        AND lower(i.provider_id) = lower(v_new_email)
        AND i.user_id <> v_old_auth_user_id
    ) THEN
      RAISE EXCEPTION
        'Cannot update auth.identities provider_id to % because it already exists for another user.',
        v_new_email;
    END IF;

    UPDATE auth.identities
    SET
      provider_id = lower(v_new_email),
      email = lower(v_new_email),
      identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', lower(v_new_email)),
      updated_at = v_now
    WHERE user_id = v_old_auth_user_id
      AND lower(provider) = 'email';
  END IF;
END;
$$;

COMMIT;