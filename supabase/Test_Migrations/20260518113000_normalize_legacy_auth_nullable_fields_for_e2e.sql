BEGIN;

-- Normalizes nullable legacy auth columns for E2E users.
-- Some users created through older SQL paths retained NULL token fields,
-- which can break password sign-in on newer auth schema expectations.
DO $$
DECLARE
  v_emails text[] := array[
    'yohan.mutluri@nxtwave.co.in',
    'akshay.e@nxtwave.co.in',
    'bhargavraj.gv@nxtwave.co.in',
    'hari.haran@nxtwave.co.in',
    'nagaraju.madugula@nxtwave.co.in',
    'vignesh.shenoy@nxtwave.co.in',
    'satyapriya.dash@nxtwave.co.in',
    'mansoor@nxtwave.co.in',
    'sreejish.mohanakumar@nxtwave.co.in',
    'harisanthosh.tibirisetty@nxtwave.co.in',
    'finance1@nxtwave.co.in',
    'finance2@nxtwave.co.in',
    'chennakesava.konda@nxtwave.co.in'
  ];
  v_now timestamptz := now();
  v_email text;
BEGIN
  FOREACH v_email IN ARRAY v_emails LOOP
    UPDATE auth.users
    SET
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change = coalesce(email_change, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      reauthentication_token = coalesce(reauthentication_token, ''),
      phone_change = coalesce(phone_change, ''),
      phone_change_token = coalesce(phone_change_token, ''),
      raw_user_meta_data =
        coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('email_verified', true),
      updated_at = v_now
    WHERE lower(email) = lower(v_email)
      AND deleted_at IS NULL;

    RAISE NOTICE 'Auth-nullable-normalized %', v_email;
  END LOOP;
END;
$$;

COMMIT;