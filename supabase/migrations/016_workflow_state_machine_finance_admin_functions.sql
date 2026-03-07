drop function if exists public.submit_finance_action_atomic(uuid, public.finance_action_type, text);
drop function if exists public.bulk_finance_actions_atomic(uuid[], public.finance_action_type, text);

create or replace function public.submit_finance_action_atomic(
  p_claim_id uuid,
  p_action public.finance_action_type,
  p_notes text default null,
  p_allow_resubmit boolean default false
)
returns table (
  claim_id uuid,
  updated_status public.claim_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_notes text;
  v_claim public.expense_claims%rowtype;
  v_owner public.employees%rowtype;
  v_transition public.claim_transition_graph%rowtype;
  v_next_level int;
  v_next_status public.claim_status;
  v_is_finance boolean;
  v_history_action public.approval_action_type;
begin
  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then
    raise exception 'Unauthorized request.';
  end if;

  if p_action::text not in ('issued', 'finance_rejected', 'reopened') then
    raise exception 'Unsupported finance action.';
  end if;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  select exists (
    select 1
    from public.employees e
    where lower(e.employee_email) = v_email
      and e.designation::text = 'Finance'
  )
  into v_is_finance;

  if not v_is_finance then
    raise exception 'Finance access is required.';
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
  into v_transition
  from public.claim_transition_graph t
  where t.tenant_id = v_claim.tenant_id
    and t.from_status = v_claim.status
    and t.trigger_action = p_action::text
    and t.actor_scope = 'finance'
    and t.is_active = true
    and (
      p_action::text <> 'finance_rejected'
      or t.allow_resubmit is null
      or t.allow_resubmit = p_allow_resubmit
    )
  order by t.created_at desc
  limit 1;

  if not found then
    raise exception 'No transition configured for this finance action.';
  end if;

  if v_transition.require_notes and v_notes is null then
    raise exception 'Notes are required for this action.';
  end if;

  v_next_level := public.resolve_next_approval_level(
    v_owner,
    v_claim.current_approval_level,
    v_transition.next_level_mode
  );

  v_next_status := v_transition.to_status;
  if v_next_level is null and v_transition.to_status_when_no_next is not null then
    v_next_status := v_transition.to_status_when_no_next;
  end if;

  update public.expense_claims
  set status = v_next_status,
      current_approval_level = v_next_level,
      last_rejection_notes = case when p_action::text = 'finance_rejected' then v_notes else last_rejection_notes end,
      last_rejected_by_email = case when p_action::text = 'finance_rejected' then v_email else last_rejected_by_email end,
      last_rejected_at = case when p_action::text = 'finance_rejected' then now() else last_rejected_at end,
      updated_at = now()
  where id = v_claim.id;

  insert into public.finance_actions (
    claim_id,
    actor_email,
    action,
    notes
  )
  values (
    v_claim.id,
    v_email,
    p_action,
    v_notes
  );

  v_history_action := case
    when p_action::text = 'issued' then 'finance_issued'::public.approval_action_type
    when p_action::text = 'reopened' then 'reopened'::public.approval_action_type
    else 'finance_rejected'::public.approval_action_type
  end;

  insert into public.approval_history (
    claim_id,
    approver_email,
    approval_level,
    action,
    notes,
    rejection_notes,
    allow_resubmit,
    metadata
  )
  values (
    v_claim.id,
    v_email,
    null,
    v_history_action,
    v_notes,
    case when p_action::text = 'finance_rejected' then v_notes else null end,
    case when p_action::text = 'finance_rejected' then p_allow_resubmit else null end,
    jsonb_build_object('transition_id', v_transition.id)
  );

  perform public.log_claim_status_audit(
    v_claim.id,
    v_email,
    'finance',
    p_action::text,
    v_claim.status,
    v_next_status,
    v_claim.current_approval_level,
    v_next_level,
    case when p_action::text = 'finance_rejected' then p_allow_resubmit else null end,
    v_notes,
    jsonb_build_object('transition_id', v_transition.id)
  );

  return query
  select v_claim.id, v_next_status;
end;
$$;

grant execute on function public.submit_finance_action_atomic(uuid, public.finance_action_type, text, boolean)
to authenticated;

create or replace function public.bulk_finance_actions_atomic(
  p_claim_ids uuid[],
  p_action public.finance_action_type,
  p_notes text default null,
  p_allow_resubmit boolean default false
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim_id uuid;
  v_processed int := 0;
begin
  if p_claim_ids is null or coalesce(array_length(p_claim_ids, 1), 0) = 0 then
    raise exception 'At least one claim must be selected.';
  end if;

  if p_action::text = 'reopened' then
    raise exception 'Bulk reopen is not supported.';
  end if;

  for v_claim_id in
    select distinct unnest(p_claim_ids)
  loop
    perform *
    from public.submit_finance_action_atomic(
      v_claim_id,
      p_action,
      p_notes,
      p_allow_resubmit
    );

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;

grant execute on function public.bulk_finance_actions_atomic(uuid[], public.finance_action_type, text, boolean)
to authenticated;

create or replace function public.admin_rollback_claim_atomic(
  p_claim_id uuid,
  p_reason text,
  p_confirmation text default 'CONFIRM'
)
returns table (
  claim_id uuid,
  rolled_back_to public.claim_status,
  rolled_back_level int
)
language plpgsql
security definer
set search_path = public
as $$
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

  select exists (
    select 1
    from public.employees e
    where lower(e.employee_email) = v_email
      and e.designation::text = 'Admin'
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
      when v_last_audit.from_status::text = 'pending_approval'
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
$$;

grant execute on function public.admin_rollback_claim_atomic(uuid, text, text)
to authenticated;

create or replace function public.admin_reassign_employee_approvers_atomic(
  p_employee_id uuid,
  p_level_1 text,
  p_level_2 text,
  p_level_3 text,
  p_reason text,
  p_confirmation text default 'CONFIRM'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
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

  select exists (
    select 1
    from public.employees e
    where lower(e.employee_email) = v_email
      and e.designation::text = 'Admin'
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
    and c.status::text in (
      'pending_approval',
      'returned_for_modification',
      'finance_review'
    );

  get diagnostics v_claim_count = row_count;
  return v_claim_count;
end;
$$;

grant execute on function public.admin_reassign_employee_approvers_atomic(uuid, text, text, text, text, text)
to authenticated;

create or replace function public.get_claim_available_actions(
  p_claim_id uuid
)
returns table (
  action text,
  display_label text,
  require_notes boolean,
  supports_allow_resubmit boolean,
  actor_scope public.claim_actor_scope
)
language plpgsql
security definer
set search_path = public
as $$
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

  if found and v_current.designation::text = 'Admin' then
    v_actor := 'admin';
  elsif found and v_current.designation::text = 'Finance' then
    v_actor := 'finance';
  elsif lower(coalesce(v_owner.employee_email, '')) = v_email and v_claim.status::text = 'returned_for_modification' then
    v_actor := 'employee';
  elsif lower(coalesce(v_owner.approval_email_level_1, '')) = v_email and v_claim.current_approval_level = 1 then
    v_actor := 'approver';
    v_level := 1;
  elsif lower(coalesce(v_owner.approval_email_level_2, '')) = v_email and v_claim.current_approval_level = 2 then
    v_actor := 'approver';
    v_level := 2;
  elsif lower(coalesce(v_owner.approval_email_level_3, '')) = v_email and v_claim.current_approval_level = 3 then
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
$$;

grant execute on function public.get_claim_available_actions(uuid)
to authenticated;
