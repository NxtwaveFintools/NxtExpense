BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_approver_options_by_state(
  p_state_id uuid
)
RETURNS TABLE (
  approval_level integer,
  employee_id uuid,
  employee_name text,
  employee_email text,
  designation_id uuid,
  designation_name text,
  state_id uuid,
  state_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  v_admin_id := public.require_admin_actor();

  RETURN QUERY
  SELECT
    r.approval_level::integer,
    e.id::uuid,
    e.employee_name::text,
    e.employee_email::text,
    d.id::uuid,
    d.designation_name::text,
    es.state_id::uuid,
    s.state_name::text
  FROM public.approver_selection_rules r
  JOIN public.employees e
    ON e.designation_id = r.designation_id
  JOIN public.designations d
    ON d.id = e.designation_id
  LEFT JOIN public.employee_states es
    ON es.employee_id = e.id
   AND es.is_primary = true
  LEFT JOIN public.states s
    ON s.id = es.state_id
  WHERE r.is_active = true
    AND d.is_active = true
    AND (
      r.requires_same_state = false
      OR es.state_id = p_state_id
    )
  ORDER BY r.approval_level ASC, e.employee_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_approver_options_by_state(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_approver_selection_rule_atomic(
  p_approval_level integer,
  p_designation_id uuid,
  p_requires_same_state boolean,
  p_is_active boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_admin_id uuid;
  v_existing_id uuid;
  v_rule_id uuid;
  v_old_value jsonb;
  v_new_value jsonb;
BEGIN
  v_admin_id := public.require_admin_actor();

  IF p_approval_level < 1 OR p_approval_level > 3 THEN
    RAISE EXCEPTION 'Approval level must be between 1 and 3.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.designations d
    WHERE d.id = p_designation_id
      AND d.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid active designation selected for approver rule.';
  END IF;

  SELECT id
  INTO v_existing_id
  FROM public.approver_selection_rules
  WHERE approval_level = p_approval_level
    AND designation_id = p_designation_id;

  IF v_existing_id IS NOT NULL THEN
    SELECT to_jsonb(r)
    INTO v_old_value
    FROM public.approver_selection_rules r
    WHERE r.id = v_existing_id;

    UPDATE public.approver_selection_rules
    SET requires_same_state = p_requires_same_state,
        is_active = p_is_active,
        updated_at = now()
    WHERE id = v_existing_id
    RETURNING id INTO v_rule_id;
  ELSE
    INSERT INTO public.approver_selection_rules (
      approval_level,
      designation_id,
      requires_same_state,
      is_active
    )
    VALUES (
      p_approval_level,
      p_designation_id,
      p_requires_same_state,
      p_is_active
    )
    RETURNING id INTO v_rule_id;
  END IF;

  SELECT to_jsonb(r)
  INTO v_new_value
  FROM public.approver_selection_rules r
  WHERE r.id = v_rule_id;

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
    'approver_selection_rule',
    v_rule_id,
    v_old_value,
    v_new_value
  );

  RETURN v_rule_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_approver_selection_rule_atomic(integer, uuid, boolean, boolean)
  TO authenticated;

COMMIT;
