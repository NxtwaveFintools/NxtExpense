BEGIN;

DO $$
DECLARE
  v_approved_id uuid;
  v_approved_order integer;
  v_payment_released_id uuid;
  v_finance_role_id uuid;
  v_finance_review_id uuid;
BEGIN
  SELECT id, display_order
  INTO v_approved_id, v_approved_order
  FROM public.claim_statuses
  WHERE status_code = 'APPROVED'
  LIMIT 1;

  IF v_approved_id IS NULL THEN
    RAISE EXCEPTION 'APPROVED status is missing; cannot apply payment-release workflow migration.';
  END IF;

  UPDATE public.claim_statuses
  SET status_name = 'Finance Approved',
      status_description = 'Claim approved by finance and ready for payment release.',
      approval_level = NULL,
      is_approval = true,
      is_rejection = false,
      is_terminal = false,
      is_payment_issued = false,
      requires_comment = false,
      display_color = COALESCE(display_color, 'green'),
      display_order = COALESCE(display_order, 70),
      is_active = true
  WHERE id = v_approved_id;

  INSERT INTO public.claim_statuses (
    status_code,
    status_name,
    status_description,
    approval_level,
    is_approval,
    is_rejection,
    is_terminal,
    is_payment_issued,
    requires_comment,
    display_color,
    display_order,
    is_active
  )
  SELECT
    'PAYMENT_RELEASED',
    'Payment Released',
    'Payment has been released to employee.',
    NULL,
    true,
    false,
    true,
    true,
    false,
    'green',
    COALESCE(v_approved_order, 70) + 10,
    true
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.claim_statuses
    WHERE status_code = 'PAYMENT_RELEASED'
  );

  UPDATE public.claim_statuses
  SET status_name = 'Payment Released',
      status_description = 'Payment has been released to employee.',
      approval_level = NULL,
      is_approval = true,
      is_rejection = false,
      is_terminal = true,
      is_payment_issued = true,
      requires_comment = false,
      display_color = COALESCE(display_color, 'green'),
      display_order = COALESCE(display_order, COALESCE(v_approved_order, 70) + 10),
      is_active = true
  WHERE status_code = 'PAYMENT_RELEASED';

  SELECT id
  INTO v_payment_released_id
  FROM public.claim_statuses
  WHERE status_code = 'PAYMENT_RELEASED'
  LIMIT 1;

  IF v_payment_released_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_RELEASED status could not be created.';
  END IF;

  SELECT id
  INTO v_finance_role_id
  FROM public.roles
  WHERE role_code = 'FINANCE_TEAM'
  LIMIT 1;

  IF v_finance_role_id IS NULL THEN
    RAISE EXCEPTION 'FINANCE_TEAM role is missing; cannot create release transitions.';
  END IF;

  SELECT id
  INTO v_finance_review_id
  FROM public.claim_statuses
  WHERE is_active = true
    AND approval_level = 3
    AND is_approval = false
    AND is_rejection = false
    AND is_terminal = false
  ORDER BY display_order NULLS LAST, created_at ASC
  LIMIT 1;

  IF v_finance_review_id IS NULL THEN
    RAISE EXCEPTION 'Finance review status is missing; cannot create finance approval transition.';
  END IF;

  UPDATE public.claim_status_transitions
  SET action_code = 'finance_approved',
      requires_comment = false,
      is_auto_transition = false,
      allow_resubmit = NULL,
      is_active = true
  WHERE from_status_id = v_finance_review_id
    AND to_status_id = v_approved_id
    AND requires_role_id = v_finance_role_id
    AND is_auto_transition = false;

  INSERT INTO public.claim_status_transitions (
    from_status_id,
    to_status_id,
    requires_role_id,
    requires_comment,
    is_auto_transition,
    validation_rules,
    is_active,
    action_code,
    allow_resubmit
  )
  SELECT
    v_finance_review_id,
    v_approved_id,
    v_finance_role_id,
    false,
    false,
    NULL,
    true,
    'finance_approved',
    NULL
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.claim_status_transitions cst
    WHERE cst.from_status_id = v_finance_review_id
      AND cst.to_status_id = v_approved_id
      AND cst.requires_role_id = v_finance_role_id
  );

  INSERT INTO public.claim_status_transitions (
    from_status_id,
    to_status_id,
    requires_role_id,
    requires_comment,
    is_auto_transition,
    validation_rules,
    is_active,
    action_code,
    allow_resubmit
  )
  VALUES (
    v_approved_id,
    v_payment_released_id,
    v_finance_role_id,
    false,
    false,
    NULL,
    true,
    'payment_released',
    NULL
  )
  ON CONFLICT (from_status_id, to_status_id, requires_role_id)
  DO UPDATE
  SET action_code = 'payment_released',
      requires_comment = false,
      is_auto_transition = false,
      allow_resubmit = NULL,
      is_active = true;

  UPDATE public.claim_status_transitions
  SET action_code = 'finance_approved',
      is_active = true
  WHERE requires_role_id = v_finance_role_id
    AND is_auto_transition = false
    AND to_status_id = v_approved_id
    AND action_code IN ('issued', 'finance_issued', 'approved');

  -- Keep existing records semantically aligned with the new workflow terminology.
  UPDATE public.finance_actions
  SET action = 'finance_approved'
  WHERE action IN ('issued', 'finance_issued');

  UPDATE public.approval_history
  SET action = 'finance_approved'
  WHERE action IN ('issued', 'finance_issued')
    AND approval_level IS NULL;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
