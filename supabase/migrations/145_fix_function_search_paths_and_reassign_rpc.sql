-- ============================================================
-- Migration 145: Fix function search_path security warnings
--                and rewrite reassign_orphaned_approvals for
--                the new ID-based approval columns.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Fix mutable search_path on utility/helper functions
-- ─────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.current_user_email()
  SET search_path = public;

ALTER FUNCTION public.get_claim_status_id(p_code character varying)
  SET search_path = public;

ALTER FUNCTION public.get_designation_id(p_code character varying)
  SET search_path = public;

ALTER FUNCTION public.get_role_id(p_code character varying)
  SET search_path = public;

ALTER FUNCTION public.get_state_id(p_code character varying)
  SET search_path = public;

ALTER FUNCTION public.get_vehicle_type_id(p_code character varying)
  SET search_path = public;

ALTER FUNCTION public.get_work_location_id(p_code character varying)
  SET search_path = public;

ALTER FUNCTION public.get_active_approver_with_delegation(
  p_original_approver_id uuid,
  p_approval_level integer,
  p_state_id uuid,
  p_check_date date
)
  SET search_path = public;

ALTER FUNCTION public.get_expense_rate_for_date(
  p_location_id uuid,
  p_expense_type character varying,
  p_designation_id uuid,
  p_for_date date
)
  SET search_path = public;

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Rewrite reassign_orphaned_approvals to use ID-based approval columns
--         (approval_email_level_1 was dropped by migration 144)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reassign_orphaned_approvals(
  p_old_approver_email text,
  p_new_approver_email text,
  p_admin_employee_id uuid,
  p_reason text DEFAULT 'Approver reassignment'
)
RETURNS TABLE(reassigned_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_emp_id UUID;
  v_new_emp_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM employee_roles er
    JOIN roles r ON er.role_id = r.id
    WHERE er.employee_id = p_admin_employee_id
      AND r.role_code = 'ADMIN'
      AND er.is_active = true
  ) THEN
    RAISE EXCEPTION 'Only admin can reassign approvals';
  END IF;

  -- Resolve employee IDs from emails
  SELECT id INTO v_old_emp_id FROM employees WHERE employee_email = lower(p_old_approver_email);
  SELECT id INTO v_new_emp_id FROM employees WHERE employee_email = lower(p_new_approver_email);

  IF v_old_emp_id IS NULL THEN
    RAISE EXCEPTION 'Old approver not found: %', p_old_approver_email;
  END IF;
  IF v_new_emp_id IS NULL THEN
    RAISE EXCEPTION 'New approver not found: %', p_new_approver_email;
  END IF;

  -- Update employees who had old approver as L1
  UPDATE employees
  SET approval_employee_id_level_1 = v_new_emp_id
  WHERE approval_employee_id_level_1 = v_old_emp_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Also update L3 assignments (e.g. if Mansoor role is being transferred)
  UPDATE employees
  SET approval_employee_id_level_3 = v_new_emp_id
  WHERE approval_employee_id_level_3 = v_old_emp_id;

  v_count := v_count + (SELECT count(*)::integer FROM employees
                         WHERE approval_employee_id_level_3 = v_new_emp_id
                           AND approval_employee_id_level_3 != v_old_emp_id);

  -- Log the change in designation history as an audit record
  INSERT INTO employee_designation_history (employee_id, new_designation_id, changed_by, reason)
  SELECT
    v_old_emp_id,
    (SELECT designation_id FROM employees WHERE id = v_old_emp_id),
    p_admin_employee_id,
    format('Approval reassignment from %s to %s: %s',
           p_old_approver_email, p_new_approver_email, p_reason);

  RETURN QUERY SELECT v_count;
END;
$$;
