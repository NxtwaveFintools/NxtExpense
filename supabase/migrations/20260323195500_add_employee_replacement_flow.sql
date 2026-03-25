BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_replacements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_employee_id uuid NOT NULL REFERENCES public.employees(id),
  new_employee_id uuid NOT NULL UNIQUE REFERENCES public.employees(id),
  replaced_by_admin_id uuid NOT NULL REFERENCES public.employees(id),
  replacement_reason text NOT NULL,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_replacements_old_new_diff CHECK (old_employee_id <> new_employee_id),
  CONSTRAINT employee_replacements_old_unique UNIQUE (old_employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_replacements_old_employee
  ON public.employee_replacements(old_employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_replacements_new_employee
  ON public.employee_replacements(new_employee_id);

ALTER TABLE public.employee_replacements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_replacements_read_authenticated ON public.employee_replacements;
CREATE POLICY employee_replacements_read_authenticated
  ON public.employee_replacements
  FOR SELECT
  TO authenticated
  USING (true);

DROP FUNCTION IF EXISTS public.admin_prepare_employee_replacement_atomic(uuid, text, text);
CREATE OR REPLACE FUNCTION public.admin_prepare_employee_replacement_atomic(
  p_employee_id uuid,
  p_reason text,
  p_confirmation text
)
RETURNS TABLE (
  old_employee_id uuid,
  old_employee_name text,
  default_designation_id uuid,
  default_role_id uuid,
  default_state_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_admin_id uuid;
  v_inactive_status_id uuid;
  v_old_status_id uuid;
  v_old_status_code text;
  v_employee public.employees%ROWTYPE;
  v_role_id uuid;
  v_state_id uuid;
BEGIN
  v_admin_id := public.require_admin_actor();

  IF p_confirmation IS DISTINCT FROM 'CONFIRM' THEN
    RAISE EXCEPTION 'Secondary confirmation is required.';
  END IF;

  SELECT *
  INTO v_employee
  FROM public.employees
  WHERE id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found.';
  END IF;

  SELECT id
  INTO v_inactive_status_id
  FROM public.employee_statuses
  WHERE status_code = 'INACTIVE'
  LIMIT 1;

  IF v_inactive_status_id IS NULL THEN
    RAISE EXCEPTION 'INACTIVE employee status is not configured.';
  END IF;

  v_old_status_id := v_employee.employee_status_id;

  SELECT status_code
  INTO v_old_status_code
  FROM public.employee_statuses
  WHERE id = v_old_status_id;

  IF v_old_status_id = v_inactive_status_id OR v_old_status_code = 'INACTIVE' THEN
    RAISE EXCEPTION 'Employee is already inactive.';
  END IF;

  UPDATE public.employees
  SET
    employee_status_id = v_inactive_status_id,
    updated_at = now()
  WHERE id = p_employee_id;

  SELECT er.role_id
  INTO v_role_id
  FROM public.employee_roles er
  WHERE er.employee_id = p_employee_id
    AND er.is_active = true
  ORDER BY er.assigned_at DESC
  LIMIT 1;

  SELECT es.state_id
  INTO v_state_id
  FROM public.employee_states es
  WHERE es.employee_id = p_employee_id
    AND es.is_primary = true
  LIMIT 1;

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
    'replace_prepare',
    'employee',
    p_employee_id,
    jsonb_build_object(
      'employee_status_id', v_old_status_id,
      'status_code', coalesce(v_old_status_code, 'UNKNOWN')
    ),
    jsonb_build_object(
      'employee_status_id', v_inactive_status_id,
      'status_code', 'INACTIVE',
      'reason', p_reason
    )
  );

  RETURN QUERY
  SELECT
    v_employee.id,
    v_employee.employee_name,
    v_employee.designation_id,
    v_role_id,
    v_state_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_prepare_employee_replacement_atomic(uuid, text, text)
  TO authenticated;

DROP FUNCTION IF EXISTS public.admin_finalize_employee_replacement_atomic(uuid, uuid, text, text);
CREATE OR REPLACE FUNCTION public.admin_finalize_employee_replacement_atomic(
  p_old_employee_id uuid,
  p_new_employee_id uuid,
  p_reason text,
  p_confirmation text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  v_admin_id := public.require_admin_actor();

  IF p_confirmation IS DISTINCT FROM 'CONFIRM' THEN
    RAISE EXCEPTION 'Secondary confirmation is required.';
  END IF;

  IF p_old_employee_id = p_new_employee_id THEN
    RAISE EXCEPTION 'Old and new employee cannot be the same.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employees WHERE id = p_old_employee_id
  ) THEN
    RAISE EXCEPTION 'Old employee not found.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employees WHERE id = p_new_employee_id
  ) THEN
    RAISE EXCEPTION 'New employee not found.';
  END IF;

  INSERT INTO public.employee_replacements (
    old_employee_id,
    new_employee_id,
    replaced_by_admin_id,
    replacement_reason
  )
  VALUES (
    p_old_employee_id,
    p_new_employee_id,
    v_admin_id,
    p_reason
  );

  UPDATE public.employees
  SET
    approval_employee_id_level_1 = CASE
      WHEN approval_employee_id_level_1 = p_old_employee_id THEN p_new_employee_id
      ELSE approval_employee_id_level_1
    END,
    approval_employee_id_level_2 = CASE
      WHEN approval_employee_id_level_2 = p_old_employee_id THEN p_new_employee_id
      ELSE approval_employee_id_level_2
    END,
    approval_employee_id_level_3 = CASE
      WHEN approval_employee_id_level_3 = p_old_employee_id THEN p_new_employee_id
      ELSE approval_employee_id_level_3
    END,
    updated_at = now()
  WHERE
    approval_employee_id_level_1 = p_old_employee_id
    OR approval_employee_id_level_2 = p_old_employee_id
    OR approval_employee_id_level_3 = p_old_employee_id;

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
    'replace_finalize',
    'employee_replacement',
    p_new_employee_id,
    jsonb_build_object(
      'old_employee_id', p_old_employee_id
    ),
    jsonb_build_object(
      'old_employee_id', p_old_employee_id,
      'new_employee_id', p_new_employee_id,
      'reason', p_reason
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_finalize_employee_replacement_atomic(uuid, uuid, text, text)
  TO authenticated;

COMMIT;
