BEGIN;

-- Migration 126: Refactor RPCs to use role-based access checks (Part 1)
-- Phase 7 of ID-based architecture migration
--
-- Replaces designation::text = 'Admin' with employee_roles/roles join
-- Functions: admin_reassign_employee_approvers_atomic,
--            admin_rollback_claim_atomic,
--            get_claim_available_actions

-- =============================================================================
-- 1. admin_reassign_employee_approvers_atomic
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_reassign_employee_approvers_atomic(
  p_employee_id uuid,
  p_level_1 text,
  p_level_2 text,
  p_level_3 text,
  p_reason text,
  p_confirmation text DEFAULT 'CONFIRM'::text
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

  if coalesce(v_email, '') = '' then
    raise exception 'Unauthorized request.';
  end if;

  if p_confirmation <> 'CONFIRM' then
    raise exception 'Secondary confirmation is required.';
  end if;

  if v_reason is null then
    raise exception 'Reassignment reason is required.';
  end if;

  -- Role-based admin check (replaces designation::text = 'Admin')
  select exists (
    select 1
    from public.employees e
    join public.employee_roles er on er.employee_id = e.id and er.is_active = true
    join public.roles r on r.id = er.role_id
    where lower(e.employee_email) = v_email
      and r.role_code = 'ADMIN'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Admin access is required.';
  end if;

  update public.employees
  set approval_email_level_1 = nullif(lower(trim(coalesce(p_level_1, ''))), ''),
      approval_email_level_2 = nullif(lower(trim(coalesce(p_level_2, ''))), ''),
      approval_email_level_3 = nullif(lower(trim(coalesce(p_level_3, ''))), '')
  where id = p_employee_id;

  if not found then
    raise exception 'Employee not found for approver reassignment.';
  end if;

  insert into public.approval_history (
    claim_id,
    approver_email,
    approval_level,
    action,
    notes,
    reason,
    metadata
  )
  select
    c.id,
    v_email,
    null,
    'admin_override',
    v_reason,
    v_reason,
    jsonb_build_object(
      'operation', 'reassign_approvers',
      'employee_id', p_employee_id,
      'approval_email_level_1', nullif(lower(trim(coalesce(p_level_1, ''))), ''),
      'approval_email_level_2', nullif(lower(trim(coalesce(p_level_2, ''))), ''),
      'approval_email_level_3', nullif(lower(trim(coalesce(p_level_3, ''))), '')
    )
  from public.expense_claims c
  where c.employee_id = p_employee_id
    and c.status in (
      'pending_approval',
      'returned_for_modification',
      'finance_review'
    );

  get diagnostics v_claim_count = row_count;
  return v_claim_count;
end;
$function$;

-- =============================================================================
-- 2. admin_rollback_claim_atomic
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_rollback_claim_atomic(
  p_claim_id uuid,
  p_reason text,
  p_confirmation text DEFAULT 'CONFIRM'::text
)
RETURNS TABLE(claim_id uuid, rolled_back_to claim_status, rolled_back_level integer)
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

  if coalesce(v_email, '') = '' then
    raise exception 'Unauthorized request.';
  end if;

  if p_confirmation <> 'CONFIRM' then
    raise exception 'Secondary confirmation is required.';
  end if;

  if v_reason is null then
    raise exception 'Rollback reason is required.';
  end if;

  -- Role-based admin check (replaces designation::text = 'Admin')
  select exists (
    select 1
    from public.employees e
    join public.employee_roles er on er.employee_id = e.id and er.is_active = true
    join public.roles r on r.id = er.role_id
    where lower(e.employee_email) = v_email
      and r.role_code = 'ADMIN'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Admin access is required.';
  end if;

  if exists (
    select 1
    from public.approval_history h
    where lower(h.approver_email) = v_email
      and h.action = 'admin_override'
      and h.acted_at > now() - interval '30 seconds'
  ) then
    raise exception 'Please wait before applying another admin override.';
  end if;

  select *
  into v_claim
  from public.expense_claims
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'Claim not found.';
  end if;

  select *
  into v_owner
  from public.employees
  where id = v_claim.employee_id;

  select *
  into v_last_audit
  from public.claim_status_audit a
  where a.claim_id = v_claim.id
  order by a.changed_at desc
  limit 1;

  if not found then
    raise exception 'No status audit found for rollback.';
  end if;

  select *
  into v_transition
  from public.claim_transition_graph t
  where t.tenant_id = v_claim.tenant_id
    and t.from_status = v_claim.status
    and t.to_status = v_last_audit.from_status
    and t.trigger_action = 'admin_override'
    and t.actor_scope = 'admin'
    and t.is_active = true
  order by t.created_at desc
  limit 1;

  if not found then
    raise exception 'No admin rollback transition configured for this state pair.';
  end if;

  v_target_level := coalesce(
    v_last_audit.from_approval_level,
    case
      when v_last_audit.from_status = 'pending_approval'
      then public.resolve_next_approval_level(v_owner, null, 'reset_first_configured')
      else null
    end
  );

  update public.expense_claims
  set status = v_last_audit.from_status,
      current_approval_level = v_target_level,
      updated_at = now()
  where id = v_claim.id;

  insert into public.approval_history (
    claim_id,
    approver_email,
    approval_level,
    action,
    notes,
    reason,
    metadata
  )
  values (
    v_claim.id,
    v_email,
    null,
    'admin_override',
    v_reason,
    v_reason,
    jsonb_build_object(
      'from_status', v_claim.status,
      'to_status', v_last_audit.from_status,
      'transition_id', v_transition.id
    )
  );

  perform public.log_claim_status_audit(
    v_claim.id,
    v_email,
    'admin',
    'admin_override',
    v_claim.status,
    v_last_audit.from_status,
    v_claim.current_approval_level,
    v_target_level,
    null,
    v_reason,
    jsonb_build_object('transition_id', v_transition.id)
  );

  return query
  select v_claim.id, v_last_audit.from_status, v_target_level;
end;
$function$;

-- =============================================================================
-- 3. get_claim_available_actions
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_claim_available_actions(p_claim_id uuid)
RETURNS TABLE(
  action text,
  display_label text,
  require_notes boolean,
  supports_allow_resubmit boolean,
  actor_scope claim_actor_scope
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_claim public.expense_claims%rowtype;
  v_owner public.employees%rowtype;
  v_current public.employees%rowtype;
  v_actor public.claim_actor_scope;
  v_level int;
begin
  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then
    return;
  end if;

  select *
  into v_claim
  from public.expense_claims
  where id = p_claim_id;

  if not found then
    return;
  end if;

  select * into v_owner from public.employees where id = v_claim.employee_id;
  select * into v_current from public.employees where lower(employee_email) = v_email;

  -- Role-based actor determination (replaces designation::text checks)
  if found and exists (
    select 1 from public.employee_roles er
    join public.roles r on r.id = er.role_id
    where er.employee_id = v_current.id and er.is_active = true
      and r.role_code = 'ADMIN'
  ) then
    v_actor := 'admin';
  elsif found and exists (
    select 1 from public.employee_roles er
    join public.roles r on r.id = er.role_id
    where er.employee_id = v_current.id and er.is_active = true
      and r.role_code in ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
  ) then
    v_actor := 'finance';
  elsif lower(coalesce(v_owner.employee_email, '')) = v_email
    and v_claim.status = 'returned_for_modification' then
    v_actor := 'employee';
  elsif lower(coalesce(v_owner.approval_email_level_1, '')) = v_email
    and v_claim.current_approval_level = 1 then
    v_actor := 'approver';
    v_level := 1;
  elsif lower(coalesce(v_owner.approval_email_level_2, '')) = v_email
    and v_claim.current_approval_level = 2 then
    v_actor := 'approver';
    v_level := 2;
  elsif lower(coalesce(v_owner.approval_email_level_3, '')) = v_email
    and v_claim.current_approval_level = 3 then
    v_actor := 'approver';
    v_level := 3;
  else
    return;
  end if;

  return query
  select
    t.trigger_action,
    max(t.action_label) as display_label,
    bool_or(t.require_notes) as require_notes,
    bool_or(t.allow_resubmit = true) as supports_allow_resubmit,
    v_actor
  from public.claim_transition_graph t
  where t.tenant_id = v_claim.tenant_id
    and t.from_status = v_claim.status
    and t.actor_scope = v_actor
    and t.is_active = true
    and (
      v_actor <> 'approver'
      or t.allowed_approver_levels is null
      or v_level = any(t.allowed_approver_levels)
    )
  group by t.trigger_action
  order by min(t.created_at);
end;
$function$;

COMMIT;
