BEGIN;

CREATE OR REPLACE FUNCTION public.admin_update_vehicle_rates_atomic(
  p_id uuid,
  p_base_fuel_rate_per_day numeric,
  p_intercity_rate_per_km numeric,
  p_max_km_round_trip integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_admin_id uuid;
  v_old_base numeric;
  v_old_intercity numeric;
  v_old_max integer;
BEGIN
  v_admin_id := public.require_admin_actor();

  SELECT
    base_fuel_rate_per_day,
    intercity_rate_per_km,
    max_km_round_trip
  INTO
    v_old_base,
    v_old_intercity,
    v_old_max
  FROM public.vehicle_types
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle type not found.';
  END IF;

  UPDATE public.vehicle_types
  SET
    base_fuel_rate_per_day = p_base_fuel_rate_per_day,
    intercity_rate_per_km = p_intercity_rate_per_km,
    max_km_round_trip = p_max_km_round_trip,
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
    'vehicle_type_rates',
    p_id,
    jsonb_build_object(
      'base_fuel_rate_per_day', v_old_base,
      'intercity_rate_per_km', v_old_intercity,
      'max_km_round_trip', v_old_max
    ),
    jsonb_build_object(
      'base_fuel_rate_per_day', p_base_fuel_rate_per_day,
      'intercity_rate_per_km', p_intercity_rate_per_km,
      'max_km_round_trip', p_max_km_round_trip
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_vehicle_rates_atomic(uuid, numeric, numeric, integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_expense_rate_amount_atomic(
  p_id uuid,
  p_rate_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_admin_id uuid;
  v_old_rate numeric;
BEGIN
  v_admin_id := public.require_admin_actor();

  SELECT rate_amount INTO v_old_rate
  FROM public.expense_rates
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense rate not found.';
  END IF;

  UPDATE public.expense_rates
  SET rate_amount = p_rate_amount,
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
    'expense_rate_amount',
    p_id,
    jsonb_build_object('rate_amount', v_old_rate),
    jsonb_build_object('rate_amount', p_rate_amount)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_expense_rate_amount_atomic(uuid, numeric)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_toggle_expense_rate_active_atomic(
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
  v_old_is_active boolean;
BEGIN
  v_admin_id := public.require_admin_actor();

  SELECT is_active INTO v_old_is_active
  FROM public.expense_rates
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense rate not found.';
  END IF;

  UPDATE public.expense_rates
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
    'expense_rate_status',
    p_id,
    jsonb_build_object('is_active', v_old_is_active),
    jsonb_build_object('is_active', p_is_active)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_expense_rate_active_atomic(uuid, boolean)
  TO authenticated;

DROP FUNCTION IF EXISTS public.admin_reassign_employee_approvers_with_audit_atomic(uuid, text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.admin_reassign_employee_approvers_with_audit_atomic(
  p_employee_id uuid,
  p_level_1 text,
  p_level_2 text,
  p_level_3 text,
  p_reason text,
  p_confirmation text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_admin_id uuid;
  v_impacted_claims integer;
  v_old_l1 uuid;
  v_old_l2 uuid;
  v_old_l3 uuid;
  v_new_l1 uuid;
  v_new_l2 uuid;
  v_new_l3 uuid;
BEGIN
  v_admin_id := public.require_admin_actor();

  SELECT
    approval_employee_id_level_1,
    approval_employee_id_level_2,
    approval_employee_id_level_3
  INTO
    v_old_l1,
    v_old_l2,
    v_old_l3
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found.';
  END IF;

  SELECT public.admin_reassign_employee_approvers_atomic(
    p_employee_id,
    p_level_1,
    p_level_2,
    p_level_3,
    p_reason,
    p_confirmation
  )
  INTO v_impacted_claims;

  SELECT
    approval_employee_id_level_1,
    approval_employee_id_level_2,
    approval_employee_id_level_3
  INTO
    v_new_l1,
    v_new_l2,
    v_new_l3
  FROM public.employees
  WHERE id = p_employee_id;

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
    'approval_chain',
    p_employee_id,
    jsonb_build_object(
      'approval_employee_id_level_1', v_old_l1,
      'approval_employee_id_level_2', v_old_l2,
      'approval_employee_id_level_3', v_old_l3
    ),
    jsonb_build_object(
      'approval_employee_id_level_1', v_new_l1,
      'approval_employee_id_level_2', v_new_l2,
      'approval_employee_id_level_3', v_new_l3,
      'reason', p_reason,
      'impacted_claims', coalesce(v_impacted_claims, 0)
    )
  );

  RETURN coalesce(v_impacted_claims, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reassign_employee_approvers_with_audit_atomic(uuid, text, text, text, text, text)
  TO authenticated;

COMMIT;
