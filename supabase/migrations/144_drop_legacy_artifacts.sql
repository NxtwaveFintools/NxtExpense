-- Migration 144: Drop Legacy Artifacts
-- Removes all backward-compat scaffolding that kept the system running during
-- the System A → System B migration (migrations 138–143).
--
-- Drops:
--   1. employees.approval_email_level_1/2/3 (replaced by ID columns in mig 139)
--   2. expense_claims.status (text) (replaced by status_id FK in mig 142)
--   3. expense_claims.last_rejected_by_email (replaced by last_rejected_by_employee_id)
--   4. claim_transition_graph table (replaced by claim_status_transitions)
--   5. claim_status_catalog table (replaced by claim_statuses)
--   6. resolve_status_id() function (no longer needed after text status dropped)
--
-- Prerequisites (all done in previous migrations):
--   - All RPCs use status_id and approval_employee_id_level_X (mig 142)
--   - All RLS policies updated (mig 143)
--   - App code updated (separate from SQL migrations)
--
-- This migration REWRITES 5 RPCs and 7 RLS policies before dropping columns.

BEGIN;

-- =============================================================================
-- STEP 1: Rewrite RPCs to remove expense_claims.status text column references
-- =============================================================================

-- 1a) resubmit_claim_after_rejection_atomic
CREATE OR REPLACE FUNCTION public.resubmit_claim_after_rejection_atomic(
  p_claim_id uuid,
  p_notes    text DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status_code text, new_approval_level int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
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

  PERFORM public.log_claim_status_audit(
    v_claim.id, v_email, 'employee', v_trigger_action,
    v_next_status_code, v_next_status_code,
    null, v_next_approval_level,
    null, v_notes, jsonb_build_object('is_resubmission', v_is_resubmission)
  );

  RETURN QUERY SELECT v_claim.id, v_next_status_code, v_next_approval_level;
END;
$$;

-- 1b) submit_approval_action_atomic
CREATE OR REPLACE FUNCTION public.submit_approval_action_atomic(
  p_claim_id       uuid,
  p_action         text,
  p_notes          text    DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status_code text, new_approval_level int)
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
    AND cst.allow_resubmit    IS NOT DISTINCT FROM (
          CASE WHEN p_action = 'rejected' THEN p_allow_resubmit ELSE NULL END
        )
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
    v_next_status_code, v_next_status_code,
    v_claim.current_approval_level, v_next_approval_level,
    CASE WHEN p_action = 'rejected' THEN p_allow_resubmit ELSE null END,
    v_notes, jsonb_build_object('transition_id', v_transition.id)
  );

  RETURN QUERY SELECT v_claim.id, v_next_status_code, v_next_approval_level;
END;
$$;

-- 1c) submit_finance_action_atomic
CREATE OR REPLACE FUNCTION public.submit_finance_action_atomic(
  p_claim_id       uuid,
  p_action         text,
  p_notes          text    DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status_code text)
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

  v_action_code    := CASE p_action WHEN 'issued' THEN 'finance_issued' WHEN 'reopened' THEN 'reopened' ELSE 'finance_rejected' END;
  v_history_action := CASE p_action WHEN 'issued' THEN 'finance_issued' WHEN 'reopened' THEN 'reopened' ELSE 'finance_rejected' END;

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

  SELECT status_code INTO v_next_status_code FROM public.claim_statuses WHERE id = v_transition.to_status_id;
  v_next_status_id := v_transition.to_status_id;
  v_old_status_id  := v_claim.status_id;

  UPDATE public.expense_claims
  SET status_id                    = v_next_status_id,
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
    v_next_status_code, v_next_status_code,
    null, NULL,
    CASE WHEN p_action = 'finance_rejected' THEN p_allow_resubmit ELSE null END,
    v_notes, jsonb_build_object('transition_id', v_transition.id)
  );

  RETURN QUERY SELECT v_claim.id, v_next_status_code;
END;
$$;

-- 1d) admin_rollback_claim_atomic — no longer uses resolve_status_id()
CREATE OR REPLACE FUNCTION public.admin_rollback_claim_atomic(
  p_claim_id     uuid,
  p_reason       text,
  p_confirmation text DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, rolled_back_to_status_code text, rolled_back_to_level int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
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

  -- Use old_status_id from the most recent approval_history entry as rollback target
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

  SELECT status_code INTO v_target_status_code
  FROM public.claim_statuses WHERE id = v_target_status_id;

  -- Map approval_level: L1/L2 approvals use the status's level; finance=NULL
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

  PERFORM public.log_claim_status_audit(
    v_claim.id, v_email, 'admin', 'admin_override',
    v_target_status_code, v_target_status_code,
    v_claim.current_approval_level, v_target_level,
    null, v_reason, jsonb_build_object('operation', 'rollback')
  );

  RETURN QUERY SELECT v_claim.id, v_target_status_code, v_target_level;
END;
$$;

-- 1e) admin_reassign_employee_approvers_atomic
--     Remove references to status text column; use status_id check
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

  -- Update only the ID columns (email columns are dropped by this migration)
  UPDATE public.employees
  SET approval_employee_id_level_1 = v_l1_id,
      approval_employee_id_level_2 = v_l2_id,
      approval_employee_id_level_3 = v_l3_id
  WHERE id = p_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found for approver reassignment.'; END IF;

  -- Log for all in-flight claims
  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes, reason, metadata
  )
  SELECT c.id, v_admin_employee_id, null, 'admin_override', v_reason, v_reason,
    jsonb_build_object(
      'operation',   'reassign_approvers',
      'employee_id', p_employee_id,
      'level_1_email', v_l1_email,
      'level_2_email', v_l2_email,
      'level_3_email', v_l3_email
    )
  FROM public.expense_claims c
  WHERE c.employee_id = p_employee_id
    AND c.status_id IN (
      SELECT id FROM public.claim_statuses
      WHERE status_code IN ('L1_PENDING', 'L2_PENDING', 'L3_PENDING_FINANCE_REVIEW', 'RETURNED_FOR_MODIFICATION')
    );

  GET DIAGNOSTICS v_claim_count = ROW_COUNT;
  RETURN v_claim_count;
END;
$$;

-- =============================================================================
-- STEP 2: Update RLS policies to use status_id instead of status text
-- =============================================================================

-- approval_history finance read
DROP POLICY IF EXISTS "finance can read claim history" ON public.approval_history;
CREATE POLICY "finance can read claim history"
  ON public.approval_history FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.employees cur
      JOIN public.employee_roles er ON er.employee_id = cur.id AND er.is_active = true
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(cur.employee_email) = public.current_user_email() AND r.role_code = 'FINANCE_TEAM'
    )
    AND EXISTS (
      SELECT 1 FROM public.expense_claims c
      JOIN public.claim_statuses cs ON cs.id = c.status_id
      WHERE c.id = approval_history.claim_id
        AND cs.status_code IN ('L3_PENDING_FINANCE_REVIEW', 'APPROVED', 'L3_REJECTED_FINANCE', 'RETURNED_FOR_MODIFICATION')
    )
  );

-- claim_expenses finance read
DROP POLICY IF EXISTS "finance can read claim expenses" ON public.claim_expenses;
CREATE POLICY "finance can read claim expenses"
  ON public.claim_expenses FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.employees cur
      JOIN public.employee_roles er ON er.employee_id = cur.id AND er.is_active = true
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(cur.employee_email) = public.current_user_email() AND r.role_code = 'FINANCE_TEAM'
    )
    AND EXISTS (
      SELECT 1 FROM public.expense_claims ec
      JOIN public.claim_statuses cs ON cs.id = ec.status_id
      WHERE ec.id = claim_expenses.claim_id
        AND cs.status_code IN ('L3_PENDING_FINANCE_REVIEW', 'APPROVED', 'L3_REJECTED_FINANCE', 'RETURNED_FOR_MODIFICATION')
    )
  );

-- claim_status_audit — replace approval_email_level columns with ID columns
DROP POLICY IF EXISTS "participants can read claim status audit" ON public.claim_status_audit;
CREATE POLICY "participants can read claim status audit"
  ON public.claim_status_audit FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.expense_claims c
      JOIN public.employees owner_emp ON owner_emp.id = c.employee_id
      LEFT JOIN public.employees current_emp ON lower(current_emp.employee_email) = public.current_user_email()
      WHERE c.id = claim_status_audit.claim_id
        AND (
          lower(owner_emp.employee_email) = public.current_user_email()
          OR owner_emp.approval_employee_id_level_1 = current_emp.id
          OR owner_emp.approval_employee_id_level_3 = current_emp.id
          OR EXISTS (
            SELECT 1 FROM public.employee_roles er JOIN public.roles r ON r.id = er.role_id
            WHERE er.employee_id = current_emp.id AND er.is_active = true
              AND r.role_code IN ('FINANCE_TEAM', 'ADMIN')
          )
        )
    )
  );

-- expense_claim_items finance read
DROP POLICY IF EXISTS "finance can read claim items" ON public.expense_claim_items;
CREATE POLICY "finance can read claim items"
  ON public.expense_claim_items FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.employees cur
      JOIN public.employee_roles er ON er.employee_id = cur.id AND er.is_active = true
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(cur.employee_email) = public.current_user_email() AND r.role_code = 'FINANCE_TEAM'
    )
    AND EXISTS (
      SELECT 1 FROM public.expense_claims c
      JOIN public.claim_statuses cs ON cs.id = c.status_id
      WHERE c.id = expense_claim_items.claim_id
        AND cs.status_code IN ('L3_PENDING_FINANCE_REVIEW', 'APPROVED', 'L3_REJECTED_FINANCE', 'RETURNED_FOR_MODIFICATION')
    )
  );

-- expense_claims finance read
DROP POLICY IF EXISTS "finance can read finance claims" ON public.expense_claims;
CREATE POLICY "finance can read finance claims"
  ON public.expense_claims FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees cur
      JOIN public.employee_roles er ON er.employee_id = cur.id AND er.is_active = true
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(cur.employee_email) = public.current_user_email() AND r.role_code = 'FINANCE_TEAM'
    )
    AND status_id IN (
      SELECT id FROM public.claim_statuses
      WHERE status_code IN ('L3_PENDING_FINANCE_REVIEW', 'APPROVED', 'L3_REJECTED_FINANCE', 'RETURNED_FOR_MODIFICATION')
    )
  );

-- expense_claims finance update
DROP POLICY IF EXISTS "finance can update finance review claims" ON public.expense_claims;
CREATE POLICY "finance can update finance review claims"
  ON public.expense_claims FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees cur
      JOIN public.employee_roles er ON er.employee_id = cur.id AND er.is_active = true
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(cur.employee_email) = public.current_user_email() AND r.role_code = 'FINANCE_TEAM'
    )
    AND status_id = (SELECT id FROM public.claim_statuses WHERE status_code = 'L3_PENDING_FINANCE_REVIEW')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees cur
      JOIN public.employee_roles er ON er.employee_id = cur.id AND er.is_active = true
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(cur.employee_email) = public.current_user_email() AND r.role_code = 'FINANCE_TEAM'
    )
    AND status_id IN (
      SELECT id FROM public.claim_statuses
      WHERE status_code IN ('APPROVED', 'L3_REJECTED_FINANCE', 'RETURNED_FOR_MODIFICATION')
    )
    AND current_approval_level IS NULL
  );

-- finance_actions read — remove actor_email from approver read check (column removed)
DROP POLICY IF EXISTS "finance or owner can read finance actions" ON public.finance_actions;
CREATE POLICY "finance or owner can read finance actions"
  ON public.finance_actions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expense_claims c
      JOIN public.employees owner_emp ON owner_emp.id = c.employee_id
      LEFT JOIN public.employees current_emp ON lower(current_emp.employee_email) = public.current_user_email()
      WHERE c.id = finance_actions.claim_id
        AND (
          lower(owner_emp.employee_email) = public.current_user_email()
          OR EXISTS (
            SELECT 1 FROM public.employee_roles er JOIN public.roles r ON r.id = er.role_id
            WHERE er.employee_id = current_emp.id AND er.is_active = true AND r.role_code = 'FINANCE_TEAM'
          )
        )
    )
  );

-- =============================================================================
-- STEP 3: Drop employees.approval_email_level_1/2/3 columns and indexes
-- =============================================================================
DROP INDEX IF EXISTS public.idx_employees_approver_email_l1;
DROP INDEX IF EXISTS public.idx_employees_approver_email_l2;
DROP INDEX IF EXISTS public.idx_employees_approver_email_l3;

ALTER TABLE public.employees
  DROP COLUMN IF EXISTS approval_email_level_1,
  DROP COLUMN IF EXISTS approval_email_level_2,
  DROP COLUMN IF EXISTS approval_email_level_3;

-- =============================================================================
-- STEP 4: Drop expense_claims.status text column and last_rejected_by_email
-- =============================================================================
ALTER TABLE public.expense_claims
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS last_rejected_by_email;

-- =============================================================================
-- STEP 5: Drop claim_transition_graph (legacy System A workflow engine)
-- =============================================================================
DROP TABLE IF EXISTS public.claim_transition_graph CASCADE;

-- =============================================================================
-- STEP 6: Drop claim_status_catalog (legacy System A display table)
-- =============================================================================
DROP TABLE IF EXISTS public.claim_status_catalog CASCADE;

-- =============================================================================
-- STEP 7: Drop resolve_status_id() bridge function (no longer needed)
-- =============================================================================
DROP FUNCTION IF EXISTS public.resolve_status_id(text, int);

COMMIT;
