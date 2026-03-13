-- Migration 132: Rewrite RPCs to use text types instead of enum types (Part 2)
-- Phase 9b — workflow mutation RPCs
--
-- Functions updated: submit_approval_action_atomic, submit_finance_action_atomic,
--   resubmit_claim_after_rejection_atomic, admin_rollback_claim_atomic,
--   admin_reassign_employee_approvers_atomic, bulk_finance_actions_atomic,
--   bulk_issue_claims_atomic

BEGIN;

-- =============================================================================
-- 1. submit_approval_action_atomic
-- =============================================================================
DROP FUNCTION IF EXISTS public.submit_approval_action_atomic(uuid, approval_action_type, text, boolean);

CREATE OR REPLACE FUNCTION public.submit_approval_action_atomic(
  p_claim_id uuid,
  p_action text,
  p_notes text DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT false
)
RETURNS TABLE(claim_id uuid, next_status text, next_approval_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_email text;
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
      last_rejected_at = case when p_action = 'rejected' then now() else last_rejected_at end,
      updated_at = now()
  where id = v_claim.id;

  insert into public.approval_history (
    claim_id, approver_email, approval_level, action, notes,
    rejection_notes, allow_resubmit, metadata
  ) values (
    v_claim.id, v_email, v_level, p_action, v_notes,
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
$function$;

-- =============================================================================
-- 2. submit_finance_action_atomic
-- =============================================================================
DROP FUNCTION IF EXISTS public.submit_finance_action_atomic(uuid, finance_action_type, text, boolean);

CREATE OR REPLACE FUNCTION public.submit_finance_action_atomic(
  p_claim_id uuid,
  p_action text,
  p_notes text DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT false
)
RETURNS TABLE(claim_id uuid, updated_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_email text;
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
      last_rejected_at = case when p_action = 'finance_rejected' then now() else last_rejected_at end,
      updated_at = now()
  where id = v_claim.id;

  insert into public.finance_actions (claim_id, actor_email, action, notes)
  values (v_claim.id, v_email, p_action, v_notes);

  v_history_action := case
    when p_action = 'issued' then 'finance_issued'
    when p_action = 'reopened' then 'reopened'
    else 'finance_rejected'
  end;

  insert into public.approval_history (
    claim_id, approver_email, approval_level, action, notes,
    rejection_notes, allow_resubmit, metadata
  ) values (
    v_claim.id, v_email, null, v_history_action, v_notes,
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
$function$;

-- =============================================================================
-- 3. resubmit_claim_after_rejection_atomic
-- =============================================================================
DROP FUNCTION IF EXISTS public.resubmit_claim_after_rejection_atomic(uuid, text);

CREATE OR REPLACE FUNCTION public.resubmit_claim_after_rejection_atomic(
  p_claim_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, next_status text, next_approval_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_email text;
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
      claim_id, approver_email, approval_level, action, notes, metadata
    ) values (
      v_claim.id, v_email, null, 'resubmitted', v_notes,
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
$function$;

COMMIT;
