BEGIN;

DROP FUNCTION IF EXISTS public.admin_change_claim_status_with_audit_atomic(uuid, uuid, text, text);
CREATE OR REPLACE FUNCTION public.admin_change_claim_status_with_audit_atomic(
  p_claim_id uuid,
  p_target_status_id uuid,
  p_reason text,
  p_confirmation text DEFAULT 'CONFIRM'
)
RETURNS TABLE(
  claim_id uuid,
  previous_status_code text,
  updated_status_code text,
  updated_approval_level integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_admin_id uuid;
  v_reason text;
  v_claim public.expense_claims%ROWTYPE;
  v_old_status public.claim_statuses%ROWTYPE;
  v_new_status public.claim_statuses%ROWTYPE;
  v_target_level integer;
BEGIN
  v_admin_id := public.require_admin_actor();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  IF p_confirmation <> 'CONFIRM' THEN
    RAISE EXCEPTION 'Secondary confirmation is required.';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Status change reason is required.';
  END IF;

  SELECT *
  INTO v_claim
  FROM public.expense_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found.';
  END IF;

  SELECT *
  INTO v_old_status
  FROM public.claim_statuses
  WHERE id = v_claim.status_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current claim status is invalid.';
  END IF;

  SELECT *
  INTO v_new_status
  FROM public.claim_statuses
  WHERE id = p_target_status_id
    AND is_active = true
    AND is_terminal = false
    AND is_rejection = false
    AND is_approval = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected status is not eligible for admin reassignment.';
  END IF;

  IF v_claim.status_id = v_new_status.id THEN
    RAISE EXCEPTION 'Claim is already in the selected status.';
  END IF;

  v_target_level := v_new_status.approval_level;

  UPDATE public.expense_claims
  SET status_id = v_new_status.id,
      current_approval_level = v_target_level,
      updated_at = now()
  WHERE id = v_claim.id;

  INSERT INTO public.approval_history (
    claim_id,
    approver_employee_id,
    approval_level,
    action,
    notes,
    reason,
    old_status_id,
    new_status_id,
    metadata
  )
  VALUES (
    v_claim.id,
    v_admin_id,
    v_target_level,
    'admin_override',
    v_reason,
    v_reason,
    v_old_status.id,
    v_new_status.id,
    jsonb_build_object(
      'operation', 'admin_status_reassignment',
      'from_status_code', v_old_status.status_code,
      'to_status_code', v_new_status.status_code,
      'from_approval_level', v_claim.current_approval_level,
      'to_approval_level', v_target_level
    )
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
    'update',
    'claim_status',
    v_claim.id,
    jsonb_build_object(
      'status_id', v_old_status.id,
      'status_code', v_old_status.status_code,
      'approval_level', v_claim.current_approval_level
    ),
    jsonb_build_object(
      'status_id', v_new_status.id,
      'status_code', v_new_status.status_code,
      'approval_level', v_target_level,
      'reason', v_reason
    )
  );

  RETURN QUERY
  SELECT v_claim.id, v_old_status.status_code, v_new_status.status_code, v_target_level;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_change_claim_status_with_audit_atomic(uuid, uuid, text, text)
  TO authenticated;

COMMIT;
