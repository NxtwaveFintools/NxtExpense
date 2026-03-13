-- =============================================================================
-- Migration 023: Fix workflow RPCs
--
-- PROBLEMS FIXED:
--   1. approval_history.old_status_id / new_status_id are NOT NULL but every
--      workflow RPC omitted them → crash on every claim action.
--   2. expense_claims.status_id was never updated during status transitions
--      (only set at claim-creation time) → stale / inconsistent.
--
-- APPROACH:
--   • Add resolve_status_id() helper that maps legacy text status + approval
--     level to the UUID in claim_statuses.
--   • Rewrite all four workflow RPCs to:
--       – set status_id on expense_claims alongside status.
--       – pass old_status_id / new_status_id in every approval_history insert.
--   • Backfill expense_claims.status_id for all existing rows.
--   • Rewrite bulk_issue_claims_atomic to delegate to
--     submit_finance_action_atomic (ensures consistency going forward).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.  Helper: legacy text status + optional approval level → claim_statuses UUID
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_status_id(
  p_status text,
  p_level  int DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_code text;
BEGIN
  v_code := CASE p_status
    WHEN 'draft'                     THEN 'DRAFT'
    WHEN 'submitted'                 THEN 'SUBMITTED'
    WHEN 'returned_for_modification' THEN 'RETURNED_FOR_MODIFICATION'
    WHEN 'finance_review'            THEN 'L3_PENDING_FINANCE_REVIEW'
    WHEN 'finance_rejected'          THEN 'L3_REJECTED_FINANCE'
    WHEN 'issued'                    THEN 'L4_ISSUED'
    WHEN 'pending_approval' THEN
      CASE p_level
        WHEN 1 THEN 'L1_PENDING'
        WHEN 2 THEN 'L2_PENDING'
        ELSE        'L1_PENDING'
      END
    WHEN 'approved' THEN
      CASE p_level
        WHEN 1 THEN 'L1_APPROVED'
        WHEN 2 THEN 'L2_APPROVED'
        ELSE        'L1_APPROVED'
      END
    WHEN 'rejected' THEN
      CASE p_level
        WHEN 1 THEN 'L1_REJECTED'
        WHEN 2 THEN 'L2_REJECTED'
        ELSE        'L1_REJECTED'
      END
    ELSE NULL
  END;

  IF v_code IS NULL THEN RETURN NULL; END IF;
  RETURN (SELECT id FROM public.claim_statuses WHERE status_code = v_code LIMIT 1);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.  Backfill expense_claims.status_id for all existing rows
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.expense_claims
SET    status_id = COALESCE(
         public.resolve_status_id(status, current_approval_level),
         status_id   -- keep existing value if mapping returns NULL (safety net)
       );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.  resubmit_claim_after_rejection_atomic
--     Adds: status_id sync on UPDATE + old/new_status_id in history INSERT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resubmit_claim_after_rejection_atomic(
  p_claim_id uuid,
  p_notes    text DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status text, new_approval_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email            text;
  v_employee_id      uuid;
  v_notes            text;
  v_claim            public.expense_claims%rowtype;
  v_owner            public.employees%rowtype;
  v_transition       public.claim_transition_graph%rowtype;
  v_next_level       int;
  v_next_status      text;
  v_trigger_action   text;
  v_is_resubmission  boolean;
  v_old_status_id    uuid;
  v_new_status_id    uuid;
BEGIN
  v_email := public.current_user_email();
  IF coalesce(v_email, '') = '' THEN RAISE EXCEPTION 'Unauthorized request.'; END IF;
  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  SELECT id INTO v_employee_id FROM public.employees WHERE lower(employee_email) = v_email;

  SELECT c.* INTO v_claim
  FROM   public.expense_claims c
  JOIN   public.employees e ON e.id = c.employee_id
  WHERE  c.id = p_claim_id AND lower(e.employee_email) = v_email
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found for current employee.'; END IF;

  IF v_claim.status NOT IN ('returned_for_modification', 'submitted') THEN
    RAISE EXCEPTION 'Only submitted or returned claims can move to workflow.';
  END IF;

  v_is_resubmission := v_claim.status = 'returned_for_modification';
  v_trigger_action  := CASE WHEN v_is_resubmission THEN 'resubmitted' ELSE 'submitted' END;

  SELECT * INTO v_owner FROM public.employees WHERE id = v_claim.employee_id;

  SELECT * INTO v_transition
  FROM   public.claim_transition_graph t
  WHERE  t.tenant_id      = v_claim.tenant_id
    AND  t.from_status    = v_claim.status
    AND  t.trigger_action = v_trigger_action
    AND  t.actor_scope    = 'employee'
    AND  t.is_active      = true
  ORDER BY t.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No transition configured for claim submission path.'; END IF;

  v_next_level  := public.resolve_next_approval_level(v_owner, null, v_transition.next_level_mode);
  v_next_status := v_transition.to_status;
  IF v_next_level IS NULL AND v_transition.to_status_when_no_next IS NOT NULL THEN
    v_next_status := v_transition.to_status_when_no_next;
  END IF;

  -- Resolve the status UUIDs BEFORE mutating
  v_old_status_id := public.resolve_status_id(v_claim.status, v_claim.current_approval_level);
  v_new_status_id := public.resolve_status_id(v_next_status, v_next_level);

  UPDATE public.expense_claims
  SET    status                = v_next_status,
         status_id             = v_new_status_id,
         current_approval_level = v_next_level,
         submitted_at          = now(),
         resubmission_count    = CASE WHEN v_is_resubmission
                                   THEN resubmission_count + 1
                                   ELSE resubmission_count
                                 END,
         updated_at            = now()
  WHERE  id = v_claim.id;

  IF v_is_resubmission THEN
    INSERT INTO public.approval_history (
      claim_id, approver_employee_id, approval_level, action, notes, metadata,
      old_status_id, new_status_id
    ) VALUES (
      v_claim.id, v_employee_id, null, 'resubmitted', v_notes,
      jsonb_build_object('transition_id', v_transition.id),
      v_old_status_id, v_new_status_id
    );
  END IF;

  PERFORM public.log_claim_status_audit(
    v_claim.id, v_email, 'employee', v_trigger_action,
    v_claim.status, v_next_status,
    v_claim.current_approval_level, v_next_level,
    null, v_notes, jsonb_build_object('transition_id', v_transition.id)
  );

  RETURN QUERY SELECT v_claim.id, v_next_status, v_next_level;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.  submit_approval_action_atomic
--     Adds: status_id sync + old/new_status_id in history INSERT
--     Note: for rejected/returned (v_next_level=null) we fall back to the
--           actor's level (v_level) so L1_REJECTED vs L2_REJECTED is correct.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_approval_action_atomic(
  p_claim_id       uuid,
  p_action         text,
  p_notes          text    DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status text, new_approval_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email              text;
  v_actor_employee_id  uuid;
  v_claim              public.expense_claims%rowtype;
  v_owner              public.employees%rowtype;
  v_transition         public.claim_transition_graph%rowtype;
  v_notes              text;
  v_level              int;
  v_next_level         int;
  v_next_status        text;
  v_old_status_id      uuid;
  v_new_status_id      uuid;
BEGIN
  IF p_action NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Unsupported approval action.';
  END IF;

  v_email := public.current_user_email();
  IF coalesce(v_email, '') = '' THEN RAISE EXCEPTION 'Unauthorized request.'; END IF;
  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  SELECT id INTO v_actor_employee_id FROM public.employees WHERE lower(employee_email) = v_email;

  SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found.'; END IF;

  SELECT * INTO v_owner FROM public.employees WHERE id = v_claim.employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim owner record not found.'; END IF;

  IF    lower(coalesce(v_owner.approval_email_level_1, '')) = v_email THEN v_level := 1;
  ELSIF lower(coalesce(v_owner.approval_email_level_2, '')) = v_email THEN v_level := 2;
  ELSIF lower(coalesce(v_owner.approval_email_level_3, '')) = v_email THEN v_level := 3;
  ELSE  v_level := null;
  END IF;

  IF v_level IS NULL THEN
    RAISE EXCEPTION 'You are not authorized to act on this claim.';
  END IF;
  IF v_claim.current_approval_level IS DISTINCT FROM v_level THEN
    RAISE EXCEPTION 'You are not authorized to act on this claim at the current level.';
  END IF;

  SELECT * INTO v_transition
  FROM   public.claim_transition_graph t
  WHERE  t.tenant_id      = v_claim.tenant_id
    AND  t.from_status    = v_claim.status
    AND  t.trigger_action = p_action
    AND  t.actor_scope    = 'approver'
    AND  t.is_active      = true
    AND  (t.allowed_approver_levels IS NULL OR v_level = ANY(t.allowed_approver_levels))
    AND  (p_action <> 'rejected' OR t.allow_resubmit IS NULL OR t.allow_resubmit = p_allow_resubmit)
  ORDER BY t.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No transition configured for this approval action.'; END IF;
  IF v_transition.require_notes AND v_notes IS NULL THEN
    RAISE EXCEPTION 'Notes are required for this action.';
  END IF;

  v_next_level  := public.resolve_next_approval_level(v_owner, v_claim.current_approval_level, v_transition.next_level_mode);
  v_next_status := v_transition.to_status;
  IF v_next_level IS NULL AND v_transition.to_status_when_no_next IS NOT NULL THEN
    v_next_status := v_transition.to_status_when_no_next;
  END IF;

  -- For rejected/returned v_next_level is null; fall back to actor's level so
  -- L1_REJECTED / L2_REJECTED is resolved correctly.
  v_old_status_id := public.resolve_status_id(v_claim.status, v_claim.current_approval_level);
  v_new_status_id := public.resolve_status_id(v_next_status, coalesce(v_next_level, v_level));

  UPDATE public.expense_claims
  SET    status                        = v_next_status,
         status_id                     = v_new_status_id,
         current_approval_level        = v_next_level,
         last_rejection_notes          = CASE WHEN p_action = 'rejected' THEN v_notes        ELSE last_rejection_notes          END,
         last_rejected_by_email        = CASE WHEN p_action = 'rejected' THEN v_email        ELSE last_rejected_by_email        END,
         last_rejected_by_employee_id  = CASE WHEN p_action = 'rejected' THEN v_actor_employee_id ELSE last_rejected_by_employee_id END,
         last_rejected_at              = CASE WHEN p_action = 'rejected' THEN now()          ELSE last_rejected_at              END,
         updated_at                    = now()
  WHERE  id = v_claim.id;

  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes,
    rejection_notes, allow_resubmit, metadata,
    old_status_id, new_status_id
  ) VALUES (
    v_claim.id, v_actor_employee_id, v_level, p_action, v_notes,
    CASE WHEN p_action = 'rejected' THEN v_notes        ELSE null END,
    CASE WHEN p_action = 'rejected' THEN p_allow_resubmit ELSE null END,
    jsonb_build_object('transition_id', v_transition.id),
    v_old_status_id, v_new_status_id
  );

  PERFORM public.log_claim_status_audit(
    v_claim.id, v_email, 'approver', p_action,
    v_claim.status, v_next_status,
    v_claim.current_approval_level, v_next_level,
    CASE WHEN p_action = 'rejected' THEN p_allow_resubmit ELSE null END,
    v_notes, jsonb_build_object('transition_id', v_transition.id)
  );

  RETURN QUERY SELECT v_claim.id, v_next_status, v_next_level;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5.  submit_finance_action_atomic
--     Adds: status_id sync + old/new_status_id in history INSERT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_finance_action_atomic(
  p_claim_id       uuid,
  p_action         text,
  p_notes          text    DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email              text;
  v_actor_employee_id  uuid;
  v_notes              text;
  v_claim              public.expense_claims%rowtype;
  v_owner              public.employees%rowtype;
  v_transition         public.claim_transition_graph%rowtype;
  v_next_level         int;
  v_next_status        text;
  v_is_finance         boolean;
  v_history_action     text;
  v_old_status_id      uuid;
  v_new_status_id      uuid;
BEGIN
  v_email := public.current_user_email();
  IF coalesce(v_email, '') = '' THEN RAISE EXCEPTION 'Unauthorized request.'; END IF;
  IF p_action NOT IN ('issued', 'finance_rejected', 'reopened') THEN
    RAISE EXCEPTION 'Unsupported finance action.';
  END IF;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  SELECT id INTO v_actor_employee_id FROM public.employees WHERE lower(employee_email) = v_email;

  SELECT EXISTS (
    SELECT 1
    FROM   public.employees    e
    JOIN   public.employee_roles er ON er.employee_id = e.id AND er.is_active = true
    JOIN   public.roles          r  ON r.id = er.role_id
    WHERE  lower(e.employee_email) = v_email
      AND  r.role_code IN ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
  ) INTO v_is_finance;
  IF NOT v_is_finance THEN RAISE EXCEPTION 'Finance access is required.'; END IF;

  SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found.'; END IF;

  SELECT * INTO v_owner FROM public.employees WHERE id = v_claim.employee_id;

  SELECT * INTO v_transition
  FROM   public.claim_transition_graph t
  WHERE  t.tenant_id      = v_claim.tenant_id
    AND  t.from_status    = v_claim.status
    AND  t.trigger_action = p_action
    AND  t.actor_scope    = 'finance'
    AND  t.is_active      = true
    AND  (p_action <> 'finance_rejected' OR t.allow_resubmit IS NULL OR t.allow_resubmit = p_allow_resubmit)
  ORDER BY t.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No transition configured for this finance action.'; END IF;
  IF v_transition.require_notes AND v_notes IS NULL THEN
    RAISE EXCEPTION 'Notes are required for this action.';
  END IF;

  v_next_level  := public.resolve_next_approval_level(v_owner, v_claim.current_approval_level, v_transition.next_level_mode);
  v_next_status := v_transition.to_status;
  IF v_next_level IS NULL AND v_transition.to_status_when_no_next IS NOT NULL THEN
    v_next_status := v_transition.to_status_when_no_next;
  END IF;

  v_old_status_id := public.resolve_status_id(v_claim.status, v_claim.current_approval_level);
  v_new_status_id := public.resolve_status_id(v_next_status, v_next_level);

  UPDATE public.expense_claims
  SET    status                        = v_next_status,
         status_id                     = v_new_status_id,
         current_approval_level        = v_next_level,
         last_rejection_notes          = CASE WHEN p_action = 'finance_rejected' THEN v_notes        ELSE last_rejection_notes          END,
         last_rejected_by_email        = CASE WHEN p_action = 'finance_rejected' THEN v_email        ELSE last_rejected_by_email        END,
         last_rejected_by_employee_id  = CASE WHEN p_action = 'finance_rejected' THEN v_actor_employee_id ELSE last_rejected_by_employee_id END,
         last_rejected_at              = CASE WHEN p_action = 'finance_rejected' THEN now()          ELSE last_rejected_at              END,
         updated_at                    = now()
  WHERE  id = v_claim.id;

  INSERT INTO public.finance_actions (claim_id, actor_employee_id, action, notes)
  VALUES (v_claim.id, v_actor_employee_id, p_action, v_notes);

  v_history_action := CASE
    WHEN p_action = 'issued'   THEN 'finance_issued'
    WHEN p_action = 'reopened' THEN 'reopened'
    ELSE 'finance_rejected'
  END;

  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes,
    rejection_notes, allow_resubmit, metadata,
    old_status_id, new_status_id
  ) VALUES (
    v_claim.id, v_actor_employee_id, null, v_history_action, v_notes,
    CASE WHEN p_action = 'finance_rejected' THEN v_notes        ELSE null END,
    CASE WHEN p_action = 'finance_rejected' THEN p_allow_resubmit ELSE null END,
    jsonb_build_object('transition_id', v_transition.id),
    v_old_status_id, v_new_status_id
  );

  PERFORM public.log_claim_status_audit(
    v_claim.id, v_email, 'finance', p_action,
    v_claim.status, v_next_status,
    v_claim.current_approval_level, v_next_level,
    CASE WHEN p_action = 'finance_rejected' THEN p_allow_resubmit ELSE null END,
    v_notes, jsonb_build_object('transition_id', v_transition.id)
  );

  RETURN QUERY SELECT v_claim.id, v_next_status;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.  admin_rollback_claim_atomic
--     Adds: status_id sync + old/new_status_id in history INSERT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_rollback_claim_atomic(
  p_claim_id     uuid,
  p_reason       text,
  p_confirmation text DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, rolled_back_to_status text, rolled_back_to_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email               text;
  v_admin_employee_id   uuid;
  v_reason              text;
  v_claim               public.expense_claims%rowtype;
  v_owner               public.employees%rowtype;
  v_last_audit          public.claim_status_audit%rowtype;
  v_transition          public.claim_transition_graph%rowtype;
  v_target_level        int;
  v_old_status_id       uuid;
  v_new_status_id       uuid;
BEGIN
  v_email  := public.current_user_email();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  IF coalesce(v_email, '') = ''    THEN RAISE EXCEPTION 'Unauthorized request.';               END IF;
  IF p_confirmation <> 'CONFIRM'   THEN RAISE EXCEPTION 'Secondary confirmation is required.'; END IF;
  IF v_reason IS NULL              THEN RAISE EXCEPTION 'Rollback reason is required.';        END IF;

  SELECT e.id INTO v_admin_employee_id
  FROM   public.employees    e
  JOIN   public.employee_roles er ON er.employee_id = e.id AND er.is_active = true
  JOIN   public.roles          r  ON r.id = er.role_id
  WHERE  lower(e.employee_email) = v_email AND r.role_code = 'ADMIN'
  LIMIT  1;
  IF v_admin_employee_id IS NULL THEN RAISE EXCEPTION 'Admin access is required.'; END IF;

  IF EXISTS (
    SELECT 1
    FROM   public.approval_history h
    WHERE  h.approver_employee_id = v_admin_employee_id
      AND  h.action    = 'admin_override'
      AND  h.acted_at  > now() - INTERVAL '30 seconds'
  ) THEN RAISE EXCEPTION 'Please wait before applying another admin override.'; END IF;

  SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found.'; END IF;

  SELECT * INTO v_owner FROM public.employees WHERE id = v_claim.employee_id;

  SELECT * INTO v_last_audit
  FROM   public.claim_status_audit a
  WHERE  a.claim_id = v_claim.id
  ORDER BY a.changed_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No status audit found for rollback.'; END IF;

  SELECT * INTO v_transition
  FROM   public.claim_transition_graph t
  WHERE  t.tenant_id      = v_claim.tenant_id
    AND  t.from_status    = v_claim.status
    AND  t.to_status      = v_last_audit.from_status
    AND  t.trigger_action = 'admin_override'
    AND  t.actor_scope    = 'admin'
    AND  t.is_active      = true
  ORDER BY t.created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No admin rollback transition configured for this state pair.';
  END IF;

  v_target_level := coalesce(
    v_last_audit.from_approval_level,
    CASE WHEN v_last_audit.from_status = 'pending_approval'
         THEN public.resolve_next_approval_level(v_owner, null, 'reset_first_configured')
         ELSE null
    END
  );

  v_old_status_id := public.resolve_status_id(v_claim.status, v_claim.current_approval_level);
  v_new_status_id := public.resolve_status_id(v_last_audit.from_status, v_target_level);

  UPDATE public.expense_claims
  SET    status                 = v_last_audit.from_status,
         status_id              = v_new_status_id,
         current_approval_level = v_target_level,
         updated_at             = now()
  WHERE  id = v_claim.id;

  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes, reason, metadata,
    old_status_id, new_status_id
  ) VALUES (
    v_claim.id, v_admin_employee_id, null, 'admin_override', v_reason, v_reason,
    jsonb_build_object(
      'from_status',   v_claim.status,
      'to_status',     v_last_audit.from_status,
      'transition_id', v_transition.id
    ),
    v_old_status_id, v_new_status_id
  );

  PERFORM public.log_claim_status_audit(
    v_claim.id, v_email, 'admin', 'admin_override',
    v_claim.status, v_last_audit.from_status,
    v_claim.current_approval_level, v_target_level,
    null, v_reason, jsonb_build_object('transition_id', v_transition.id)
  );

  RETURN QUERY SELECT v_claim.id, v_last_audit.from_status, v_target_level;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7.  bulk_issue_claims_atomic
--     Delegate per-claim processing to submit_finance_action_atomic so that
--     status_id and approval_history are always populated correctly.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bulk_issue_claims_atomic(
  p_claim_ids uuid[],
  p_notes     text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_claim_id uuid;
  v_processed int := 0;
BEGIN
  IF p_claim_ids IS NULL OR coalesce(array_length(p_claim_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one claim must be selected.';
  END IF;

  FOR v_claim_id IN SELECT DISTINCT unnest(p_claim_ids) LOOP
    PERFORM * FROM public.submit_finance_action_atomic(v_claim_id, 'issued', p_notes, null);
    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$function$;
