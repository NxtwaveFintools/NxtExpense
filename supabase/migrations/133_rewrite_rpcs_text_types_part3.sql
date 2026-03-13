-- Migration 133: Rewrite RPCs to use text types instead of enum types (Part 3)
-- Phase 9b — admin RPCs + bulk operations
--
-- Functions updated: admin_rollback_claim_atomic,
--   admin_reassign_employee_approvers_atomic,
--   bulk_finance_actions_atomic, bulk_issue_claims_atomic

BEGIN;

-- =============================================================================
-- 1. admin_rollback_claim_atomic
-- =============================================================================
DROP FUNCTION IF EXISTS public.admin_rollback_claim_atomic(uuid, text, text);

CREATE OR REPLACE FUNCTION public.admin_rollback_claim_atomic(
  p_claim_id uuid,
  p_reason text,
  p_confirmation text DEFAULT 'CONFIRM'
)
RETURNS TABLE(claim_id uuid, rolled_back_to text, rolled_back_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_reason text;
  v_is_admin boolean;
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

  select exists (
    select 1 from public.employees e
    join public.employee_roles er on er.employee_id = e.id and er.is_active = true
    join public.roles r on r.id = er.role_id
    where lower(e.employee_email) = v_email and r.role_code = 'ADMIN'
  ) into v_is_admin;
  if not v_is_admin then raise exception 'Admin access is required.'; end if;

  if exists (
    select 1 from public.approval_history h
    where lower(h.approver_email) = v_email
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
    claim_id, approver_email, approval_level, action, notes, reason, metadata
  ) values (
    v_claim.id, v_email, null, 'admin_override', v_reason, v_reason,
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
$function$;

-- =============================================================================
-- 2. admin_reassign_employee_approvers_atomic — no enum type changes needed
--    but body uses old status enum literals. Update to plain text.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_reassign_employee_approvers_atomic(
  p_employee_id uuid,
  p_level_1 text,
  p_level_2 text,
  p_level_3 text,
  p_reason text,
  p_confirmation text DEFAULT 'CONFIRM'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_reason text;
  v_is_admin boolean;
  v_claim_count int;
begin
  v_email := public.current_user_email();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if coalesce(v_email, '') = '' then raise exception 'Unauthorized request.'; end if;
  if p_confirmation <> 'CONFIRM' then raise exception 'Secondary confirmation is required.'; end if;
  if v_reason is null then raise exception 'Reassignment reason is required.'; end if;

  select exists (
    select 1 from public.employees e
    join public.employee_roles er on er.employee_id = e.id and er.is_active = true
    join public.roles r on r.id = er.role_id
    where lower(e.employee_email) = v_email and r.role_code = 'ADMIN'
  ) into v_is_admin;
  if not v_is_admin then raise exception 'Admin access is required.'; end if;

  update public.employees
  set approval_email_level_1 = nullif(lower(trim(coalesce(p_level_1, ''))), ''),
      approval_email_level_2 = nullif(lower(trim(coalesce(p_level_2, ''))), ''),
      approval_email_level_3 = nullif(lower(trim(coalesce(p_level_3, ''))), '')
  where id = p_employee_id;
  if not found then raise exception 'Employee not found for approver reassignment.'; end if;

  insert into public.approval_history (
    claim_id, approver_email, approval_level, action, notes, reason, metadata
  )
  select c.id, v_email, null, 'admin_override', v_reason, v_reason,
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
$function$;

-- =============================================================================
-- 3. bulk_finance_actions_atomic — param used finance_action_type
-- =============================================================================
DROP FUNCTION IF EXISTS public.bulk_finance_actions_atomic(uuid[], finance_action_type, text, boolean);

CREATE OR REPLACE FUNCTION public.bulk_finance_actions_atomic(
  p_claim_ids uuid[],
  p_action text,
  p_notes text DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_claim_id uuid;
  v_processed int := 0;
begin
  if p_claim_ids is null or coalesce(array_length(p_claim_ids, 1), 0) = 0 then
    raise exception 'At least one claim must be selected.';
  end if;

  if p_action = 'reopened' then
    raise exception 'Bulk reopen is not supported.';
  end if;

  for v_claim_id in select distinct unnest(p_claim_ids) loop
    perform * from public.submit_finance_action_atomic(v_claim_id, p_action, p_notes, p_allow_resubmit);
    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$function$;

-- =============================================================================
-- 4. bulk_issue_claims_atomic — body used ::claim_status, ::finance_action_type
-- =============================================================================
CREATE OR REPLACE FUNCTION public.bulk_issue_claims_atomic(
  p_claim_ids uuid[],
  p_notes text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_is_finance boolean;
  v_requested_count int;
  v_eligible_count int;
  v_updated_count int;
begin
  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then raise exception 'Unauthorized request.'; end if;

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
  insert into public.finance_actions (claim_id, actor_email, action, notes)
  select r.claim_id, v_email, 'issued', nullif(trim(coalesce(p_notes, '')), '')
  from requested r;

  with requested as (select distinct unnest(p_claim_ids) as claim_id)
  update public.expense_claims c
  set status = 'issued', current_approval_level = null, updated_at = now()
  from requested r where c.id = r.claim_id;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$function$;

COMMIT;
