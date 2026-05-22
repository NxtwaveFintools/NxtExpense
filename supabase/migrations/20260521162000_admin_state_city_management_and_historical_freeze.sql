-- Admin-managed state and city configuration
-- plus historical location freeze for claims.
--
-- This migration is intentionally idempotent where practical.

ALTER TABLE public.cities
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.expense_claims
ADD COLUMN IF NOT EXISTS outstation_state_name_snapshot text,
ADD COLUMN IF NOT EXISTS outstation_city_name_snapshot text,
ADD COLUMN IF NOT EXISTS from_city_name_snapshot text,
ADD COLUMN IF NOT EXISTS to_city_name_snapshot text;

UPDATE public.expense_claims ec
SET outstation_state_name_snapshot = s.state_name
FROM public.states s
WHERE ec.outstation_state_id = s.id
  AND coalesce(ec.outstation_state_name_snapshot, '') = '';

UPDATE public.expense_claims ec
SET outstation_city_name_snapshot = c.city_name
FROM public.cities c
WHERE ec.outstation_city_id = c.id
  AND coalesce(ec.outstation_city_name_snapshot, '') = '';

UPDATE public.expense_claims ec
SET from_city_name_snapshot = c.city_name
FROM public.cities c
WHERE ec.from_city_id = c.id
  AND coalesce(ec.from_city_name_snapshot, '') = '';

UPDATE public.expense_claims ec
SET to_city_name_snapshot = c.city_name
FROM public.cities c
WHERE ec.to_city_id = c.id
  AND coalesce(ec.to_city_name_snapshot, '') = '';

CREATE OR REPLACE FUNCTION public.populate_claim_location_name_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.outstation_state_name_snapshot := NULL;
  NEW.outstation_city_name_snapshot := NULL;
  NEW.from_city_name_snapshot := NULL;
  NEW.to_city_name_snapshot := NULL;

  IF NEW.outstation_state_id IS NOT NULL THEN
    SELECT s.state_name
    INTO NEW.outstation_state_name_snapshot
    FROM public.states s
    WHERE s.id = NEW.outstation_state_id;
  END IF;

  IF NEW.outstation_city_id IS NOT NULL THEN
    SELECT c.city_name
    INTO NEW.outstation_city_name_snapshot
    FROM public.cities c
    WHERE c.id = NEW.outstation_city_id;
  END IF;

  IF NEW.from_city_id IS NOT NULL THEN
    SELECT c.city_name
    INTO NEW.from_city_name_snapshot
    FROM public.cities c
    WHERE c.id = NEW.from_city_id;
  END IF;

  IF NEW.to_city_id IS NOT NULL THEN
    SELECT c.city_name
    INTO NEW.to_city_name_snapshot
    FROM public.cities c
    WHERE c.id = NEW.to_city_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_expense_claims_location_snapshot ON public.expense_claims;

CREATE TRIGGER trg_expense_claims_location_snapshot
BEFORE INSERT OR UPDATE OF outstation_state_id, outstation_city_id, from_city_id, to_city_id
ON public.expense_claims
FOR EACH ROW
EXECUTE FUNCTION public.populate_claim_location_name_snapshots();

CREATE OR REPLACE FUNCTION public.bump_config_version_from_admin_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.entity_type IN (
    'designation',
    'work_location',
    'vehicle_type',
    'vehicle_type_rates',
    'expense_rate_amount',
    'expense_rate_status',
    'approval_chain',
    'designation_vehicle_permission',
    'validation_rule',
    'system_setting',
    'approval_flow',
    'state',
    'city'
  ) THEN
    INSERT INTO public.config_versions (
      source_admin_log_id,
      change_scope,
      change_summary,
      created_by
    )
    VALUES (
      NEW.id,
      NEW.entity_type,
      concat('Admin action: ', NEW.action_type, ' on ', NEW.entity_type),
      NEW.admin_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.capture_claim_config_snapshot_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_version_id uuid;
  v_snapshot jsonb;
BEGIN
  SELECT id
  INTO v_version_id
  FROM public.config_versions
  ORDER BY version_number DESC
  LIMIT 1;

  IF v_version_id IS NULL THEN
    INSERT INTO public.config_versions (change_scope, change_summary)
    VALUES ('bootstrap', 'Auto-created baseline configuration version.')
    RETURNING id INTO v_version_id;
  END IF;

  v_snapshot := jsonb_build_object(
    'claim_context',
    jsonb_build_object(
      'claim_id', NEW.id,
      'claim_date', NEW.claim_date,
      'employee_id', NEW.employee_id,
      'designation_id', NEW.designation_id,
      'work_location_id', NEW.work_location_id,
      'base_location_day_type_code', NEW.base_location_day_type_code,
      'vehicle_type_id', NEW.vehicle_type_id,
      'outstation_state_id', NEW.outstation_state_id,
      'has_intercity_travel', NEW.has_intercity_travel,
      'has_intracity_travel', NEW.has_intracity_travel,
      'intercity_own_vehicle_used', NEW.intercity_own_vehicle_used,
      'intracity_own_vehicle_used', NEW.intracity_own_vehicle_used
    ),
    'state_city_master',
    jsonb_build_object(
      'outstation_state',
      CASE
        WHEN NEW.outstation_state_id IS NULL THEN NULL::jsonb
        ELSE jsonb_build_object(
          'id', NEW.outstation_state_id,
          'name', NEW.outstation_state_name_snapshot
        )
      END,
      'outstation_city',
      CASE
        WHEN NEW.outstation_city_id IS NULL THEN NULL::jsonb
        ELSE jsonb_build_object(
          'id', NEW.outstation_city_id,
          'name', NEW.outstation_city_name_snapshot
        )
      END,
      'from_city',
      CASE
        WHEN NEW.from_city_id IS NULL THEN NULL::jsonb
        ELSE jsonb_build_object(
          'id', NEW.from_city_id,
          'name', NEW.from_city_name_snapshot
        )
      END,
      'to_city',
      CASE
        WHEN NEW.to_city_id IS NULL THEN NULL::jsonb
        ELSE jsonb_build_object(
          'id', NEW.to_city_id,
          'name', NEW.to_city_name_snapshot
        )
      END
    ),
    'designation',
    (
      SELECT to_jsonb(d)
      FROM public.designations d
      WHERE d.id = NEW.designation_id
    ),
    'work_location',
    (
      SELECT to_jsonb(wl)
      FROM public.work_locations wl
      WHERE wl.id = NEW.work_location_id
    ),
    'vehicle_type',
    (
      SELECT to_jsonb(vt)
      FROM public.vehicle_types vt
      WHERE vt.id = NEW.vehicle_type_id
    ),
    'approval_flow',
    (
      SELECT to_jsonb(af)
      FROM public.designation_approval_flow af
      WHERE af.designation_id = NEW.designation_id
        AND af.is_active = true
      ORDER BY af.created_at DESC
      LIMIT 1
    ),
    'allowed_vehicle_types',
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(vt) ORDER BY vt.display_order)
        FROM public.designation_vehicle_permissions p
        JOIN public.vehicle_types vt ON vt.id = p.vehicle_type_id
        WHERE p.designation_id = NEW.designation_id
      ),
      '[]'::jsonb
    ),
    'effective_expense_rates',
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(er) ORDER BY er.expense_type, er.effective_from DESC)
        FROM public.expense_rates er
        WHERE er.location_id = NEW.work_location_id
          AND er.is_active = true
          AND er.effective_from <= NEW.claim_date
          AND (er.effective_to IS NULL OR er.effective_to >= NEW.claim_date)
          AND (er.designation_id IS NULL OR er.designation_id = NEW.designation_id)
      ),
      '[]'::jsonb
    ),
    'validation_rules',
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(vr) ORDER BY vr.rule_code)
        FROM public.validation_rules vr
        WHERE vr.is_active = true
      ),
      '[]'::jsonb
    ),
    'system_settings',
    COALESCE(
      (
        SELECT jsonb_object_agg(ss.setting_key, ss.setting_value)
        FROM public.system_settings ss
        WHERE ss.is_active = true
      ),
      '{}'::jsonb
    )
  );

  INSERT INTO public.claim_config_snapshots (
    claim_id,
    config_version_id,
    snapshot_data
  )
  VALUES (
    NEW.id,
    v_version_id,
    v_snapshot
  )
  ON CONFLICT (claim_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

UPDATE public.claim_config_snapshots ccs
SET snapshot_data = jsonb_set(
  coalesce(ccs.snapshot_data, '{}'::jsonb),
  '{state_city_master}',
  jsonb_build_object(
    'outstation_state',
    CASE
      WHEN ec.outstation_state_id IS NULL THEN NULL::jsonb
      ELSE jsonb_build_object(
        'id', ec.outstation_state_id,
        'name', ec.outstation_state_name_snapshot
      )
    END,
    'outstation_city',
    CASE
      WHEN ec.outstation_city_id IS NULL THEN NULL::jsonb
      ELSE jsonb_build_object(
        'id', ec.outstation_city_id,
        'name', ec.outstation_city_name_snapshot
      )
    END,
    'from_city',
    CASE
      WHEN ec.from_city_id IS NULL THEN NULL::jsonb
      ELSE jsonb_build_object(
        'id', ec.from_city_id,
        'name', ec.from_city_name_snapshot
      )
    END,
    'to_city',
    CASE
      WHEN ec.to_city_id IS NULL THEN NULL::jsonb
      ELSE jsonb_build_object(
        'id', ec.to_city_id,
        'name', ec.to_city_name_snapshot
      )
    END
  ),
  true
)
FROM public.expense_claims ec
WHERE ec.id = ccs.claim_id
  AND (ccs.snapshot_data IS NULL OR NOT (ccs.snapshot_data ? 'state_city_master'));

DROP FUNCTION IF EXISTS public.admin_create_state_atomic(text, text);

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

DROP FUNCTION IF EXISTS public.admin_update_state_atomic(uuid, text, text);

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

DROP FUNCTION IF EXISTS public.admin_toggle_state_active_atomic(uuid, boolean, text);

CREATE OR REPLACE FUNCTION public.admin_toggle_state_active_atomic(
  p_id uuid,
  p_is_active boolean,
  p_confirmation text DEFAULT 'CONFIRM'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid;
  v_old public.states%ROWTYPE;
  v_city_updates integer := 0;
BEGIN
  v_admin_id := public.require_admin_actor();

  IF p_confirmation IS DISTINCT FROM 'CONFIRM' THEN
    RAISE EXCEPTION 'Secondary confirmation is required.';
  END IF;

  SELECT *
  INTO v_old
  FROM public.states s
  WHERE s.id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'State not found.';
  END IF;

  UPDATE public.states s
  SET is_active = p_is_active,
      updated_at = now()
  WHERE s.id = p_id;

  IF p_is_active = false THEN
    UPDATE public.cities c
    SET is_active = false,
        updated_at = now()
    WHERE c.state_id = p_id
      AND c.is_active = true;

    GET DIAGNOSTICS v_city_updates = ROW_COUNT;
  END IF;

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
    p_id,
    jsonb_build_object(
      'is_active', v_old.is_active
    ),
    jsonb_build_object(
      'is_active', p_is_active,
      'deactivated_city_count', v_city_updates
    )
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_create_city_atomic(uuid, text, text);

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

DROP FUNCTION IF EXISTS public.admin_update_city_atomic(uuid, text, text);

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

DROP FUNCTION IF EXISTS public.admin_toggle_city_active_atomic(uuid, boolean, text);

CREATE OR REPLACE FUNCTION public.admin_toggle_city_active_atomic(
  p_id uuid,
  p_is_active boolean,
  p_confirmation text DEFAULT 'CONFIRM'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid;
  v_old public.cities%ROWTYPE;
BEGIN
  v_admin_id := public.require_admin_actor();

  IF p_confirmation IS DISTINCT FROM 'CONFIRM' THEN
    RAISE EXCEPTION 'Secondary confirmation is required.';
  END IF;

  SELECT *
  INTO v_old
  FROM public.cities c
  WHERE c.id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'City not found.';
  END IF;

  UPDATE public.cities c
  SET is_active = p_is_active,
      updated_at = now()
  WHERE c.id = p_id;

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
    p_id,
    jsonb_build_object(
      'is_active', v_old.is_active
    ),
    jsonb_build_object(
      'is_active', p_is_active
    )
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_bulk_import_cities_atomic(uuid, text, text);

CREATE OR REPLACE FUNCTION public.admin_bulk_import_cities_atomic(
  p_state_id uuid,
  p_raw_input text,
  p_confirmation text DEFAULT 'CONFIRM'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid;
  v_state public.states%ROWTYPE;
  v_seen jsonb := '{}'::jsonb;
  v_token text;
  v_trimmed text;
  v_norm text;
  v_existing_city_id uuid;
  v_next_display_order integer;
  v_total_tokens integer := 0;
  v_inserted_count integer := 0;
  v_duplicate_count integer := 0;
  v_invalid_count integer := 0;
  v_inserted_cities text[] := '{}'::text[];
  v_duplicate_cities text[] := '{}'::text[];
  v_invalid_cities text[] := '{}'::text[];
  v_result jsonb;
BEGIN
  v_admin_id := public.require_admin_actor();

  IF p_confirmation IS DISTINCT FROM 'CONFIRM' THEN
    RAISE EXCEPTION 'Secondary confirmation is required.';
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
    RAISE EXCEPTION 'Cannot import cities into an inactive state.';
  END IF;

  SELECT coalesce(max(c.display_order), 0)
  INTO v_next_display_order
  FROM public.cities c
  WHERE c.state_id = p_state_id;

  FOREACH v_token IN ARRAY regexp_split_to_array(coalesce(p_raw_input, ''), E'[,\\n\\r]+') LOOP
    v_trimmed := regexp_replace(trim(coalesce(v_token, '')), E'\\s+', ' ', 'g');

    IF v_trimmed = '' THEN
      CONTINUE;
    END IF;

    v_total_tokens := v_total_tokens + 1;
    v_norm := lower(v_trimmed);

    IF (v_seen ? v_norm) THEN
      v_duplicate_count := v_duplicate_count + 1;
      v_duplicate_cities := array_append(v_duplicate_cities, v_trimmed);
      CONTINUE;
    END IF;

    v_seen := v_seen || jsonb_build_object(v_norm, true);

    IF char_length(v_trimmed) < 2 OR char_length(v_trimmed) > 120 THEN
      v_invalid_count := v_invalid_count + 1;
      v_invalid_cities := array_append(v_invalid_cities, v_trimmed);
      CONTINUE;
    END IF;

    IF v_trimmed ~ '[^A-Za-z0-9 .''()/-]' THEN
      v_invalid_count := v_invalid_count + 1;
      v_invalid_cities := array_append(v_invalid_cities, v_trimmed);
      CONTINUE;
    END IF;

    SELECT c.id
    INTO v_existing_city_id
    FROM public.cities c
    WHERE c.state_id = p_state_id
      AND lower(c.city_name) = v_norm
    LIMIT 1;

    IF v_existing_city_id IS NOT NULL THEN
      v_duplicate_count := v_duplicate_count + 1;
      v_duplicate_cities := array_append(v_duplicate_cities, v_trimmed);
      CONTINUE;
    END IF;

    v_next_display_order := v_next_display_order + 1;

    INSERT INTO public.cities (
      city_name,
      state_id,
      is_active,
      display_order,
      created_at,
      updated_at
    )
    VALUES (
      v_trimmed,
      p_state_id,
      true,
      v_next_display_order,
      now(),
      now()
    );

    v_inserted_count := v_inserted_count + 1;
    v_inserted_cities := array_append(v_inserted_cities, v_trimmed);
  END LOOP;

  v_result := jsonb_build_object(
    'stateId', p_state_id,
    'stateName', v_state.state_name,
    'totalTokens', v_total_tokens,
    'insertedCount', v_inserted_count,
    'duplicateCount', v_duplicate_count,
    'invalidCount', v_invalid_count,
    'insertedCities', to_jsonb(v_inserted_cities),
    'duplicateCities', to_jsonb(v_duplicate_cities),
    'invalidCities', to_jsonb(v_invalid_cities)
  );

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
    'bulk_import',
    'city',
    p_state_id,
    NULL,
    v_result
  );

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_create_state_atomic(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_state_atomic(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_toggle_state_active_atomic(uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_city_atomic(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_city_atomic(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_toggle_city_active_atomic(uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_bulk_import_cities_atomic(uuid, text, text) TO authenticated, service_role;
