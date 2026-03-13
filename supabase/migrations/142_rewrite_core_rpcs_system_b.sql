-- Migration 142: Core RPC Rewrite — System B (claim_status_transitions)
-- Rewrites all 5 atomic workflow RPCs to:
--   1. Use claim_status_transitions instead of claim_transition_graph
--   2. Use approval_employee_id_level_1/3 instead of approval_email_level_1/2/3
--   3. Use FINANCE_TEAM role instead of FINANCE_REVIEWER + FINANCE_PROCESSOR
--   4. Route via designation_approval_flow (first required_approval_level)
-- Backward compat: still writes expense_claims.status (text) until mig 144 drops it

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. resubmit_claim_after_rejection_atomic
--    Handles both: initial workflow routing (status='submitted') and
--    employee resubmission after RETURNED_FOR_MODIFICATION.
--    Uses designation_approval_flow to determine the first approval stop.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resubmit_claim_after_rejection_atomic(
  p_claim_id uuid,
  p_notes    text DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status text, new_approval_level int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email                 text;
  v_employee_id           uuid;
  v_notes                 text;
  v_claim                 public.expense_claims%rowtype;
  v_owner                 public.employees%rowtype;
  v_required_levels       int[];
  v_first_level           int;
  v_next_status_code      text;
  v_next_status_text      text;
  v_next_approval_level   int;
  v_next_status_id        uuid;
  v_old_status_id         uuid;
  v_is_resubmission       boolean;
  v_trigger_action        text;
BEGIN
  v_email := public.current_user_email();
  IF coalesce(v_email, '') = '' THEN RAISE EXCEPTION 'Unauthorized request.'; END IF;
  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  SELECT id INTO v_employee_id FROM public.employees WHERE lower(employee_email) = v_email;
  IF v_employee_id IS NULL THEN RAISE EXCEPTION 'Employee record not found.'; END IF;

  -- Claim must belong to this employee
  SELECT c.* INTO v_claim
  FROM public.expense_claims c
  JOIN public.employees e ON e.id = c.employee_id
  WHERE c.id = p_claim_id AND lower(e.employee_email) = v_email
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found for current employee.'; END IF;

  IF v_claim.status NOT IN ('returned_for_modification', 'submitted') THEN
    RAISE EXCEPTION 'Only submitted or returned claims can be routed through the workflow.';
  END IF;

  v_is_resubmission := (v_claim.status = 'returned_for_modification');
  v_trigger_action  := CASE WHEN v_is_resubmission THEN 'resubmit' ELSE 'submit' END;

  SELECT * INTO v_owner FROM public.employees WHERE id = v_claim.employee_id;

  -- Resolve designation approval flow
  SELECT daf.required_approval_levels INTO v_required_levels
  FROM public.designation_approval_flow daf
  WHERE daf.designation_id = COALESCE(
    v_owner.designation_id,
    (SELECT d.id FROM public.designations d WHERE d.designation_name = v_owner.designation LIMIT 1)
  )
  AND daf.is_active = true;

  IF v_required_levels IS NULL OR array_length(v_required_levels, 1) = 0 THEN
    RAISE EXCEPTION 'No approval flow configured for this employee''s designation.';
  END IF;

  v_first_level := v_required_levels[1];

  -- Map first required level to the next status
  IF v_first_level = 1 THEN
    v_next_status_code    := 'L1_PENDING';
    v_next_status_text    := 'pending_approval';
    v_next_approval_level := 1;
  ELSIF v_first_level = 2 THEN
    v_next_status_code    := 'L2_PENDING';
    v_next_status_text    := 'pending_approval';
    v_next_approval_level := 2;
  ELSIF v_first_level = 3 THEN
    v_next_status_code    := 'L3_PENDING_FINANCE_REVIEW';
    v_next_status_text    := 'finance_review';
    v_next_approval_level := NULL;
  ELSE
    RAISE EXCEPTION 'Unexpected first approval level: %', v_first_level;
  END IF;

  SELECT id INTO v_next_status_id
  FROM public.claim_statuses WHERE status_code = v_next_status_code;

  v_old_status_id := v_claim.status_id;

  UPDATE public.expense_claims
  SET status                  = v_next_status_text,
      status_id               = v_next_status_id,
      current_approval_level  = v_next_approval_level,
      resubmission_count      = CASE WHEN v_is_resubmission THEN coalesce(resubmission_count, 0) + 1 ELSE resubmission_count END,
      submitted_at            = CASE WHEN NOT v_is_resubmission THEN now() ELSE submitted_at END,
      updated_at              = now()
  WHERE id = v_claim.id;

  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes,
    old_status_id, new_status_id, metadata
  ) VALUES (
    v_claim.id, v_employee_id, null, v_trigger_action, v_notes,
    v_old_status_id, v_next_status_id,
    jsonb_build_object('is_resubmission', v_is_resubmission, 'first_level', v_first_level)
  );

  PERFORM public.log_claim_status_audit(
    v_claim.id, v_email, 'employee', v_trigger_action,
    v_claim.status, v_next_status_text,
    v_claim.current_approval_level, v_next_approval_level,
    null, v_notes, jsonb_build_object('is_resubmission', v_is_resubmission)
  );

  RETURN QUERY SELECT v_claim.id, v_next_status_text, v_next_approval_level;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. submit_approval_action_atomic
--    Handles approver actions: approved / rejected
--    Level 1 (L1_PENDING): checks approval_employee_id_level_1 + APPROVER_L1 role
--    Level 2 (L2_PENDING): checks approval_employee_id_level_3 + APPROVER_L2 role (Mansoor)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_approval_action_atomic(
  p_claim_id      uuid,
  p_action        text,
  p_notes         text    DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status text, new_approval_level int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email                  text;
  v_actor_employee_id      uuid;
  v_claim                  public.expense_claims%rowtype;
  v_owner                  public.employees%rowtype;
  v_transition             public.claim_status_transitions%rowtype;
  v_notes                  text;
  v_level                  int;
  v_required_role_code     text;
  v_next_status_code       text;
  v_next_status_text       text;
  v_next_approval_level    int;
  v_next_status_id         uuid;
  v_old_status_id          uuid;
BEGIN
  IF p_action NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Unsupported approval action.';
  END IF;

  v_email := public.current_user_email();
  IF coalesce(v_email, '') = '' THEN RAISE EXCEPTION 'Unauthorized request.'; END IF;
  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  SELECT id INTO v_actor_employee_id
  FROM public.employees WHERE lower(employee_email) = v_email;
  IF v_actor_employee_id IS NULL THEN RAISE EXCEPTION 'Employee record not found.'; END IF;

  SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found.'; END IF;

  SELECT * INTO v_owner FROM public.employees WHERE id = v_claim.employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim owner not found.'; END IF;

  -- Determine which approval level this claim is at
  v_level := v_claim.current_approval_level;

  IF v_level = 1 THEN
    -- Must be the specifically assigned L1 approver (SBH) for this employee
    IF v_owner.approval_employee_id_level_1 IS DISTINCT FROM v_actor_employee_id THEN
      RAISE EXCEPTION 'You are not the assigned Level 1 approver for this employee.';
    END IF;
    -- Must have APPROVER_L1 role
    IF NOT EXISTS (
      SELECT 1 FROM public.employee_roles er
      JOIN public.roles r ON r.id = er.role_id
      WHERE er.employee_id = v_actor_employee_id
        AND r.role_code = 'APPROVER_L1'
        AND er.is_active = true
    ) THEN
      RAISE EXCEPTION 'Level 1 approval requires APPROVER_L1 role.';
    END IF;
    v_required_role_code := 'APPROVER_L1';

  ELSIF v_level = 2 THEN
    -- Must be the HOD approver (Mansoor), stored in level_3 slot for all employees
    IF v_owner.approval_employee_id_level_3 IS DISTINCT FROM v_actor_employee_id THEN
      RAISE EXCEPTION 'You are not the assigned Level 2 (HOD) approver for this employee.';
    END IF;
    -- Must have APPROVER_L2 role (only Mansoor retains this after mig 138)
    IF NOT EXISTS (
      SELECT 1 FROM public.employee_roles er
      JOIN public.roles r ON r.id = er.role_id
      WHERE er.employee_id = v_actor_employee_id
        AND r.role_code = 'APPROVER_L2'
        AND er.is_active = true
    ) THEN
      RAISE EXCEPTION 'Level 2 approval requires APPROVER_L2 role.';
    END IF;
    v_required_role_code := 'APPROVER_L2';

  ELSE
    RAISE EXCEPTION 'Claim is not at an approver-actionable level (current level = %).', v_level;
  END IF;

  -- Find the transition in claim_status_transitions
  SELECT cst.* INTO v_transition
  FROM public.claim_status_transitions cst
  WHERE cst.from_status_id   = v_claim.status_id
    AND cst.is_active         = true
    AND cst.action_code       = p_action
    AND cst.requires_role_id  = (SELECT id FROM public.roles WHERE role_code = v_required_role_code)
    AND cst.allow_resubmit    IS NOT DISTINCT FROM (
          CASE WHEN p_action = 'rejected' THEN p_allow_resubmit ELSE NULL END
        )
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'No transition configured for this approval action.'; END IF;
  IF v_transition.requires_comment AND v_notes IS NULL THEN
    RAISE EXCEPTION 'Notes are required for this action.';
  END IF;

  -- Resolve next status details
  SELECT status_code INTO v_next_status_code
  FROM public.claim_statuses WHERE id = v_transition.to_status_id;

  v_next_status_id      := v_transition.to_status_id;
  v_old_status_id       := v_claim.status_id;
  v_next_approval_level := CASE v_next_status_code
    WHEN 'L1_PENDING' THEN 1
    WHEN 'L2_PENDING' THEN 2
    ELSE NULL
  END;
  v_next_status_text    := CASE v_next_status_code
    WHEN 'L1_PENDING'                THEN 'pending_approval'
    WHEN 'L2_PENDING'                THEN 'pending_approval'
    WHEN 'L3_PENDING_FINANCE_REVIEW' THEN 'finance_review'
    WHEN 'APPROVED'                  THEN 'issued'
    WHEN 'L1_REJECTED'               THEN 'rejected'
    WHEN 'L2_REJECTED'               THEN 'rejected'
    WHEN 'L3_REJECTED_FINANCE'       THEN 'finance_rejected'
    WHEN 'RETURNED_FOR_MODIFICATION' THEN 'returned_for_modification'
    ELSE v_next_status_code
  END;

  UPDATE public.expense_claims
  SET status                       = v_next_status_text,
      status_id                    = v_next_status_id,
      current_approval_level       = v_next_approval_level,
      last_rejection_notes         = CASE WHEN p_action = 'rejected' THEN v_notes ELSE last_rejection_notes END,
      last_rejected_by_employee_id = CASE WHEN p_action = 'rejected' THEN v_actor_employee_id ELSE last_rejected_by_employee_id END,
      last_rejected_at             = CASE WHEN p_action = 'rejected' THEN now() ELSE last_rejected_at END,
      updated_at                   = now()
  WHERE id = v_claim.id;

  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes,
    rejection_notes, allow_resubmit, metadata, old_status_id, new_status_id
  ) VALUES (
    v_claim.id, v_actor_employee_id, v_level, p_action, v_notes,
    CASE WHEN p_action = 'rejected' THEN v_notes ELSE null END,
    CASE WHEN p_action = 'rejected' THEN p_allow_resubmit ELSE null END,
    jsonb_build_object('transition_id', v_transition.id),
    v_old_status_id, v_next_status_id
  );

  PERFORM public.log_claim_status_audit(
    v_claim.id, v_email, 'approver', p_action,
    v_claim.status, v_next_status_text,
    v_claim.current_approval_level, v_next_approval_level,
    CASE WHEN p_action = 'rejected' THEN p_allow_resubmit ELSE null END,
    v_notes, jsonb_build_object('transition_id', v_transition.id)
  );

  RETURN QUERY SELECT v_claim.id, v_next_status_text, v_next_approval_level;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. submit_finance_action_atomic
--    Handles finance actions: finance_issued / finance_rejected / reopened
--    Now checks FINANCE_TEAM role (replaces FINANCE_REVIEWER + FINANCE_PROCESSOR)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_finance_action_atomic(
  p_claim_id       uuid,
  p_action         text,
  p_notes          text    DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email                  text;
  v_actor_employee_id      uuid;
  v_notes                  text;
  v_claim                  public.expense_claims%rowtype;
  v_transition             public.claim_status_transitions%rowtype;
  v_next_status_code       text;
  v_next_status_text       text;
  v_next_status_id         uuid;
  v_old_status_id          uuid;
  v_action_code            text;
  v_history_action         text;
BEGIN
  IF p_action NOT IN ('issued', 'finance_rejected', 'reopened') THEN
    RAISE EXCEPTION 'Unsupported finance action.';
  END IF;

  v_email := public.current_user_email();
  IF coalesce(v_email, '') = '' THEN RAISE EXCEPTION 'Unauthorized request.'; END IF;
  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  SELECT id INTO v_actor_employee_id
  FROM public.employees WHERE lower(employee_email) = v_email;

  -- Verify FINANCE_TEAM membership
  IF NOT EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.employee_roles er ON er.employee_id = e.id AND er.is_active = true
    JOIN public.roles r ON r.id = er.role_id
    WHERE lower(e.employee_email) = v_email AND r.role_code = 'FINANCE_TEAM'
  ) THEN
    RAISE EXCEPTION 'Finance Team access is required.';
  END IF;

  SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found.'; END IF;

  -- Map external action name to internal action_code in claim_status_transitions
  v_action_code    := CASE p_action
    WHEN 'issued'           THEN 'finance_issued'
    WHEN 'finance_rejected' THEN 'finance_rejected'
    WHEN 'reopened'         THEN 'reopened'
  END;
  v_history_action := CASE p_action
    WHEN 'issued'           THEN 'finance_issued'
    WHEN 'reopened'         THEN 'reopened'
    ELSE 'finance_rejected'
  END;

  SELECT cst.* INTO v_transition
  FROM public.claim_status_transitions cst
  WHERE cst.from_status_id  = v_claim.status_id
    AND cst.is_active         = true
    AND cst.action_code       = v_action_code
    AND cst.requires_role_id  = (SELECT id FROM public.roles WHERE role_code = 'FINANCE_TEAM')
    AND cst.allow_resubmit    IS NOT DISTINCT FROM (
          CASE WHEN p_action = 'finance_rejected' THEN p_allow_resubmit ELSE NULL END
        )
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'No transition configured for this finance action.'; END IF;
  IF v_transition.requires_comment AND v_notes IS NULL THEN
    RAISE EXCEPTION 'Notes are required for this action.';
  END IF;

  SELECT status_code INTO v_next_status_code
  FROM public.claim_statuses WHERE id = v_transition.to_status_id;

  v_next_status_id  := v_transition.to_status_id;
  v_old_status_id   := v_claim.status_id;
  v_next_status_text := CASE v_next_status_code
    WHEN 'APPROVED'                    THEN 'issued'
    WHEN 'L3_REJECTED_FINANCE'         THEN 'finance_rejected'
    WHEN 'L3_PENDING_FINANCE_REVIEW'   THEN 'finance_review'
    WHEN 'RETURNED_FOR_MODIFICATION'   THEN 'returned_for_modification'
    ELSE v_next_status_code
  END;

  UPDATE public.expense_claims
  SET status                       = v_next_status_text,
      status_id                    = v_next_status_id,
      current_approval_level       = NULL,
      last_rejection_notes         = CASE WHEN p_action = 'finance_rejected' THEN v_notes ELSE last_rejection_notes END,
      last_rejected_by_employee_id = CASE WHEN p_action = 'finance_rejected' THEN v_actor_employee_id ELSE last_rejected_by_employee_id END,
      last_rejected_at             = CASE WHEN p_action = 'finance_rejected' THEN now() ELSE last_rejected_at END,
      issued_at                    = CASE WHEN p_action = 'issued' THEN now() ELSE issued_at END,
      updated_at                   = now()
  WHERE id = v_claim.id;

  INSERT INTO public.finance_actions (claim_id, actor_employee_id, action, notes)
  VALUES (v_claim.id, v_actor_employee_id, p_action, v_notes);

  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes,
    rejection_notes, allow_resubmit, metadata, old_status_id, new_status_id
  ) VALUES (
    v_claim.id, v_actor_employee_id, null, v_history_action, v_notes,
    CASE WHEN p_action = 'finance_rejected' THEN v_notes ELSE null END,
    CASE WHEN p_action = 'finance_rejected' THEN p_allow_resubmit ELSE null END,
    jsonb_build_object('transition_id', v_transition.id),
    v_old_status_id, v_next_status_id
  );

  PERFORM public.log_claim_status_audit(
    v_claim.id, v_email, 'finance', v_action_code,
    v_claim.status, v_next_status_text,
    v_claim.current_approval_level, NULL,
    CASE WHEN p_action = 'finance_rejected' THEN p_allow_resubmit ELSE null END,
    v_notes, jsonb_build_object('transition_id', v_transition.id)
  );

  RETURN QUERY SELECT v_claim.id, v_next_status_text;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. admin_rollback_claim_atomic
--    Uses claim_status_audit to find previous state; no longer queries
--    claim_transition_graph — resolves status_id via resolve_status_id() bridge.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_rollback_claim_atomic(
  p_claim_id     uuid,
  p_reason       text,
  p_confirmation text DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, rolled_back_to_status text, rolled_back_to_level int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email               text;
  v_admin_employee_id   uuid;
  v_reason              text;
  v_claim               public.expense_claims%rowtype;
  v_last_audit          public.claim_status_audit%rowtype;
  v_target_level        int;
  v_target_status_id    uuid;
BEGIN
  v_email  := public.current_user_email();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  IF coalesce(v_email, '') = ''  THEN RAISE EXCEPTION 'Unauthorized request.'; END IF;
  IF p_confirmation <> 'CONFIRM' THEN RAISE EXCEPTION 'Secondary confirmation is required.'; END IF;
  IF v_reason IS NULL            THEN RAISE EXCEPTION 'Rollback reason is required.'; END IF;

  -- Verify ADMIN role
  SELECT e.id INTO v_admin_employee_id
  FROM public.employees e
  JOIN public.employee_roles er ON er.employee_id = e.id AND er.is_active = true
  JOIN public.roles r ON r.id = er.role_id
  WHERE lower(e.employee_email) = v_email AND r.role_code = 'ADMIN'
  LIMIT 1;
  IF v_admin_employee_id IS NULL THEN RAISE EXCEPTION 'Admin access is required.'; END IF;

  -- Rate limit: no second override in 30 seconds
  IF EXISTS (
    SELECT 1 FROM public.approval_history h
    WHERE h.approver_employee_id = v_admin_employee_id
      AND h.action = 'admin_override'
      AND h.acted_at > now() - INTERVAL '30 seconds'
  ) THEN RAISE EXCEPTION 'Please wait before applying another admin override.'; END IF;

  SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found.'; END IF;

  -- Find the most recent audit record (gives the previous state)
  SELECT * INTO v_last_audit
  FROM public.claim_status_audit a
  WHERE a.claim_id = v_claim.id
  ORDER BY a.changed_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No status audit found for rollback.'; END IF;

  -- Resolve status_id for the target (from_status text + from_approval_level)
  v_target_level     := v_last_audit.from_approval_level;
  v_target_status_id := public.resolve_status_id(v_last_audit.from_status, v_target_level);

  UPDATE public.expense_claims
  SET status                 = v_last_audit.from_status,
      status_id              = v_target_status_id,
      current_approval_level = v_target_level,
      updated_at             = now()
  WHERE id = v_claim.id;

  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes, reason, metadata
  ) VALUES (
    v_claim.id, v_admin_employee_id, null, 'admin_override', v_reason, v_reason,
    jsonb_build_object(
      'from_status', v_claim.status,
      'to_status',   v_last_audit.from_status,
      'from_level',  v_claim.current_approval_level,
      'to_level',    v_target_level
    )
  );

  PERFORM public.log_claim_status_audit(
    v_claim.id, v_email, 'admin', 'admin_override',
    v_claim.status,         v_last_audit.from_status,
    v_claim.current_approval_level, v_target_level,
    null, v_reason, jsonb_build_object('operation', 'rollback')
  );

  RETURN QUERY SELECT v_claim.id, v_last_audit.from_status, v_target_level;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. admin_reassign_employee_approvers_atomic
--    Now updates BOTH email columns (backward compat) and the new ID columns.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reassign_employee_approvers_atomic(
  p_employee_id   uuid,
  p_level_1       text DEFAULT NULL,
  p_level_2       text DEFAULT NULL,
  p_level_3       text DEFAULT NULL,
  p_reason        text DEFAULT NULL,
  p_confirmation  text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email               text;
  v_admin_employee_id   uuid;
  v_reason              text;
  v_l1_email            text;
  v_l2_email            text;
  v_l3_email            text;
  v_l1_id               uuid;
  v_l2_id               uuid;
  v_l3_id               uuid;
  v_claim_count         int;
BEGIN
  v_email  := public.current_user_email();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  IF coalesce(v_email, '') = ''  THEN RAISE EXCEPTION 'Unauthorized request.'; END IF;
  IF p_confirmation <> 'CONFIRM' THEN RAISE EXCEPTION 'Secondary confirmation is required.'; END IF;
  IF v_reason IS NULL            THEN RAISE EXCEPTION 'Reassignment reason is required.'; END IF;

  SELECT e.id INTO v_admin_employee_id
  FROM public.employees e
  JOIN public.employee_roles er ON er.employee_id = e.id AND er.is_active = true
  JOIN public.roles r ON r.id = er.role_id
  WHERE lower(e.employee_email) = v_email AND r.role_code = 'ADMIN'
  LIMIT 1;
  IF v_admin_employee_id IS NULL THEN RAISE EXCEPTION 'Admin access is required.'; END IF;

  v_l1_email := nullif(lower(trim(coalesce(p_level_1, ''))), '');
  v_l2_email := nullif(lower(trim(coalesce(p_level_2, ''))), '');
  v_l3_email := nullif(lower(trim(coalesce(p_level_3, ''))), '');

  -- Resolve email → employee ID for each level
  IF v_l1_email IS NOT NULL THEN
    SELECT id INTO v_l1_id FROM public.employees WHERE lower(employee_email) = v_l1_email;
    IF v_l1_id IS NULL THEN RAISE EXCEPTION 'Level 1 approver email not found: %', v_l1_email; END IF;
  END IF;
  IF v_l2_email IS NOT NULL THEN
    SELECT id INTO v_l2_id FROM public.employees WHERE lower(employee_email) = v_l2_email;
    IF v_l2_id IS NULL THEN RAISE EXCEPTION 'Level 2 approver email not found: %', v_l2_email; END IF;
  END IF;
  IF v_l3_email IS NOT NULL THEN
    SELECT id INTO v_l3_id FROM public.employees WHERE lower(employee_email) = v_l3_email;
    IF v_l3_id IS NULL THEN RAISE EXCEPTION 'Level 3 approver email not found: %', v_l3_email; END IF;
  END IF;

  -- Update both email columns (backward compat) and ID columns (new system)
  UPDATE public.employees
  SET approval_email_level_1         = v_l1_email,
      approval_email_level_2         = v_l2_email,
      approval_email_level_3         = v_l3_email,
      approval_employee_id_level_1   = v_l1_id,
      approval_employee_id_level_2   = v_l2_id,
      approval_employee_id_level_3   = v_l3_id
  WHERE id = p_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found for approver reassignment.'; END IF;

  -- Log metadata for all in-flight claims of this employee
  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes, reason, metadata
  )
  SELECT c.id, v_admin_employee_id, null, 'admin_override', v_reason, v_reason,
    jsonb_build_object(
      'operation',              'reassign_approvers',
      'employee_id',            p_employee_id,
      'approval_email_level_1', v_l1_email,
      'approval_email_level_2', v_l2_email,
      'approval_email_level_3', v_l3_email
    )
  FROM public.expense_claims c
  WHERE c.employee_id = p_employee_id
    AND c.status IN ('pending_approval', 'returned_for_modification', 'finance_review');

  GET DIAGNOSTICS v_claim_count = ROW_COUNT;
  RETURN v_claim_count;
END;
$$;

COMMIT;
