-- Fix: add explicit ::text casts in RETURN QUERY SELECT for state/city create+update RPCs.
-- Root cause: cities.city_name is varchar(255) and states.state_code/state_name are varchar(n).
-- When %ROWTYPE variables are used in RETURN QUERY, PostgreSQL requires exact type match
-- against the RETURNS TABLE declaration.  varchar != text → "query does not match function result type".

CREATE OR REPLACE FUNCTION public.admin_create_state_atomic(
  p_state_name text,
  p_confirmation text DEFAULT 'CONFIRM'
)
RETURNS TABLE(id uuid, state_code text, state_name text, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid;
  v_state_name text;
  v_words text[];
  v_base_code text;
  v_code_candidate text;
  v_suffix integer := 1;
  v_next_display_order integer;
  v_inserted public.states%ROWTYPE;
BEGIN
  v_admin_id := public.require_admin_actor();

  IF p_confirmation IS DISTINCT FROM 'CONFIRM' THEN
    RAISE EXCEPTION 'Secondary confirmation is required.';
  END IF;

  v_state_name := nullif(trim(coalesce(p_state_name, '')), '');

  IF v_state_name IS NULL THEN
    RAISE EXCEPTION 'State name is required.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.states s
    WHERE lower(s.state_name) = lower(v_state_name)
  ) THEN
    RAISE EXCEPTION 'State already exists.';
  END IF;

  v_words := regexp_split_to_array(
    regexp_replace(v_state_name, '[^A-Za-z0-9 ]', ' ', 'g'),
    E'\\s+'
  );

  IF array_length(v_words, 1) IS NULL THEN
    RAISE EXCEPTION 'State name must contain letters or numbers.';
  END IF;

  IF array_length(v_words, 1) >= 2 THEN
    v_base_code := upper(left(v_words[1], 1) || left(v_words[2], 1));
  ELSE
    v_base_code := upper(left(v_words[1], 2));
  END IF;

  IF length(v_base_code) < 2 THEN
    v_base_code := upper(right(v_base_code || 'X', 2));
  END IF;

  v_code_candidate := v_base_code;

  WHILE EXISTS (
    SELECT 1
    FROM public.states s
    WHERE upper(s.state_code) = v_code_candidate
  ) LOOP
    v_suffix := v_suffix + 1;
    v_code_candidate := v_base_code || lpad(v_suffix::text, 2, '0');
  END LOOP;

  SELECT coalesce(max(s.display_order), 0) + 1
  INTO v_next_display_order
  FROM public.states s;

  INSERT INTO public.states (
    state_code,
    state_name,
    is_active,
    display_order,
    created_at,
    updated_at
  )
  VALUES (
    v_code_candidate,
    v_state_name,
    true,
    v_next_display_order,
    now(),
    now()
  )
  RETURNING * INTO v_inserted;

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'create',
    'state',
    v_inserted.id,
    NULL,
    jsonb_build_object(
      'state_code', v_inserted.state_code,
      'state_name', v_inserted.state_name,
      'is_active', v_inserted.is_active
    )
  );

  RETURN QUERY
  SELECT
    v_inserted.id,
    v_inserted.state_code::text,
    v_inserted.state_name::text,
    v_inserted.is_active;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_state_atomic(
  p_id uuid,
  p_state_name text,
  p_confirmation text DEFAULT 'CONFIRM'
)
RETURNS TABLE(id uuid, state_code text, state_name text, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid;
  v_state_name text;
  v_old public.states%ROWTYPE;
  v_updated public.states%ROWTYPE;
BEGIN
  v_admin_id := public.require_admin_actor();

  IF p_confirmation IS DISTINCT FROM 'CONFIRM' THEN
    RAISE EXCEPTION 'Secondary confirmation is required.';
  END IF;

  v_state_name := nullif(trim(coalesce(p_state_name, '')), '');

  IF v_state_name IS NULL THEN
    RAISE EXCEPTION 'State name is required.';
  END IF;

  SELECT *
  INTO v_old
  FROM public.states s
  WHERE s.id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'State not found.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.states s
    WHERE s.id <> p_id
      AND lower(s.state_name) = lower(v_state_name)
  ) THEN
    RAISE EXCEPTION 'State already exists.';
  END IF;

  UPDATE public.states s
  SET state_name = v_state_name,
      updated_at = now()
  WHERE s.id = p_id
  RETURNING * INTO v_updated;

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'update',
    'state',
    v_updated.id,
    jsonb_build_object(
      'state_code', v_old.state_code,
      'state_name', v_old.state_name,
      'is_active', v_old.is_active
    ),
    jsonb_build_object(
      'state_code', v_updated.state_code,
      'state_name', v_updated.state_name,
      'is_active', v_updated.is_active
    )
  );

  RETURN QUERY
  SELECT
    v_updated.id,
    v_updated.state_code::text,
    v_updated.state_name::text,
    v_updated.is_active;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_city_atomic(
  p_state_id uuid,
  p_city_name text,
  p_confirmation text DEFAULT 'CONFIRM'
)
RETURNS TABLE(id uuid, city_name text, state_id uuid, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid;
  v_state public.states%ROWTYPE;
  v_city_name text;
  v_next_display_order integer;
  v_inserted public.cities%ROWTYPE;
BEGIN
  v_admin_id := public.require_admin_actor();

  IF p_confirmation IS DISTINCT FROM 'CONFIRM' THEN
    RAISE EXCEPTION 'Secondary confirmation is required.';
  END IF;

  v_city_name := nullif(trim(coalesce(p_city_name, '')), '');

  IF v_city_name IS NULL THEN
    RAISE EXCEPTION 'City name is required.';
  END IF;

  SELECT *
  INTO v_state
  FROM public.states s
  WHERE s.id = p_state_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'State not found.';
  END IF;

  IF v_state.is_active = false THEN
    RAISE EXCEPTION 'Cannot add city to an inactive state.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cities c
    WHERE c.state_id = p_state_id
      AND lower(c.city_name) = lower(v_city_name)
  ) THEN
    RAISE EXCEPTION 'City already exists for this state.';
  END IF;

  SELECT coalesce(max(c.display_order), 0) + 1
  INTO v_next_display_order
  FROM public.cities c
  WHERE c.state_id = p_state_id;

  INSERT INTO public.cities (
    city_name,
    state_id,
    is_active,
    display_order,
    created_at,
    updated_at
  )
  VALUES (
    v_city_name,
    p_state_id,
    true,
    v_next_display_order,
    now(),
    now()
  )
  RETURNING * INTO v_inserted;

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'create',
    'city',
    v_inserted.id,
    NULL,
    jsonb_build_object(
      'city_name', v_inserted.city_name,
      'state_id', v_inserted.state_id,
      'is_active', v_inserted.is_active
    )
  );

  RETURN QUERY
  SELECT
    v_inserted.id,
    v_inserted.city_name::text,
    v_inserted.state_id,
    v_inserted.is_active;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_city_atomic(
  p_id uuid,
  p_city_name text,
  p_confirmation text DEFAULT 'CONFIRM'
)
RETURNS TABLE(id uuid, city_name text, state_id uuid, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid;
  v_city_name text;
  v_old public.cities%ROWTYPE;
  v_updated public.cities%ROWTYPE;
BEGIN
  v_admin_id := public.require_admin_actor();

  IF p_confirmation IS DISTINCT FROM 'CONFIRM' THEN
    RAISE EXCEPTION 'Secondary confirmation is required.';
  END IF;

  v_city_name := nullif(trim(coalesce(p_city_name, '')), '');

  IF v_city_name IS NULL THEN
    RAISE EXCEPTION 'City name is required.';
  END IF;

  SELECT *
  INTO v_old
  FROM public.cities c
  WHERE c.id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'City not found.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cities c
    WHERE c.id <> p_id
      AND c.state_id = v_old.state_id
      AND lower(c.city_name) = lower(v_city_name)
  ) THEN
    RAISE EXCEPTION 'City already exists for this state.';
  END IF;

  UPDATE public.cities c
  SET city_name = v_city_name,
      updated_at = now()
  WHERE c.id = p_id
  RETURNING * INTO v_updated;

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'update',
    'city',
    v_updated.id,
    jsonb_build_object(
      'city_name', v_old.city_name,
      'state_id', v_old.state_id,
      'is_active', v_old.is_active
    ),
    jsonb_build_object(
      'city_name', v_updated.city_name,
      'state_id', v_updated.state_id,
      'is_active', v_updated.is_active
    )
  );

  RETURN QUERY
  SELECT
    v_updated.id,
    v_updated.city_name::text,
    v_updated.state_id,
    v_updated.is_active;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_create_state_atomic(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_state_atomic(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_city_atomic(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_city_atomic(uuid, text, text) TO authenticated, service_role;
