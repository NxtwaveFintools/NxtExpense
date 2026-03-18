BEGIN;

CREATE OR REPLACE FUNCTION public.submit_approval_action_atomic(
  p_claim_id uuid,
  p_action text,
  p_notes text DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status_code text, new_approval_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_email text;
  v_actor_employee_id uuid;
  v_claim public.expense_claims%rowtype;
  v_owner public.employees%rowtype;
  v_transition public.claim_status_transitions%rowtype;
  v_notes text;
  v_requested_action text;
  v_level int;
  v_next_status_code text;
  v_next_status_id uuid;
  v_old_status_id uuid;
  v_next_approval_level int;
  v_to_status_approval_level int;
  v_to_status_is_approval boolean;
  v_to_status_is_rejection boolean;
  v_to_status_is_terminal boolean;
BEGIN
  v_requested_action := nullif(trim(coalesce(p_action, '')), '');
  IF v_requested_action IS NULL THEN
    RAISE EXCEPTION 'Unsupported approval action.';
  END IF;

  v_email := public.current_user_email();
  IF coalesce(v_email, '') = '' THEN
    RAISE EXCEPTION 'Unauthorized request.';
  END IF;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  SELECT id
  INTO v_actor_employee_id
  FROM public.employees
  WHERE lower(employee_email) = v_email;

  IF v_actor_employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee record not found.';
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
  INTO v_owner
  FROM public.employees
  WHERE id = v_claim.employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim owner not found.';
  END IF;

  v_level := v_claim.current_approval_level;

  IF v_level = 1 THEN
    IF v_owner.approval_employee_id_level_1 IS DISTINCT FROM v_actor_employee_id THEN
      RAISE EXCEPTION 'You are not the assigned Level 1 approver for this employee.';
    END IF;
  ELSIF v_level = 2 THEN
    IF v_owner.approval_employee_id_level_3 IS DISTINCT FROM v_actor_employee_id THEN
      RAISE EXCEPTION 'You are not the assigned Level 2 (HOD) approver for this employee.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Claim is not at an approver-actionable level (current level = %).', v_level;
  END IF;

  SELECT cst.*
  INTO v_transition
  FROM public.claim_status_transitions cst
  WHERE cst.from_status_id = v_claim.status_id
    AND cst.is_active = true
    AND cst.is_auto_transition = false
    AND cst.action_code = v_requested_action
    AND cst.requires_role_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.employee_roles er
      WHERE er.employee_id = v_actor_employee_id
        AND er.role_id = cst.requires_role_id
        AND er.is_active = true
    )
  ORDER BY cst.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No transition configured for this approval action.';
  END IF;

  IF v_transition.requires_comment AND v_notes IS NULL THEN
    RAISE EXCEPTION 'Notes are required for this action.';
  END IF;

  SELECT
    cs.status_code,
    cs.approval_level,
    cs.is_approval,
    cs.is_rejection,
    cs.is_terminal
  INTO
    v_next_status_code,
    v_to_status_approval_level,
    v_to_status_is_approval,
    v_to_status_is_rejection,
    v_to_status_is_terminal
  FROM public.claim_statuses cs
  WHERE cs.id = v_transition.to_status_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Next claim status is not configured.';
  END IF;

  v_next_status_id := v_transition.to_status_id;
  v_old_status_id := v_claim.status_id;
  v_next_approval_level := CASE
    WHEN coalesce(v_to_status_is_terminal, false) = false
      AND coalesce(v_to_status_is_rejection, false) = false
      AND coalesce(v_to_status_is_approval, false) = false
      AND v_to_status_approval_level IS NOT NULL
      AND v_to_status_approval_level <= 2
      THEN v_to_status_approval_level
    ELSE NULL
  END;

  UPDATE public.expense_claims
  SET status_id = v_next_status_id,
      current_approval_level = v_next_approval_level,
      allow_resubmit = CASE
        WHEN coalesce(v_to_status_is_rejection, false)
          THEN coalesce(p_allow_resubmit, false)
        ELSE false
      END,
      last_rejection_notes = CASE
        WHEN coalesce(v_to_status_is_rejection, false)
          THEN v_notes
        ELSE last_rejection_notes
      END,
      last_rejected_by_employee_id = CASE
        WHEN coalesce(v_to_status_is_rejection, false)
          THEN v_actor_employee_id
        ELSE last_rejected_by_employee_id
      END,
      last_rejected_at = CASE
        WHEN coalesce(v_to_status_is_rejection, false)
          THEN now()
        ELSE last_rejected_at
      END,
      updated_at = now()
  WHERE id = v_claim.id;

  INSERT INTO public.approval_history (
    claim_id,
    approver_employee_id,
    approval_level,
    action,
    notes,
    rejection_notes,
    allow_resubmit,
    metadata,
    old_status_id,
    new_status_id
  )
  VALUES (
    v_claim.id,
    v_actor_employee_id,
    v_level,
    v_transition.action_code,
    v_notes,
    CASE WHEN coalesce(v_to_status_is_rejection, false) THEN v_notes ELSE NULL END,
    CASE WHEN coalesce(v_to_status_is_rejection, false) THEN p_allow_resubmit ELSE NULL END,
    jsonb_build_object('transition_id', v_transition.id),
    v_old_status_id,
    v_next_status_id
  );

  RETURN QUERY
  SELECT v_claim.id, v_next_status_code, v_next_approval_level;
END;
$$;

COMMIT;
