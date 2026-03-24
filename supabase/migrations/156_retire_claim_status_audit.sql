BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 156: Retire claim_status_audit write path
--
-- The claim_status_audit table is a legacy text-based audit log that duplicates
-- data already captured in approval_history (UUID-based, structured).
-- This migration removes the PERFORM log_claim_status_audit(...) call from
-- all four workflow RPCs so no new rows are written, then drops the function.
-- The claim_status_audit TABLE is preserved for historical read access.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. submit_approval_action_atomic ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_approval_action_atomic(
  p_claim_id uuid,
  p_action text,
  p_notes text DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status_code text, new_approval_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  SELECT id INTO v_actor_employee_id FROM public.employees WHERE lower(employee_email) = v_email;
  IF v_actor_employee_id IS NULL THEN RAISE EXCEPTION 'Employee record not found.'; END IF;

  SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found.'; END IF;

  SELECT * INTO v_owner FROM public.employees WHERE id = v_claim.employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim owner not found.'; END IF;

  v_level := v_claim.current_approval_level;

  IF v_level = 1 THEN
    IF v_owner.approval_employee_id_level_1 IS DISTINCT FROM v_actor_employee_id THEN
      RAISE EXCEPTION 'You are not the assigned Level 1 approver for this employee.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.employee_roles er JOIN public.roles r ON r.id = er.role_id
      WHERE er.employee_id = v_actor_employee_id AND r.role_code = 'APPROVER_L1' AND er.is_active = true
    ) THEN RAISE EXCEPTION 'Level 1 approval requires APPROVER_L1 role.'; END IF;
    v_required_role_code := 'APPROVER_L1';
  ELSIF v_level = 2 THEN
    IF v_owner.approval_employee_id_level_3 IS DISTINCT FROM v_actor_employee_id THEN
      RAISE EXCEPTION 'You are not the assigned Level 2 (HOD) approver for this employee.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.employee_roles er JOIN public.roles r ON r.id = er.role_id
      WHERE er.employee_id = v_actor_employee_id AND r.role_code = 'APPROVER_L2' AND er.is_active = true
    ) THEN RAISE EXCEPTION 'Level 2 approval requires APPROVER_L2 role.'; END IF;
    v_required_role_code := 'APPROVER_L2';
  ELSE
    RAISE EXCEPTION 'Claim is not at an approver-actionable level (current level = %).', v_level;
  END IF;

  SELECT cst.* INTO v_transition
  FROM public.claim_status_transitions cst
  WHERE cst.from_status_id  = v_claim.status_id
    AND cst.is_active         = true
    AND cst.action_code       = p_action
    AND cst.requires_role_id  = (SELECT id FROM public.roles WHERE role_code = v_required_role_code)
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'No transition configured for this approval action.'; END IF;
  IF v_transition.requires_comment AND v_notes IS NULL THEN
    RAISE EXCEPTION 'Notes are required for this action.';
  END IF;

  SELECT status_code INTO v_next_status_code FROM public.claim_statuses WHERE id = v_transition.to_status_id;
  v_next_status_id      := v_transition.to_status_id;
  v_old_status_id       := v_claim.status_id;

  v_next_approval_level := CASE v_next_status_code
    WHEN 'L1_PENDING' THEN 1
    WHEN 'L2_PENDING' THEN 2
    ELSE NULL
  END;

  UPDATE public.expense_claims
  SET status_id                    = v_next_status_id,
      current_approval_level       = v_next_approval_level,
      allow_resubmit               = CASE WHEN p_action = 'rejected' THEN coalesce(p_allow_resubmit, false) ELSE false END,
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

  RETURN QUERY SELECT v_claim.id, v_next_status_code, v_next_approval_level;
END;
$$;

-- ── 2. submit_finance_action_atomic ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_finance_action_atomic(
  p_claim_id uuid,
  p_action text,
  p_notes text DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email                  text;
  v_actor_employee_id      uuid;
  v_notes                  text;
  v_claim                  public.expense_claims%rowtype;
  v_transition             public.claim_status_transitions%rowtype;
  v_next_status_code       text;
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

  SELECT id INTO v_actor_employee_id FROM public.employees WHERE lower(employee_email) = v_email;

  IF NOT EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.employee_roles er ON er.employee_id = e.id AND er.is_active = true
    JOIN public.roles r ON r.id = er.role_id
    WHERE lower(e.employee_email) = v_email AND r.role_code = 'FINANCE_TEAM'
  ) THEN RAISE EXCEPTION 'Finance Team access is required.'; END IF;

  SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found.'; END IF;

  v_action_code    := CASE p_action
    WHEN 'issued'           THEN 'finance_issued'
    WHEN 'reopened'         THEN 'reopened'
    ELSE 'finance_rejected'
  END;
  v_history_action := v_action_code;

  SELECT cst.* INTO v_transition
  FROM public.claim_status_transitions cst
  WHERE cst.from_status_id  = v_claim.status_id
    AND cst.is_active         = true
    AND cst.action_code       = v_action_code
    AND cst.requires_role_id  = (SELECT id FROM public.roles WHERE role_code = 'FINANCE_TEAM')
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'No transition configured for this finance action.'; END IF;
  IF v_transition.requires_comment AND v_notes IS NULL THEN
    RAISE EXCEPTION 'Notes are required for this action.';
  END IF;

  SELECT status_code INTO v_next_status_code FROM public.claim_statuses WHERE id = v_transition.to_status_id;
  v_next_status_id := v_transition.to_status_id;
  v_old_status_id  := v_claim.status_id;

  UPDATE public.expense_claims
  SET status_id                    = v_next_status_id,
      current_approval_level       = NULL,
      allow_resubmit               = CASE WHEN p_action = 'finance_rejected' THEN coalesce(p_allow_resubmit, false) ELSE false END,
      last_rejection_notes         = CASE WHEN p_action = 'finance_rejected' THEN v_notes ELSE last_rejection_notes END,
      last_rejected_by_employee_id = CASE WHEN p_action = 'finance_rejected' THEN v_actor_employee_id ELSE last_rejected_by_employee_id END,
      last_rejected_at             = CASE WHEN p_action = 'finance_rejected' THEN now() ELSE last_rejected_at END,
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

  RETURN QUERY SELECT v_claim.id, v_next_status_code;
END;
$$;

-- ── 3. resubmit_claim_after_rejection_atomic ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.resubmit_claim_after_rejection_atomic(
  p_claim_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status_code text, new_approval_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email                 text;
  v_employee_id           uuid;
  v_notes                 text;
  v_claim                 public.expense_claims%rowtype;
  v_owner                 public.employees%rowtype;
  v_submitted_id          uuid;
  v_returned_id           uuid;
  v_required_levels       int[];
  v_first_level           int;
  v_next_status_code      text;
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

  SELECT id INTO v_submitted_id FROM public.claim_statuses WHERE status_code = 'SUBMITTED';
  SELECT id INTO v_returned_id  FROM public.claim_statuses WHERE status_code = 'RETURNED_FOR_MODIFICATION';

  SELECT c.* INTO v_claim
  FROM public.expense_claims c
  JOIN public.employees e ON e.id = c.employee_id
  WHERE c.id = p_claim_id AND lower(e.employee_email) = v_email
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found for current employee.'; END IF;

  IF v_claim.status_id NOT IN (v_submitted_id, v_returned_id) THEN
    RAISE EXCEPTION 'Only submitted or returned claims can be routed through the workflow.';
  END IF;

  v_is_resubmission := (v_claim.status_id = v_returned_id);
  v_trigger_action  := CASE WHEN v_is_resubmission THEN 'resubmit' ELSE 'submit' END;

  SELECT * INTO v_owner FROM public.employees WHERE id = v_claim.employee_id;

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

  IF v_first_level = 1 THEN
    v_next_status_code    := 'L1_PENDING';
    v_next_approval_level := 1;
  ELSIF v_first_level = 2 THEN
    v_next_status_code    := 'L2_PENDING';
    v_next_approval_level := 2;
  ELSIF v_first_level = 3 THEN
    v_next_status_code    := 'L3_PENDING_FINANCE_REVIEW';
    v_next_approval_level := NULL;
  ELSE
    RAISE EXCEPTION 'Unexpected first approval level: %', v_first_level;
  END IF;

  SELECT id INTO v_next_status_id FROM public.claim_statuses WHERE status_code = v_next_status_code;
  v_old_status_id := v_claim.status_id;

  UPDATE public.expense_claims
  SET status_id              = v_next_status_id,
      current_approval_level = v_next_approval_level,
      resubmission_count     = CASE WHEN v_is_resubmission THEN coalesce(resubmission_count, 0) + 1 ELSE resubmission_count END,
      submitted_at           = CASE WHEN NOT v_is_resubmission THEN now() ELSE submitted_at END,
      updated_at             = now()
  WHERE id = v_claim.id;

  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes,
    old_status_id, new_status_id, metadata
  ) VALUES (
    v_claim.id, v_employee_id, null, v_trigger_action, v_notes,
    v_old_status_id, v_next_status_id,
    jsonb_build_object('is_resubmission', v_is_resubmission, 'first_level', v_first_level)
  );

  RETURN QUERY SELECT v_claim.id, v_next_status_code, v_next_approval_level;
END;
$$;

-- ── 4. admin_rollback_claim_atomic ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_rollback_claim_atomic(
  p_claim_id uuid,
  p_reason text,
  p_confirmation text DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, rolled_back_to_status_code text, rolled_back_to_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email               text;
  v_admin_employee_id   uuid;
  v_reason              text;
  v_claim               public.expense_claims%rowtype;
  v_target_status_id    uuid;
  v_target_level        int;
  v_target_status_code  text;
BEGIN
  v_email  := public.current_user_email();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  IF coalesce(v_email, '') = ''  THEN RAISE EXCEPTION 'Unauthorized request.'; END IF;
  IF p_confirmation <> 'CONFIRM' THEN RAISE EXCEPTION 'Secondary confirmation is required.'; END IF;
  IF v_reason IS NULL            THEN RAISE EXCEPTION 'Rollback reason is required.'; END IF;

  SELECT e.id INTO v_admin_employee_id
  FROM public.employees e
  JOIN public.employee_roles er ON er.employee_id = e.id AND er.is_active = true
  JOIN public.roles r ON r.id = er.role_id
  WHERE lower(e.employee_email) = v_email AND r.role_code = 'ADMIN'
  LIMIT 1;
  IF v_admin_employee_id IS NULL THEN RAISE EXCEPTION 'Admin access is required.'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.approval_history h
    WHERE h.approver_employee_id = v_admin_employee_id
      AND h.action = 'admin_override'
      AND h.acted_at > now() - INTERVAL '30 seconds'
  ) THEN RAISE EXCEPTION 'Please wait before applying another admin override.'; END IF;

  SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found.'; END IF;

  SELECT h.old_status_id, cs.approval_level
  INTO v_target_status_id, v_target_level
  FROM public.approval_history h
  JOIN public.claim_statuses cs ON cs.id = h.old_status_id
  WHERE h.claim_id = v_claim.id
    AND h.old_status_id IS NOT NULL
  ORDER BY h.acted_at DESC
  LIMIT 1;

  IF v_target_status_id IS NULL THEN
    RAISE EXCEPTION 'No previous status found for rollback.';
  END IF;

  SELECT status_code INTO v_target_status_code FROM public.claim_statuses WHERE id = v_target_status_id;

  v_target_level := CASE v_target_status_code
    WHEN 'L1_PENDING' THEN 1
    WHEN 'L2_PENDING' THEN 2
    ELSE NULL
  END;

  UPDATE public.expense_claims
  SET status_id              = v_target_status_id,
      current_approval_level = v_target_level,
      updated_at             = now()
  WHERE id = v_claim.id;

  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes, reason, metadata
  ) VALUES (
    v_claim.id, v_admin_employee_id, null, 'admin_override', v_reason, v_reason,
    jsonb_build_object(
      'from_status_id', v_claim.status_id,
      'to_status_id',   v_target_status_id,
      'to_status_code', v_target_status_code
    )
  );

  RETURN QUERY SELECT v_claim.id, v_target_status_code, v_target_level;
END;
$$;

-- ── 5. Drop the legacy log_claim_status_audit function ───────────────────────
-- Safe to drop: no workflow RPC calls it any longer (removed above).
-- The claim_status_audit TABLE is NOT dropped here; historical rows are kept.

DROP FUNCTION IF EXISTS public.log_claim_status_audit(uuid, text, text, text, text, text, integer, integer, boolean, text, jsonb);

COMMIT;
