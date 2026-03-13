-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 154: Rewrite reassign_orphaned_approvals to accept UUID params
--
-- The old version accepted email strings and resolved them to UUIDs internally.
-- UUIDs should be provided by callers; the RPC should not do email resolution.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.reassign_orphaned_approvals(text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.reassign_orphaned_approvals(
  p_old_approver_id uuid,
  p_new_approver_id uuid,
  p_admin_employee_id uuid,
  p_reason text DEFAULT 'Approver reassignment'
)
RETURNS TABLE(reassigned_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_level1_count INTEGER := 0;
  v_level3_count INTEGER := 0;
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

  IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_old_approver_id) THEN
    RAISE EXCEPTION 'Old approver not found: %', p_old_approver_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_new_approver_id) THEN
    RAISE EXCEPTION 'New approver not found: %', p_new_approver_id;
  END IF;

  -- Reassign Level 1 approvals
  UPDATE employees
  SET approval_employee_id_level_1 = p_new_approver_id
  WHERE approval_employee_id_level_1 = p_old_approver_id;
  GET DIAGNOSTICS v_level1_count = ROW_COUNT;

  -- Reassign Level 3 (HOD/final) approvals
  UPDATE employees
  SET approval_employee_id_level_3 = p_new_approver_id
  WHERE approval_employee_id_level_3 = p_old_approver_id;
  GET DIAGNOSTICS v_level3_count = ROW_COUNT;

  v_count := v_level1_count + v_level3_count;

  -- Audit log entry
  INSERT INTO employee_designation_history (employee_id, new_designation_id, changed_by, reason)
  VALUES (
    p_old_approver_id,
    (SELECT designation_id FROM employees WHERE id = p_old_approver_id),
    p_admin_employee_id,
    format('Approval reassignment to %s: %s', p_new_approver_id, p_reason)
  );

  RETURN QUERY SELECT v_count;
END;
$$;
