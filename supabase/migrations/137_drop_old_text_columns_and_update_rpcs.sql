-- Migration 137: Drop old text columns and update RPCs/RLS to use only ID-based references
-- Drops: expense_claims.work_location, expense_claims.vehicle_type,
--         approval_history.approver_email, finance_actions.actor_email
-- Updates: 7 RPCs to remove references to dropped columns
-- Updates: 2 RLS policies to use ID-based checks

BEGIN;

-- ============================================================
-- STEP 1: Rewrite RPCs to stop writing to columns being dropped
-- ============================================================

-- 1a) submit_approval_action_atomic — remove approver_email from approval_history INSERT
CREATE OR REPLACE FUNCTION public.submit_approval_action_atomic(
  p_claim_id uuid,
  p_action text,
  p_notes text DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status text, new_approval_level int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
declare
  v_email text;
  v_actor_employee_id uuid;
  v_claim public.expense_claims%rowtype;
  v_owner public.employees%rowtype;
  v_transition public.claim_transition_graph%rowtype;
  v_notes text;
  v_level int;
  v_next_level int;
  v_next_status text;
begin
  if p_action not in ('approved', 'rejected') then
    raise exception 'Unsupported approval action.';
  end if;

  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then raise exception 'Unauthorized request.'; end if;
  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  select id into v_actor_employee_id from public.employees where lower(employee_email) = v_email;

  select * into v_claim from public.expense_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found.'; end if;

  select * into v_owner from public.employees where id = v_claim.employee_id;
  if not found then raise exception 'Claim owner record not found.'; end if;

  if lower(coalesce(v_owner.approval_email_level_1, '')) = v_email then v_level := 1;
  elsif lower(coalesce(v_owner.approval_email_level_2, '')) = v_email then v_level := 2;
  elsif lower(coalesce(v_owner.approval_email_level_3, '')) = v_email then v_level := 3;
  else v_level := null;
  end if;

  if v_level is null then raise exception 'You are not authorized to act on this claim.'; end if;
  if v_claim.current_approval_level is distinct from v_level then
    raise exception 'You are not authorized to act on this claim at the current level.';
  end if;

  select * into v_transition from public.claim_transition_graph t
  where t.tenant_id = v_claim.tenant_id
    and t.from_status = v_claim.status
    and t.trigger_action = p_action
    and t.actor_scope = 'approver' and t.is_active = true
    and (t.allowed_approver_levels is null or v_level = any(t.allowed_approver_levels))
    and (p_action <> 'rejected' or t.allow_resubmit is null or t.allow_resubmit = p_allow_resubmit)
  order by t.created_at desc limit 1;

  if not found then raise exception 'No transition configured for this approval action.'; end if;
  if v_transition.require_notes and v_notes is null then
    raise exception 'Notes are required for this action.';
  end if;

  v_next_level := public.resolve_next_approval_level(v_owner, v_claim.current_approval_level, v_transition.next_level_mode);
  v_next_status := v_transition.to_status;
  if v_next_level is null and v_transition.to_status_when_no_next is not null then
    v_next_status := v_transition.to_status_when_no_next;
  end if;

  update public.expense_claims
  set status = v_next_status, current_approval_level = v_next_level,
      last_rejection_notes = case when p_action = 'rejected' then v_notes else last_rejection_notes end,
      last_rejected_by_email = case when p_action = 'rejected' then v_email else last_rejected_by_email end,
      last_rejected_by_employee_id = case when p_action = 'rejected' then v_actor_employee_id else last_rejected_by_employee_id end,
      last_rejected_at = case when p_action = 'rejected' then now() else last_rejected_at end,
      updated_at = now()
  where id = v_claim.id;

  insert into public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes,
    rejection_notes, allow_resubmit, metadata
  ) values (
    v_claim.id, v_actor_employee_id, v_level, p_action, v_notes,
    case when p_action = 'rejected' then v_notes else null end,
    case when p_action = 'rejected' then p_allow_resubmit else null end,
    jsonb_build_object('transition_id', v_transition.id)
  );

  perform public.log_claim_status_audit(
    v_claim.id, v_email, 'approver', p_action,
    v_claim.status, v_next_status,
    v_claim.current_approval_level, v_next_level,
    case when p_action = 'rejected' then p_allow_resubmit else null end,
    v_notes, jsonb_build_object('transition_id', v_transition.id)
  );

  return query select v_claim.id, v_next_status, v_next_level;
end;
$$;

-- 1b) submit_finance_action_atomic — remove approver_email from approval_history, actor_email from finance_actions
CREATE OR REPLACE FUNCTION public.submit_finance_action_atomic(
  p_claim_id uuid,
  p_action text,
  p_notes text DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
declare
  v_email text;
  v_actor_employee_id uuid;
  v_notes text;
  v_claim public.expense_claims%rowtype;
  v_owner public.employees%rowtype;
  v_transition public.claim_transition_graph%rowtype;
  v_next_level int;
  v_next_status text;
  v_is_finance boolean;
  v_history_action text;
begin
  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then raise exception 'Unauthorized request.'; end if;
  if p_action not in ('issued', 'finance_rejected', 'reopened') then
    raise exception 'Unsupported finance action.';
  end if;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  select id into v_actor_employee_id from public.employees where lower(employee_email) = v_email;

  select exists (
    select 1 from public.employees e
    join public.employee_roles er on er.employee_id = e.id and er.is_active = true
    join public.roles r on r.id = er.role_id
    where lower(e.employee_email) = v_email
      and r.role_code in ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
  ) into v_is_finance;
  if not v_is_finance then raise exception 'Finance access is required.'; end if;

  select * into v_claim from public.expense_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found.'; end if;
  select * into v_owner from public.employees where id = v_claim.employee_id;

  select * into v_transition from public.claim_transition_graph t
  where t.tenant_id = v_claim.tenant_id
    and t.from_status = v_claim.status
    and t.trigger_action = p_action
    and t.actor_scope = 'finance' and t.is_active = true
    and (p_action <> 'finance_rejected' or t.allow_resubmit is null or t.allow_resubmit = p_allow_resubmit)
  order by t.created_at desc limit 1;

  if not found then raise exception 'No transition configured for this finance action.'; end if;
  if v_transition.require_notes and v_notes is null then
    raise exception 'Notes are required for this action.';
  end if;

  v_next_level := public.resolve_next_approval_level(v_owner, v_claim.current_approval_level, v_transition.next_level_mode);
  v_next_status := v_transition.to_status;
  if v_next_level is null and v_transition.to_status_when_no_next is not null then
    v_next_status := v_transition.to_status_when_no_next;
  end if;

  update public.expense_claims
  set status = v_next_status, current_approval_level = v_next_level,
      last_rejection_notes = case when p_action = 'finance_rejected' then v_notes else last_rejection_notes end,
      last_rejected_by_email = case when p_action = 'finance_rejected' then v_email else last_rejected_by_email end,
      last_rejected_by_employee_id = case when p_action = 'finance_rejected' then v_actor_employee_id else last_rejected_by_employee_id end,
      last_rejected_at = case when p_action = 'finance_rejected' then now() else last_rejected_at end,
      updated_at = now()
  where id = v_claim.id;

  insert into public.finance_actions (claim_id, actor_employee_id, action, notes)
  values (v_claim.id, v_actor_employee_id, p_action, v_notes);

  v_history_action := case
    when p_action = 'issued' then 'finance_issued'
    when p_action = 'reopened' then 'reopened'
    else 'finance_rejected'
  end;

  insert into public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes,
    rejection_notes, allow_resubmit, metadata
  ) values (
    v_claim.id, v_actor_employee_id, null, v_history_action, v_notes,
    case when p_action = 'finance_rejected' then v_notes else null end,
    case when p_action = 'finance_rejected' then p_allow_resubmit else null end,
    jsonb_build_object('transition_id', v_transition.id)
  );

  perform public.log_claim_status_audit(
    v_claim.id, v_email, 'finance', p_action,
    v_claim.status, v_next_status,
    v_claim.current_approval_level, v_next_level,
    case when p_action = 'finance_rejected' then p_allow_resubmit else null end,
    v_notes, jsonb_build_object('transition_id', v_transition.id)
  );

  return query select v_claim.id, v_next_status;
end;
$$;

-- 1c) admin_rollback_claim_atomic — remove approver_email from approval_history INSERT
CREATE OR REPLACE FUNCTION public.admin_rollback_claim_atomic(
  p_claim_id uuid,
  p_reason text,
  p_confirmation text DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, rolled_back_to_status text, rolled_back_to_level int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
declare
  v_email text;
  v_admin_employee_id uuid;
  v_reason text;
  v_claim public.expense_claims%rowtype;
  v_owner public.employees%rowtype;
  v_last_audit public.claim_status_audit%rowtype;
  v_transition public.claim_transition_graph%rowtype;
  v_target_level int;
begin
  v_email := public.current_user_email();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if coalesce(v_email, '') = '' then raise exception 'Unauthorized request.'; end if;
  if p_confirmation <> 'CONFIRM' then raise exception 'Secondary confirmation is required.'; end if;
  if v_reason is null then raise exception 'Rollback reason is required.'; end if;

  select e.id into v_admin_employee_id
  from public.employees e
  join public.employee_roles er on er.employee_id = e.id and er.is_active = true
  join public.roles r on r.id = er.role_id
  where lower(e.employee_email) = v_email and r.role_code = 'ADMIN'
  limit 1;
  if v_admin_employee_id is null then raise exception 'Admin access is required.'; end if;

  if exists (
    select 1 from public.approval_history h
    where h.approver_employee_id = v_admin_employee_id
      and h.action = 'admin_override'
      and h.acted_at > now() - interval '30 seconds'
  ) then raise exception 'Please wait before applying another admin override.'; end if;

  select * into v_claim from public.expense_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found.'; end if;

  select * into v_owner from public.employees where id = v_claim.employee_id;

  select * into v_last_audit from public.claim_status_audit a
  where a.claim_id = v_claim.id order by a.changed_at desc limit 1;
  if not found then raise exception 'No status audit found for rollback.'; end if;

  select * into v_transition from public.claim_transition_graph t
  where t.tenant_id = v_claim.tenant_id
    and t.from_status = v_claim.status
    and t.to_status = v_last_audit.from_status
    and t.trigger_action = 'admin_override'
    and t.actor_scope = 'admin' and t.is_active = true
  order by t.created_at desc limit 1;
  if not found then raise exception 'No admin rollback transition configured for this state pair.'; end if;

  v_target_level := coalesce(
    v_last_audit.from_approval_level,
    case when v_last_audit.from_status = 'pending_approval'
    then public.resolve_next_approval_level(v_owner, null, 'reset_first_configured')
    else null end
  );

  update public.expense_claims
  set status = v_last_audit.from_status, current_approval_level = v_target_level, updated_at = now()
  where id = v_claim.id;

  insert into public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes, reason, metadata
  ) values (
    v_claim.id, v_admin_employee_id, null, 'admin_override', v_reason, v_reason,
    jsonb_build_object('from_status', v_claim.status, 'to_status', v_last_audit.from_status, 'transition_id', v_transition.id)
  );

  perform public.log_claim_status_audit(
    v_claim.id, v_email, 'admin', 'admin_override',
    v_claim.status, v_last_audit.from_status,
    v_claim.current_approval_level, v_target_level,
    null, v_reason, jsonb_build_object('transition_id', v_transition.id)
  );

  return query select v_claim.id, v_last_audit.from_status, v_target_level;
end;
$$;

-- 1d) admin_reassign_employee_approvers_atomic — remove approver_email from approval_history INSERT
CREATE OR REPLACE FUNCTION public.admin_reassign_employee_approvers_atomic(
  p_employee_id uuid,
  p_level_1 text DEFAULT NULL,
  p_level_2 text DEFAULT NULL,
  p_level_3 text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_confirmation text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
declare
  v_email text;
  v_admin_employee_id uuid;
  v_reason text;
  v_claim_count int;
begin
  v_email := public.current_user_email();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if coalesce(v_email, '') = '' then raise exception 'Unauthorized request.'; end if;
  if p_confirmation <> 'CONFIRM' then raise exception 'Secondary confirmation is required.'; end if;
  if v_reason is null then raise exception 'Reassignment reason is required.'; end if;

  select e.id into v_admin_employee_id
  from public.employees e
  join public.employee_roles er on er.employee_id = e.id and er.is_active = true
  join public.roles r on r.id = er.role_id
  where lower(e.employee_email) = v_email and r.role_code = 'ADMIN'
  limit 1;
  if v_admin_employee_id is null then raise exception 'Admin access is required.'; end if;

  update public.employees
  set approval_email_level_1 = nullif(lower(trim(coalesce(p_level_1, ''))), ''),
      approval_email_level_2 = nullif(lower(trim(coalesce(p_level_2, ''))), ''),
      approval_email_level_3 = nullif(lower(trim(coalesce(p_level_3, ''))), '')
  where id = p_employee_id;
  if not found then raise exception 'Employee not found for approver reassignment.'; end if;

  insert into public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes, reason, metadata
  )
  select c.id, v_admin_employee_id, null, 'admin_override', v_reason, v_reason,
    jsonb_build_object(
      'operation', 'reassign_approvers', 'employee_id', p_employee_id,
      'approval_email_level_1', nullif(lower(trim(coalesce(p_level_1, ''))), ''),
      'approval_email_level_2', nullif(lower(trim(coalesce(p_level_2, ''))), ''),
      'approval_email_level_3', nullif(lower(trim(coalesce(p_level_3, ''))), '')
    )
  from public.expense_claims c
  where c.employee_id = p_employee_id
    and c.status in ('pending_approval', 'returned_for_modification', 'finance_review');

  get diagnostics v_claim_count = row_count;
  return v_claim_count;
end;
$$;

-- 1e) resubmit_claim_after_rejection_atomic — remove approver_email from approval_history INSERT
CREATE OR REPLACE FUNCTION public.resubmit_claim_after_rejection_atomic(
  p_claim_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status text, new_approval_level int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
declare
  v_email text;
  v_employee_id uuid;
  v_notes text;
  v_claim public.expense_claims%rowtype;
  v_owner public.employees%rowtype;
  v_transition public.claim_transition_graph%rowtype;
  v_next_level int;
  v_next_status text;
  v_trigger_action text;
  v_is_resubmission boolean;
begin
  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then raise exception 'Unauthorized request.'; end if;
  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  select id into v_employee_id from public.employees where lower(employee_email) = v_email;

  select c.* into v_claim from public.expense_claims c
  join public.employees e on e.id = c.employee_id
  where c.id = p_claim_id and lower(e.employee_email) = v_email for update;
  if not found then raise exception 'Claim not found for current employee.'; end if;

  if v_claim.status not in ('returned_for_modification', 'submitted') then
    raise exception 'Only submitted or returned claims can move to workflow.';
  end if;

  v_is_resubmission := v_claim.status = 'returned_for_modification';
  v_trigger_action := case when v_is_resubmission then 'resubmitted' else 'submitted' end;

  select * into v_owner from public.employees where id = v_claim.employee_id;

  select * into v_transition from public.claim_transition_graph t
  where t.tenant_id = v_claim.tenant_id
    and t.from_status = v_claim.status
    and t.trigger_action = v_trigger_action
    and t.actor_scope = 'employee' and t.is_active = true
  order by t.created_at desc limit 1;
  if not found then raise exception 'No transition configured for claim submission path.'; end if;

  v_next_level := public.resolve_next_approval_level(v_owner, null, v_transition.next_level_mode);
  v_next_status := v_transition.to_status;
  if v_next_level is null and v_transition.to_status_when_no_next is not null then
    v_next_status := v_transition.to_status_when_no_next;
  end if;

  update public.expense_claims
  set status = v_next_status, current_approval_level = v_next_level,
      submitted_at = now(),
      resubmission_count = case when v_is_resubmission then resubmission_count + 1 else resubmission_count end,
      updated_at = now()
  where id = v_claim.id;

  if v_is_resubmission then
    insert into public.approval_history (
      claim_id, approver_employee_id, approval_level, action, notes, metadata
    ) values (
      v_claim.id, v_employee_id, null, 'resubmitted', v_notes,
      jsonb_build_object('transition_id', v_transition.id)
    );
  end if;

  perform public.log_claim_status_audit(
    v_claim.id, v_email, 'employee', v_trigger_action,
    v_claim.status, v_next_status,
    v_claim.current_approval_level, v_next_level,
    null, v_notes, jsonb_build_object('transition_id', v_transition.id)
  );

  return query select v_claim.id, v_next_status, v_next_level;
end;
$$;

-- 1f) bulk_issue_claims_atomic — remove actor_email from finance_actions INSERT
CREATE OR REPLACE FUNCTION public.bulk_issue_claims_atomic(
  p_claim_ids uuid[],
  p_notes text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
declare
  v_email text;
  v_finance_employee_id uuid;
  v_is_finance boolean;
  v_requested_count int;
  v_eligible_count int;
  v_updated_count int;
begin
  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then raise exception 'Unauthorized request.'; end if;

  select id into v_finance_employee_id from public.employees where lower(employee_email) = v_email;

  select exists (
    select 1 from public.employees e
    join public.employee_roles er on er.employee_id = e.id and er.is_active = true
    join public.roles r on r.id = er.role_id
    where lower(e.employee_email) = v_email
      and r.role_code in ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
  ) into v_is_finance;
  if not v_is_finance then raise exception 'Finance access is required.'; end if;

  if p_claim_ids is null or coalesce(array_length(p_claim_ids, 1), 0) = 0 then
    raise exception 'At least one claim must be selected.';
  end if;

  with requested as (select distinct unnest(p_claim_ids) as claim_id)
  select count(*) into v_requested_count from requested;

  with requested as (select distinct unnest(p_claim_ids) as claim_id),
  eligible as (
    select c.id from public.expense_claims c
    join requested r on r.claim_id = c.id
    where c.status = 'finance_review' for update
  )
  select count(*) into v_eligible_count from eligible;

  if v_eligible_count <> v_requested_count then
    raise exception 'One or more selected claims are not available in finance review.';
  end if;

  with requested as (select distinct unnest(p_claim_ids) as claim_id)
  insert into public.finance_actions (claim_id, actor_employee_id, action, notes)
  select r.claim_id, v_finance_employee_id, 'issued', nullif(trim(coalesce(p_notes, '')), '')
  from requested r;

  with requested as (select distinct unnest(p_claim_ids) as claim_id)
  update public.expense_claims c
  set status = 'issued', current_approval_level = null, updated_at = now()
  from requested r where c.id = r.claim_id;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

-- ============================================================
-- STEP 2: Drop blocking RLS policies
-- ============================================================

DROP POLICY IF EXISTS "active approver can insert approval history" ON public.approval_history;
DROP POLICY IF EXISTS "finance can insert finance actions" ON public.finance_actions;

-- ============================================================
-- STEP 3: Drop old text columns
-- ============================================================

ALTER TABLE public.expense_claims DROP COLUMN IF EXISTS work_location;
ALTER TABLE public.expense_claims DROP COLUMN IF EXISTS vehicle_type;
ALTER TABLE public.approval_history DROP COLUMN IF EXISTS approver_email;
ALTER TABLE public.finance_actions DROP COLUMN IF EXISTS actor_email;

-- ============================================================
-- STEP 4: Recreate RLS policies using ID-based checks
-- ============================================================

-- approval_history: approver can insert if their employee ID matches and they're the active approver
CREATE POLICY "active approver can insert approval history"
  ON public.approval_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.expense_claims c
      JOIN public.employees e ON e.id = c.employee_id
      WHERE c.id = approval_history.claim_id
        AND (
          (c.current_approval_level = 1 AND lower(COALESCE(e.approval_email_level_1, '')) = current_user_email())
          OR (c.current_approval_level = 2 AND lower(COALESCE(e.approval_email_level_2, '')) = current_user_email())
          OR (c.current_approval_level = 3 AND lower(COALESCE(e.approval_email_level_3, '')) = current_user_email())
        )
        AND approval_history.approver_employee_id = (
          SELECT id FROM public.employees WHERE lower(employee_email) = current_user_email() LIMIT 1
        )
    )
  );

-- finance_actions: finance user can insert if their employee ID matches
CREATE POLICY "finance can insert finance actions"
  ON public.finance_actions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees current_emp
      JOIN public.employee_roles er ON er.employee_id = current_emp.id AND er.is_active = true
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(current_emp.employee_email) = current_user_email()
        AND r.role_code::text = ANY(ARRAY['FINANCE_REVIEWER', 'FINANCE_PROCESSOR']::text[])
        AND finance_actions.actor_employee_id = current_emp.id
    )
  );

COMMIT;
