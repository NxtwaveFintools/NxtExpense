BEGIN;

-- Migration 136: Phase 10 — Rewrite all RPCs for ID-based writes
-- All RPCs now write BOTH old email columns AND new employee ID columns.
-- get_filtered_approval_history now joins through IDs instead of email/text columns.

-- =============================================================================
-- 0. Backfill any missing ID columns from email columns
-- =============================================================================
UPDATE public.approval_history ah SET approver_employee_id = e.id
FROM public.employees e
WHERE lower(ah.approver_email) = lower(e.employee_email) AND ah.approver_employee_id IS NULL;

UPDATE public.finance_actions fa SET actor_employee_id = e.id
FROM public.employees e
WHERE lower(fa.actor_email) = lower(e.employee_email) AND fa.actor_employee_id IS NULL;

UPDATE public.claim_status_audit csa SET actor_employee_id = e.id
FROM public.employees e
WHERE lower(csa.actor_email) = lower(e.employee_email) AND csa.actor_employee_id IS NULL;

UPDATE public.expense_claims ec SET last_rejected_by_employee_id = e.id
FROM public.employees e
WHERE lower(ec.last_rejected_by_email) = lower(e.employee_email)
  AND ec.last_rejected_by_employee_id IS NULL AND ec.last_rejected_by_email IS NOT NULL;

-- =============================================================================
-- 1. log_claim_status_audit — write both actor_email + actor_employee_id
-- =============================================================================
CREATE OR REPLACE FUNCTION public.log_claim_status_audit(
  p_claim_id uuid, p_actor_email text, p_actor_scope text, p_trigger_action text,
  p_from_status text, p_to_status text, p_from_approval_level integer,
  p_to_approval_level integer, p_allow_resubmit boolean, p_notes text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  insert into public.claim_status_audit (
    claim_id, actor_email, actor_employee_id, actor_scope, trigger_action,
    from_status, to_status, from_approval_level, to_approval_level,
    allow_resubmit, notes, metadata
  )
  values (
    p_claim_id, lower(p_actor_email),
    (select id from public.employees where lower(employee_email) = lower(p_actor_email) limit 1),
    p_actor_scope, p_trigger_action,
    p_from_status, p_to_status, p_from_approval_level, p_to_approval_level,
    p_allow_resubmit, p_notes, coalesce(p_metadata, '{}'::jsonb)
  );
$function$;

-- =============================================================================
-- 2. submit_approval_action_atomic — write both approver_email + approver_employee_id
-- =============================================================================
CREATE OR REPLACE FUNCTION public.submit_approval_action_atomic(
  p_claim_id uuid, p_action text, p_notes text DEFAULT NULL::text,
  p_allow_resubmit boolean DEFAULT false
)
RETURNS TABLE(claim_id uuid, next_status text, next_approval_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    claim_id, approver_email, approver_employee_id, approval_level, action, notes,
    rejection_notes, allow_resubmit, metadata
  ) values (
    v_claim.id, v_email, v_actor_employee_id, v_level, p_action, v_notes,
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
-- 3. submit_finance_action_atomic
-- =============================================================================
CREATE OR REPLACE FUNCTION public.submit_finance_action_atomic(
  p_claim_id uuid, p_action text, p_notes text DEFAULT NULL::text,
  p_allow_resubmit boolean DEFAULT false
)
RETURNS TABLE(claim_id uuid, updated_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  insert into public.finance_actions (claim_id, actor_email, actor_employee_id, action, notes)
  values (v_claim.id, v_email, v_actor_employee_id, p_action, v_notes);

  v_history_action := case
    when p_action = 'issued' then 'finance_issued'
    when p_action = 'reopened' then 'reopened'
    else 'finance_rejected'
  end;

  insert into public.approval_history (
    claim_id, approver_email, approver_employee_id, approval_level, action, notes,
    rejection_notes, allow_resubmit, metadata
  ) values (
    v_claim.id, v_email, v_actor_employee_id, null, v_history_action, v_notes,
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
-- 4. admin_rollback_claim_atomic — combined admin ID + role check
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_rollback_claim_atomic(
  p_claim_id uuid, p_reason text, p_confirmation text DEFAULT 'CONFIRM'::text
)
RETURNS TABLE(claim_id uuid, rolled_back_to text, rolled_back_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    claim_id, approver_email, approver_employee_id, approval_level, action, notes, reason, metadata
  ) values (
    v_claim.id, v_email, v_admin_employee_id, null, 'admin_override', v_reason, v_reason,
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
-- 5. admin_reassign_employee_approvers_atomic
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_reassign_employee_approvers_atomic(
  p_employee_id uuid, p_level_1 text, p_level_2 text, p_level_3 text,
  p_reason text, p_confirmation text DEFAULT 'CONFIRM'::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    claim_id, approver_email, approver_employee_id, approval_level, action, notes, reason, metadata
  )
  select c.id, v_email, v_admin_employee_id, null, 'admin_override', v_reason, v_reason,
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
-- 6. bulk_issue_claims_atomic
-- =============================================================================
CREATE OR REPLACE FUNCTION public.bulk_issue_claims_atomic(
  p_claim_ids uuid[], p_notes text DEFAULT NULL::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  insert into public.finance_actions (claim_id, actor_email, actor_employee_id, action, notes)
  select r.claim_id, v_email, v_finance_employee_id, 'issued', nullif(trim(coalesce(p_notes, '')), '')
  from requested r;

  with requested as (select distinct unnest(p_claim_ids) as claim_id)
  update public.expense_claims c
  set status = 'issued', current_approval_level = null, updated_at = now()
  from requested r where c.id = r.claim_id;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$function$;

-- =============================================================================
-- 7. resubmit_claim_after_rejection_atomic
-- =============================================================================
CREATE OR REPLACE FUNCTION public.resubmit_claim_after_rejection_atomic(
  p_claim_id uuid, p_notes text DEFAULT NULL::text
)
RETURNS TABLE(claim_id uuid, next_status text, next_approval_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      claim_id, approver_email, approver_employee_id, approval_level, action, notes, metadata
    ) values (
      v_claim.id, v_email, v_employee_id, null, 'resubmitted', v_notes,
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

-- =============================================================================
-- 8. get_filtered_approval_history — join through IDs, same return type
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_filtered_approval_history(
  p_limit integer DEFAULT 10,
  p_cursor_acted_at timestamp with time zone DEFAULT NULL,
  p_cursor_action_id uuid DEFAULT NULL,
  p_name_search text DEFAULT NULL,
  p_actor_filters text[] DEFAULT NULL,
  p_claim_date_from date DEFAULT NULL,
  p_claim_date_to date DEFAULT NULL,
  p_hod_approved_from timestamp with time zone DEFAULT NULL,
  p_hod_approved_to timestamp with time zone DEFAULT NULL,
  p_finance_approved_from timestamp with time zone DEFAULT NULL,
  p_finance_approved_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  action_id uuid, claim_id uuid, claim_number text, claim_date date,
  work_location text, total_amount numeric, claim_status text,
  owner_name text, owner_designation text,
  actor_email text, actor_designation text,
  action text, approval_level integer, notes text,
  acted_at timestamp with time zone,
  hod_approved_at timestamp with time zone,
  finance_approved_at timestamp with time zone
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select
    ah.id as action_id, ah.claim_id, c.claim_number, c.claim_date,
    wl.location_name as work_location, c.total_amount, c.status as claim_status,
    owner_emp.employee_name as owner_name,
    owner_desig.designation_name as owner_designation,
    actor_emp.employee_email as actor_email,
    actor_desig.designation_name as actor_designation,
    ah.action, ah.approval_level, ah.notes, ah.acted_at,
    hod_event.hod_approved_at, finance_event.finance_approved_at
  from public.approval_history ah
  join public.expense_claims c on c.id = ah.claim_id
  join public.employees owner_emp on owner_emp.id = c.employee_id
  left join public.work_locations wl on wl.id = c.work_location_id
  left join public.designations owner_desig on owner_desig.id = owner_emp.designation_id
  left join public.employees actor_emp on actor_emp.id = ah.approver_employee_id
  left join public.designations actor_desig on actor_desig.id = actor_emp.designation_id
  left join lateral (
    select a.changed_at as hod_approved_at
    from public.claim_status_audit a
    where a.claim_id = c.id
      and a.actor_scope = 'approver'
      and a.trigger_action = 'approved'
      and a.to_status = 'finance_review'
    order by a.changed_at desc limit 1
  ) hod_event on true
  left join lateral (
    select a.changed_at as finance_approved_at
    from public.claim_status_audit a
    where a.claim_id = c.id
      and a.actor_scope = 'finance'
      and a.trigger_action = 'issued'
    order by a.changed_at desc limit 1
  ) finance_event on true
  where
    (p_name_search is null or trim(p_name_search) = ''
      or owner_emp.employee_name ilike ('%' || trim(p_name_search) || '%'))
    and (p_claim_date_from is null or c.claim_date >= p_claim_date_from)
    and (p_claim_date_to is null or c.claim_date <= p_claim_date_to)
    and (p_hod_approved_from is null or hod_event.hod_approved_at >= p_hod_approved_from)
    and (p_hod_approved_to is null or hod_event.hod_approved_at <= p_hod_approved_to)
    and (p_finance_approved_from is null or finance_event.finance_approved_at >= p_finance_approved_from)
    and (p_finance_approved_to is null or finance_event.finance_approved_at <= p_finance_approved_to)
    and (
      p_actor_filters is null or cardinality(p_actor_filters) = 0
      or 'all' = any(p_actor_filters)
      or (
        ('sbh' = any(p_actor_filters)
          and actor_emp.designation_id = public.get_designation_id('SBH'))
        or ('finance' = any(p_actor_filters) and exists (
          select 1 from public.employee_roles er
          join public.roles r on r.id = er.role_id
          where er.employee_id = actor_emp.id and er.is_active = true
            and r.role_code in ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')))
        or ('hod' = any(p_actor_filters) and exists (
          select 1 from public.claim_status_audit hod_audit
          where hod_audit.claim_id = ah.claim_id
            and hod_audit.actor_employee_id = ah.approver_employee_id
            and hod_audit.actor_scope = 'approver'
            and hod_audit.trigger_action = 'approved'
            and hod_audit.to_status = 'finance_review'))
      )
    )
    and (
      p_cursor_acted_at is null or p_cursor_action_id is null
      or ah.acted_at < p_cursor_acted_at
      or (ah.acted_at = p_cursor_acted_at and ah.id < p_cursor_action_id)
    )
  order by ah.acted_at desc, ah.id desc
  limit greatest(coalesce(p_limit, 10), 1) + 1;
$function$;

COMMIT;
