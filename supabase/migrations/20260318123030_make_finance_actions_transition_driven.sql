BEGIN;

CREATE OR REPLACE FUNCTION public.submit_finance_action_atomic(
  p_claim_id uuid,
  p_action text,
  p_notes text DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_email text;
  v_actor_employee_id uuid;
  v_notes text;
  v_requested_action text;
  v_claim public.expense_claims%rowtype;
  v_transition public.claim_status_transitions%rowtype;
  v_next_status_code text;
  v_next_status_id uuid;
  v_old_status_id uuid;
  v_history_action text;
  v_finance_action text;
  v_to_status_is_rejection boolean;
  v_to_status_is_payment_issued boolean;
BEGIN
  v_requested_action := nullif(trim(coalesce(p_action, '')), '');
  IF v_requested_action IS NULL THEN
    RAISE EXCEPTION 'Unsupported finance action.';
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_actor_employee_id
      AND er.is_active = true
      AND r.is_finance_role = true
  ) THEN
    RAISE EXCEPTION 'Finance Team access is required.';
  END IF;

  SELECT *
  INTO v_claim
  FROM public.expense_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found.';
  END IF;

  SELECT cst.*
  INTO v_transition
  FROM public.claim_status_transitions cst
  JOIN public.claim_statuses to_status ON to_status.id = cst.to_status_id
  WHERE cst.from_status_id = v_claim.status_id
    AND cst.is_active = true
    AND cst.is_auto_transition = false
    AND cst.requires_role_id IS NOT NULL
    AND (
      CASE
        WHEN coalesce(to_status.is_payment_issued, false) = true
          AND cst.action_code LIKE 'finance_%'
          THEN substr(cst.action_code, length('finance_') + 1)
        ELSE cst.action_code
      END
    ) = v_requested_action
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
    RAISE EXCEPTION 'No transition configured for this finance action.';
  END IF;

  IF v_transition.requires_comment AND v_notes IS NULL THEN
    RAISE EXCEPTION 'Notes are required for this action.';
  END IF;

  SELECT
    cs.status_code,
    cs.is_rejection,
    cs.is_payment_issued
  INTO
    v_next_status_code,
    v_to_status_is_rejection,
    v_to_status_is_payment_issued
  FROM public.claim_statuses cs
  WHERE cs.id = v_transition.to_status_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Next claim status is not configured.';
  END IF;

  v_next_status_id := v_transition.to_status_id;
  v_old_status_id := v_claim.status_id;
  v_history_action := v_transition.action_code;
  v_finance_action := CASE
    WHEN coalesce(v_to_status_is_payment_issued, false) = true
      AND v_transition.action_code LIKE 'finance_%'
      THEN substr(v_transition.action_code, length('finance_') + 1)
    ELSE v_transition.action_code
  END;

  UPDATE public.expense_claims
  SET status_id = v_next_status_id,
      current_approval_level = NULL,
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

  INSERT INTO public.finance_actions (claim_id, actor_employee_id, action, notes)
  VALUES (v_claim.id, v_actor_employee_id, v_finance_action, v_notes);

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
    NULL,
    v_history_action,
    v_notes,
    CASE WHEN coalesce(v_to_status_is_rejection, false) THEN v_notes ELSE NULL END,
    CASE WHEN coalesce(v_to_status_is_rejection, false) THEN p_allow_resubmit ELSE NULL END,
    jsonb_build_object('transition_id', v_transition.id),
    v_old_status_id,
    v_next_status_id
  );

  RETURN QUERY
  SELECT v_claim.id, v_next_status_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_finance_actions_atomic(
  p_claim_ids uuid[],
  p_action text,
  p_notes text DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_claim_id uuid;
  v_processed int := 0;
BEGIN
  IF p_claim_ids IS NULL OR coalesce(array_length(p_claim_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one claim must be selected.';
  END IF;

  FOR v_claim_id IN SELECT DISTINCT unnest(p_claim_ids)
  LOOP
    PERFORM *
    FROM public.submit_finance_action_atomic(
      v_claim_id,
      p_action,
      p_notes,
      p_allow_resubmit
    );

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

COMMIT;
