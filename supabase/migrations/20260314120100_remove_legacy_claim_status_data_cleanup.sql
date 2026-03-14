BEGIN;

DO $cleanup$
DECLARE
  v_draft_id uuid;
  v_submitted_id uuid;
  v_returned_id uuid;
  v_l4_pending_id uuid;
  v_l4_failed_id uuid;

  v_l1_pending_id uuid;
  v_l2_pending_id uuid;
  v_l3_pending_id uuid;
  v_l1_rejected_id uuid;
  v_l2_rejected_id uuid;
  v_l3_rejected_id uuid;
  v_approved_id uuid;

  v_remaining integer;
BEGIN
  SELECT id INTO v_draft_id FROM public.claim_statuses WHERE status_code = 'DRAFT';
  SELECT id INTO v_submitted_id FROM public.claim_statuses WHERE status_code = 'SUBMITTED';
  SELECT id INTO v_returned_id FROM public.claim_statuses WHERE status_code = 'RETURNED_FOR_MODIFICATION';
  SELECT id INTO v_l4_pending_id FROM public.claim_statuses WHERE status_code = 'L4_PENDING_PAYMENT_PROCESSING';
  SELECT id INTO v_l4_failed_id FROM public.claim_statuses WHERE status_code = 'L4_PAYMENT_FAILED';

  -- If statuses are already removed, this migration is naturally idempotent.
  IF v_draft_id IS NULL
     AND v_submitted_id IS NULL
     AND v_returned_id IS NULL
     AND v_l4_pending_id IS NULL
     AND v_l4_failed_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_l1_pending_id FROM public.claim_statuses WHERE status_code = 'L1_PENDING';
  SELECT id INTO v_l2_pending_id FROM public.claim_statuses WHERE status_code = 'L2_PENDING';
  SELECT id INTO v_l3_pending_id FROM public.claim_statuses WHERE status_code = 'L3_PENDING_FINANCE_REVIEW';
  SELECT id INTO v_l1_rejected_id FROM public.claim_statuses WHERE status_code = 'L1_REJECTED';
  SELECT id INTO v_l2_rejected_id FROM public.claim_statuses WHERE status_code = 'L2_REJECTED';
  SELECT id INTO v_l3_rejected_id FROM public.claim_statuses WHERE status_code = 'L3_REJECTED_FINANCE';
  SELECT id INTO v_approved_id FROM public.claim_statuses WHERE status_code = 'APPROVED';

  UPDATE public.expense_claims c
  SET
    status_id = CASE daf.required_approval_levels[1]
      WHEN 1 THEN v_l1_pending_id
      WHEN 2 THEN v_l2_pending_id
      WHEN 3 THEN v_l3_pending_id
      ELSE v_l1_pending_id
    END,
    current_approval_level = CASE daf.required_approval_levels[1]
      WHEN 1 THEN 1
      WHEN 2 THEN 2
      ELSE NULL
    END,
    submitted_at = COALESCE(c.submitted_at, now()),
    updated_at = now()
  FROM public.employees e
  LEFT JOIN public.designation_approval_flow daf
    ON daf.designation_id = e.designation_id
   AND daf.is_active = true
  WHERE c.employee_id = e.id
    AND c.status_id IN (v_draft_id, v_submitted_id);

  UPDATE public.expense_claims c
  SET
    status_id = CASE c.current_approval_level
      WHEN 1 THEN v_l1_rejected_id
      WHEN 2 THEN v_l2_rejected_id
      ELSE v_l3_rejected_id
    END,
    current_approval_level = NULL,
    updated_at = now()
  WHERE c.status_id = v_returned_id;

  UPDATE public.expense_claims c
  SET status_id = v_approved_id, current_approval_level = NULL, updated_at = now()
  WHERE c.status_id = v_l4_pending_id;

  UPDATE public.expense_claims c
  SET status_id = v_l3_rejected_id, current_approval_level = NULL, updated_at = now()
  WHERE c.status_id = v_l4_failed_id;

  UPDATE public.approval_history ah
  SET old_status_id = ah.new_status_id
  WHERE ah.old_status_id = v_submitted_id;

  UPDATE public.approval_history ah
  SET new_status_id = CASE COALESCE(daf.required_approval_levels[1], 1)
    WHEN 1 THEN v_l1_pending_id
    WHEN 2 THEN v_l2_pending_id
    ELSE v_l3_pending_id
  END
  FROM public.expense_claims c
  JOIN public.employees e ON e.id = c.employee_id
  LEFT JOIN public.designation_approval_flow daf
    ON daf.designation_id = e.designation_id
   AND daf.is_active = true
  WHERE ah.claim_id = c.id
    AND ah.new_status_id = v_submitted_id;

  UPDATE public.approval_history ah
  SET old_status_id = v_l1_pending_id
  WHERE ah.old_status_id = v_draft_id;

  UPDATE public.approval_history ah
  SET old_status_id = CASE
    WHEN ns.status_code = 'L1_PENDING' THEN v_l1_rejected_id
    WHEN ns.status_code = 'L2_PENDING' THEN v_l2_rejected_id
    WHEN ns.status_code = 'L3_PENDING_FINANCE_REVIEW' THEN v_l3_rejected_id
    WHEN ah.approval_level = 1 THEN v_l1_rejected_id
    WHEN ah.approval_level = 2 THEN v_l2_rejected_id
    ELSE v_l3_rejected_id
  END
  FROM public.claim_statuses ns
  WHERE ah.new_status_id = ns.id
    AND ah.old_status_id = v_returned_id;

  UPDATE public.approval_history ah
  SET new_status_id = CASE
    WHEN os.status_code = 'L1_PENDING' THEN v_l1_rejected_id
    WHEN os.status_code = 'L2_PENDING' THEN v_l2_rejected_id
    WHEN os.status_code = 'L3_PENDING_FINANCE_REVIEW' THEN v_l3_rejected_id
    WHEN os.status_code = 'L3_REJECTED_FINANCE' THEN v_l3_rejected_id
    WHEN ah.approval_level = 1 THEN v_l1_rejected_id
    WHEN ah.approval_level = 2 THEN v_l2_rejected_id
    ELSE v_l3_rejected_id
  END
  FROM public.claim_statuses os
  WHERE ah.old_status_id = os.id
    AND ah.new_status_id = v_returned_id;

  UPDATE public.approval_history ah
  SET old_status_id = v_approved_id
  WHERE ah.old_status_id = v_l4_pending_id;

  UPDATE public.approval_history ah
  SET new_status_id = v_approved_id
  WHERE ah.new_status_id = v_l4_pending_id;

  UPDATE public.approval_history ah
  SET old_status_id = v_l3_rejected_id
  WHERE ah.old_status_id = v_l4_failed_id;

  UPDATE public.approval_history ah
  SET new_status_id = v_l3_rejected_id
  WHERE ah.new_status_id = v_l4_failed_id;

  UPDATE public.claim_approvals
  SET old_status_id = v_l1_pending_id
  WHERE old_status_id IN (v_draft_id, v_submitted_id);

  UPDATE public.claim_approvals
  SET new_status_id = v_l1_pending_id
  WHERE new_status_id IN (v_draft_id, v_submitted_id);

  UPDATE public.claim_approvals
  SET old_status_id = v_l3_rejected_id
  WHERE old_status_id IN (v_returned_id, v_l4_failed_id);

  UPDATE public.claim_approvals
  SET new_status_id = v_l3_rejected_id
  WHERE new_status_id IN (v_returned_id, v_l4_failed_id);

  UPDATE public.claim_approvals
  SET old_status_id = v_approved_id
  WHERE old_status_id = v_l4_pending_id;

  UPDATE public.claim_approvals
  SET new_status_id = v_approved_id
  WHERE new_status_id = v_l4_pending_id;

  DELETE FROM public.claim_status_transitions
  WHERE from_status_id IN (v_draft_id, v_submitted_id, v_returned_id, v_l4_pending_id, v_l4_failed_id)
     OR to_status_id IN (v_draft_id, v_submitted_id, v_returned_id, v_l4_pending_id, v_l4_failed_id);

  SELECT count(*) INTO v_remaining
  FROM public.expense_claims
  WHERE status_id IN (v_draft_id, v_submitted_id, v_returned_id, v_l4_pending_id, v_l4_failed_id);
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Cannot delete legacy statuses: expense_claims still references % row(s).', v_remaining;
  END IF;

  SELECT count(*) INTO v_remaining
  FROM public.approval_history
  WHERE old_status_id IN (v_draft_id, v_submitted_id, v_returned_id, v_l4_pending_id, v_l4_failed_id)
     OR new_status_id IN (v_draft_id, v_submitted_id, v_returned_id, v_l4_pending_id, v_l4_failed_id);
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Cannot delete legacy statuses: approval_history still references % row(s).', v_remaining;
  END IF;

  SELECT count(*) INTO v_remaining
  FROM public.claim_approvals
  WHERE old_status_id IN (v_draft_id, v_submitted_id, v_returned_id, v_l4_pending_id, v_l4_failed_id)
     OR new_status_id IN (v_draft_id, v_submitted_id, v_returned_id, v_l4_pending_id, v_l4_failed_id);
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Cannot delete legacy statuses: claim_approvals still references % row(s).', v_remaining;
  END IF;

  DELETE FROM public.claim_statuses
  WHERE id IN (v_draft_id, v_submitted_id, v_returned_id, v_l4_pending_id, v_l4_failed_id);
END;
$cleanup$;

COMMIT;
