BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.employees(id),
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id_created_at
  ON public.admin_logs (admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_logs_entity_lookup
  ON public.admin_logs (entity_type, entity_id, created_at DESC);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_logs_read_admin_only ON public.admin_logs;
CREATE POLICY admin_logs_read_admin_only
  ON public.admin_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees current_emp
      JOIN public.employee_roles er ON er.employee_id = current_emp.id
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(current_emp.employee_email) = public.current_user_email()
        AND er.is_active = true
        AND r.is_admin_role = true
    )
  );

DROP FUNCTION IF EXISTS public.admin_create_employee_atomic(text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.admin_create_employee_atomic(
  p_employee_id text,
  p_employee_name text,
  p_employee_email text,
  p_designation_id uuid,
  p_employee_status_id uuid,
  p_role_id uuid,
  p_state_id uuid,
  p_approval_employee_id_level_1 uuid DEFAULT NULL,
  p_approval_employee_id_level_2 uuid DEFAULT NULL,
  p_approval_employee_id_level_3 uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  employee_id text,
  employee_name text,
  employee_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_actor_email text;
  v_admin_employee_id uuid;
  v_created_employee public.employees%ROWTYPE;
BEGIN
  v_actor_email := public.current_user_email();

  IF coalesce(v_actor_email, '') = '' THEN
    RAISE EXCEPTION 'Unauthorized request.';
  END IF;

  SELECT e.id
  INTO v_admin_employee_id
  FROM public.employees e
  WHERE lower(e.employee_email) = v_actor_email;

  IF v_admin_employee_id IS NULL THEN
    RAISE EXCEPTION 'Admin access is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_admin_employee_id
      AND er.is_active = true
      AND r.is_admin_role = true
  ) THEN
    RAISE EXCEPTION 'Admin access is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.designations d
    WHERE d.id = p_designation_id
      AND d.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid active designation selected.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_statuses s
    WHERE s.id = p_employee_status_id
  ) THEN
    RAISE EXCEPTION 'Invalid employee status selected.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.roles r
    WHERE r.id = p_role_id
      AND r.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid active role selected.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.states s
    WHERE s.id = p_state_id
      AND s.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid active state selected.';
  END IF;

  IF p_approval_employee_id_level_1 IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = p_approval_employee_id_level_1) THEN
    RAISE EXCEPTION 'Invalid level 1 approver selected.';
  END IF;

  IF p_approval_employee_id_level_2 IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = p_approval_employee_id_level_2) THEN
    RAISE EXCEPTION 'Invalid level 2 approver selected.';
  END IF;

  IF p_approval_employee_id_level_3 IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = p_approval_employee_id_level_3) THEN
    RAISE EXCEPTION 'Invalid level 3 approver selected.';
  END IF;

  INSERT INTO public.employees (
    employee_id,
    employee_name,
    employee_email,
    designation_id,
    employee_status_id,
    approval_employee_id_level_1,
    approval_employee_id_level_2,
    approval_employee_id_level_3
  )
  VALUES (
    trim(p_employee_id),
    trim(p_employee_name),
    lower(trim(p_employee_email)),
    p_designation_id,
    p_employee_status_id,
    p_approval_employee_id_level_1,
    p_approval_employee_id_level_2,
    p_approval_employee_id_level_3
  )
  RETURNING * INTO v_created_employee;

  INSERT INTO public.employee_states (
    employee_id,
    state_id,
    is_primary
  )
  VALUES (
    v_created_employee.id,
    p_state_id,
    true
  );

  INSERT INTO public.employee_roles (
    employee_id,
    role_id,
    assigned_by,
    is_active
  )
  VALUES (
    v_created_employee.id,
    p_role_id,
    v_admin_employee_id,
    true
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
    v_admin_employee_id,
    'create',
    'employee',
    v_created_employee.id,
    NULL,
    jsonb_build_object(
      'employee_id', v_created_employee.employee_id,
      'employee_name', v_created_employee.employee_name,
      'employee_email', v_created_employee.employee_email,
      'designation_id', v_created_employee.designation_id,
      'employee_status_id', v_created_employee.employee_status_id,
      'state_id', p_state_id,
      'role_id', p_role_id,
      'approval_employee_id_level_1', v_created_employee.approval_employee_id_level_1,
      'approval_employee_id_level_2', v_created_employee.approval_employee_id_level_2,
      'approval_employee_id_level_3', v_created_employee.approval_employee_id_level_3
    )
  );

  RETURN QUERY
  SELECT
    v_created_employee.id,
    v_created_employee.employee_id,
    v_created_employee.employee_name,
    v_created_employee.employee_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_employee_atomic(text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid)
  TO authenticated;

COMMIT;
