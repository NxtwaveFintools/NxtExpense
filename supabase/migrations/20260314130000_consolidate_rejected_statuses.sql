BEGIN;

DO $consolidate$
DECLARE
  v_rejected_id uuid;
  v_l1_rejected_id uuid;
  v_l2_rejected_id uuid;
  v_l3_rejected_id uuid;
BEGIN
  SELECT id INTO v_rejected_id
  FROM public.claim_statuses
  WHERE status_code = 'REJECTED';

  SELECT id INTO v_l1_rejected_id
  FROM public.claim_statuses
  WHERE status_code = 'L1_REJECTED';

  SELECT id INTO v_l2_rejected_id
  FROM public.claim_statuses
  WHERE status_code = 'L2_REJECTED';

  SELECT id INTO v_l3_rejected_id
  FROM public.claim_statuses
  WHERE status_code = 'L3_REJECTED_FINANCE';

  IF v_rejected_id IS NULL THEN
    v_rejected_id := v_l3_rejected_id;
  END IF;

  IF v_rejected_id IS NULL THEN
    RAISE EXCEPTION 'No canonical rejected status row found (expected REJECTED or L3_REJECTED_FINANCE).';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.claim_statuses
    WHERE status_name = 'Rejected'
      AND id <> v_rejected_id
  ) THEN
    RAISE EXCEPTION 'Cannot consolidate rejected statuses because another row already uses status_name=Rejected.';
  END IF;

  -- Remap all references to canonical rejected status.
  UPDATE public.expense_claims
  SET status_id = v_rejected_id,
      current_approval_level = NULL,
      updated_at = now()
  WHERE status_id IN (v_l1_rejected_id, v_l2_rejected_id, v_l3_rejected_id)
    AND status_id IS DISTINCT FROM v_rejected_id;

  UPDATE public.approval_history
  SET old_status_id = v_rejected_id
  WHERE old_status_id IN (v_l1_rejected_id, v_l2_rejected_id, v_l3_rejected_id)
    AND old_status_id IS DISTINCT FROM v_rejected_id;

  UPDATE public.approval_history
  SET new_status_id = v_rejected_id
  WHERE new_status_id IN (v_l1_rejected_id, v_l2_rejected_id, v_l3_rejected_id)
    AND new_status_id IS DISTINCT FROM v_rejected_id;

  UPDATE public.claim_approvals
  SET old_status_id = v_rejected_id
  WHERE old_status_id IN (v_l1_rejected_id, v_l2_rejected_id, v_l3_rejected_id)
    AND old_status_id IS DISTINCT FROM v_rejected_id;

  UPDATE public.claim_approvals
  SET new_status_id = v_rejected_id
  WHERE new_status_id IN (v_l1_rejected_id, v_l2_rejected_id, v_l3_rejected_id)
    AND new_status_id IS DISTINCT FROM v_rejected_id;

  UPDATE public.claim_status_transitions
  SET from_status_id = v_rejected_id
  WHERE from_status_id IN (v_l1_rejected_id, v_l2_rejected_id, v_l3_rejected_id)
    AND from_status_id IS DISTINCT FROM v_rejected_id;

  UPDATE public.claim_status_transitions
  SET to_status_id = v_rejected_id
  WHERE to_status_id IN (v_l1_rejected_id, v_l2_rejected_id, v_l3_rejected_id)
    AND to_status_id IS DISTINCT FROM v_rejected_id;

  -- Canonical row metadata.
  UPDATE public.claim_statuses
  SET status_code = 'REJECTED',
      status_name = 'Rejected',
      status_description = 'Claim rejected by approver or finance.',
      approval_level = NULL,
      is_approval = false,
      is_rejection = true,
      is_terminal = true,
      is_payment_issued = false,
      display_color = 'red',
      is_active = true
  WHERE id = v_rejected_id;

  -- Drop obsolete rows.
  DELETE FROM public.claim_statuses
  WHERE status_code IN ('L1_REJECTED', 'L2_REJECTED', 'L3_REJECTED_FINANCE')
    AND id <> v_rejected_id;
END;
$consolidate$;

COMMIT;
