BEGIN;

-- Enables email/password login for an existing ZBH auth user.
-- This migration updates only the target account and does not create auth users.
DO $$
DECLARE
  v_target_email constant text := 'harisanthosh.tibirisetty@nxtwave.co.in';
  v_password constant text := 'Password@123';
  v_now timestamptz := now();
  v_user_id uuid;
  v_password_hash text;
  v_app_meta_data jsonb;
  v_providers jsonb;
BEGIN
  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_target_email)
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION
      'Auth user not found for %. Provision this account first via Auth Admin API script.',
      v_target_email;
  END IF;

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
    RAISE EXCEPTION
      'Password hash functions crypt/gen_salt are not available. Enable pgcrypto in this environment.';
  END IF;

  SELECT coalesce(raw_app_meta_data, '{}'::jsonb)
  INTO v_app_meta_data
  FROM auth.users
  WHERE id = v_user_id;

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
    lower(v_target_email),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(v_target_email)),
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
END;
$$;

COMMIT;
