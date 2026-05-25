BEGIN;
 
-- Enables email/password login for Playwright E2E accounts if the auth user exists.
-- Idempotent: skips accounts that are not present and updates existing entries safely.
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
    'finance2@nxtwave.co.in'
  ];
  v_password constant text := 'Password@123';
  v_now timestamptz := now();
  v_email text;
  v_user_id uuid;
  v_password_hash text;
  v_app_meta_data jsonb;
  v_providers jsonb;
BEGIN
  IF to_regprocedure('extensions.crypt(text,text)') IS NOT NULL
     AND to_regprocedure('extensions.gen_salt(text)') IS NOT NULL THEN
    EXECUTE 'select extensions.crypt($1, extensions.gen_salt(''bf''))'
    INTO v_password_hash
    USING v_password;
  ELSIF to_regprocedure('public.crypt(text,text)') IS NOT NULL
     AND to_regprocedure('public.gen_salt(text)') IS NOT NULL THEN
    EXECUTE 'select public.crypt($1, public.gen_salt(''bf''))'
    INTO v_password_hash
    USING v_password;
  ELSIF to_regprocedure('crypt(text,text)') IS NOT NULL
     AND to_regprocedure('gen_salt(text)') IS NOT NULL THEN
    EXECUTE 'select crypt($1, gen_salt(''bf''))'
    INTO v_password_hash
    USING v_password;
  ELSE
    RAISE EXCEPTION 'Password hash functions crypt/gen_salt are not available. Enable pgcrypto in this environment.';
  END IF;
 
  FOREACH v_email IN ARRAY v_emails LOOP
    SELECT id, coalesce(raw_app_meta_data, '{}'::jsonb)
    INTO v_user_id, v_app_meta_data
    FROM auth.users
    WHERE lower(email) = lower(v_email)
      AND deleted_at IS NULL
    LIMIT 1;
 
    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      v_app_meta_data := jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email')
      );
 
      INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_sso_user,
        aud,
        role,
        created_at,
        updated_at
      )
      VALUES (
        v_user_id,
        lower(v_email),
        v_password_hash,
        v_now,
        v_app_meta_data,
        '{}'::jsonb,
        false,
        'authenticated',
        'authenticated',
        v_now,
        v_now
      );
    ELSE
      IF jsonb_typeof(v_app_meta_data -> 'providers') = 'array' THEN
        v_providers := v_app_meta_data -> 'providers';
      ELSE
        v_providers := '[]'::jsonb;
      END IF;
 
      IF NOT (v_providers @> '["email"]'::jsonb) THEN
        v_providers := v_providers || '["email"]'::jsonb;
      END IF;
 
      v_app_meta_data := v_app_meta_data || jsonb_build_object('providers', v_providers);
 
      IF coalesce(v_app_meta_data ->> 'provider', '') = '' THEN
        v_app_meta_data := v_app_meta_data || jsonb_build_object('provider', 'email');
      END IF;
 
      UPDATE auth.users
      SET
        encrypted_password = v_password_hash,
        email_confirmed_at = coalesce(email_confirmed_at, v_now),
        raw_app_meta_data = v_app_meta_data,
        is_sso_user = false,
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
      lower(v_email),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', lower(v_email)),
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
 
    RAISE NOTICE 'Password-enabled %', v_email;
  END LOOP;
END;
$$;
 
COMMIT;