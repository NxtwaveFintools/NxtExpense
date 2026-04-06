BEGIN;

DO $$
DECLARE
  v_old_email CONSTANT text := 'srinivasa.rahulgupta@nxtwave.co.in';
  v_new_email CONSTANT text := 'rahulgupta.srinivasa@nxtwave.co.in';
  v_new_email_exists boolean;
  v_rows_updated integer;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE lower(employee_email) = lower(v_new_email)
  )
  INTO v_new_email_exists;

  IF v_new_email_exists THEN
    RAISE EXCEPTION
      'Cannot change employee email to % because it already exists in public.employees.',
      v_new_email;
  END IF;

  UPDATE public.employees
  SET employee_email = v_new_email,
      updated_at = now()
  WHERE lower(employee_email) = lower(v_old_email);

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly 1 employee row for old email %, updated % row(s).',
      v_old_email,
      v_rows_updated;
  END IF;
END;
$$;

COMMIT;
