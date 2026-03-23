BEGIN;

CREATE OR REPLACE FUNCTION public.require_admin_actor()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_actor_email text;
  v_admin_id uuid;
BEGIN
  v_actor_email := public.current_user_email();

  IF coalesce(v_actor_email, '') = '' THEN
    RAISE EXCEPTION 'Unauthorized request.';
  END IF;

  SELECT e.id
  INTO v_admin_id
  FROM public.employees e
  WHERE lower(e.employee_email) = v_actor_email;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin access is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_admin_id
      AND er.is_active = true
      AND r.is_admin_role = true
  ) THEN
    RAISE EXCEPTION 'Admin access is required.';
  END IF;

  RETURN v_admin_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.require_admin_actor() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_toggle_designation_active_atomic(
  p_id uuid,
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_admin_id uuid;
  v_old_value boolean;
BEGIN
  v_admin_id := public.require_admin_actor();

  SELECT is_active INTO v_old_value
  FROM public.designations
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Designation not found.';
  END IF;

  UPDATE public.designations
  SET is_active = p_is_active,
      updated_at = now()
  WHERE id = p_id;

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
    'designation',
    p_id,
    jsonb_build_object('is_active', v_old_value),
    jsonb_build_object('is_active', p_is_active)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_designation_active_atomic(uuid, boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_toggle_work_location_active_atomic(
  p_id uuid,
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_admin_id uuid;
  v_old_value boolean;
BEGIN
  v_admin_id := public.require_admin_actor();

  SELECT is_active INTO v_old_value
  FROM public.work_locations
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work location not found.';
  END IF;

  UPDATE public.work_locations
  SET is_active = p_is_active,
      updated_at = now()
  WHERE id = p_id;

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
    'work_location',
    p_id,
    jsonb_build_object('is_active', v_old_value),
    jsonb_build_object('is_active', p_is_active)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_work_location_active_atomic(uuid, boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_toggle_vehicle_type_active_atomic(
  p_id uuid,
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_admin_id uuid;
  v_old_value boolean;
BEGIN
  v_admin_id := public.require_admin_actor();

  SELECT is_active INTO v_old_value
  FROM public.vehicle_types
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle type not found.';
  END IF;

  UPDATE public.vehicle_types
  SET is_active = p_is_active,
      updated_at = now()
  WHERE id = p_id;

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
    'vehicle_type',
    p_id,
    jsonb_build_object('is_active', v_old_value),
    jsonb_build_object('is_active', p_is_active)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_vehicle_type_active_atomic(uuid, boolean)
  TO authenticated;

COMMIT;
