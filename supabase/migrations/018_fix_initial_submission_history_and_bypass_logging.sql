update public.claim_transition_graph
set trigger_action = 'submitted',
    action_label = 'Submit Claim',
    updated_at = now()
where tenant_id = 'default'
  and from_status = 'submitted'
  and actor_scope = 'employee'
  and trigger_action = 'resubmitted';

create or replace function public.submit_approval_action_atomic(
  p_claim_id uuid,
  p_action public.approval_action_type,
  p_notes text default null,
  p_allow_resubmit boolean default false
)
returns table (
  claim_id uuid,
  next_status public.claim_status,
  next_approval_level int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_claim public.expense_claims%rowtype;
  v_owner public.employees%rowtype;
  v_transition public.claim_transition_graph%rowtype;
  v_notes text;
  v_level int;
  v_next_level int;
  v_next_status public.claim_status;
begin
  if p_action::text not in ('approved', 'rejected') then
    raise exception 'Unsupported approval action.';
  end if;

  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then
    raise exception 'Unauthorized request.';
  end if;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');

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

  if not found then
    raise exception 'Claim owner record not found.';
  end if;

  if lower(coalesce(v_owner.approval_email_level_1, '')) = v_email then
    v_level := 1;
  elsif lower(coalesce(v_owner.approval_email_level_2, '')) = v_email then
    v_level := 2;
  elsif lower(coalesce(v_owner.approval_email_level_3, '')) = v_email then
    v_level := 3;
  else
    v_level := null;
  end if;

  if v_level is null then
    raise exception 'You are not authorized to act on this claim.';
  end if;

  if v_claim.current_approval_level is distinct from v_level then
    raise exception 'You are not authorized to act on this claim at the current level.';
  end if;

  select *
  into v_transition
  from public.claim_transition_graph t
  where t.tenant_id = v_claim.tenant_id
    and t.from_status = v_claim.status
    and t.trigger_action = p_action::text
    and t.actor_scope = 'approver'
    and t.is_active = true
    and (t.allowed_approver_levels is null or v_level = any(t.allowed_approver_levels))
    and (
      p_action::text <> 'rejected'
      or t.allow_resubmit is null
      or t.allow_resubmit = p_allow_resubmit
    )
  order by t.created_at desc
  limit 1;

  if not found then
    raise exception 'No transition configured for this approval action.';
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
      last_rejection_notes = case when p_action::text = 'rejected' then v_notes else last_rejection_notes end,
      last_rejected_by_email = case when p_action::text = 'rejected' then v_email else last_rejected_by_email end,
      last_rejected_at = case when p_action::text = 'rejected' then now() else last_rejected_at end,
      updated_at = now()
  where id = v_claim.id;

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
    v_level,
    p_action,
    v_notes,
    case when p_action::text = 'rejected' then v_notes else null end,
    case when p_action::text = 'rejected' then p_allow_resubmit else null end,
    jsonb_build_object('transition_id', v_transition.id)
  );

  perform public.log_claim_status_audit(
    v_claim.id,
    v_email,
    'approver',
    p_action::text,
    v_claim.status,
    v_next_status,
    v_claim.current_approval_level,
    v_next_level,
    case when p_action::text = 'rejected' then p_allow_resubmit else null end,
    v_notes,
    jsonb_build_object('transition_id', v_transition.id)
  );

  return query
  select v_claim.id, v_next_status, v_next_level;
end;
$$;

grant execute on function public.submit_approval_action_atomic(uuid, public.approval_action_type, text, boolean)
to authenticated;

create or replace function public.resubmit_claim_after_rejection_atomic(
  p_claim_id uuid,
  p_notes text default null
)
returns table (
  claim_id uuid,
  next_status public.claim_status,
  next_approval_level int
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
  v_trigger_action text;
  v_is_resubmission boolean;
begin
  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then
    raise exception 'Unauthorized request.';
  end if;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  select c.*
  into v_claim
  from public.expense_claims c
  join public.employees e on e.id = c.employee_id
  where c.id = p_claim_id
    and lower(e.employee_email) = v_email
  for update;

  if not found then
    raise exception 'Claim not found for current employee.';
  end if;

  if v_claim.status::text not in ('returned_for_modification', 'submitted') then
    raise exception 'Only submitted or returned claims can move to workflow.';
  end if;

  v_is_resubmission := v_claim.status::text = 'returned_for_modification';
  v_trigger_action := case
    when v_is_resubmission then 'resubmitted'
    else 'submitted'
  end;

  select *
  into v_owner
  from public.employees
  where id = v_claim.employee_id;

  select *
  into v_transition
  from public.claim_transition_graph t
  where t.tenant_id = v_claim.tenant_id
    and t.from_status = v_claim.status
    and t.trigger_action = v_trigger_action
    and t.actor_scope = 'employee'
    and t.is_active = true
  order by t.created_at desc
  limit 1;

  if not found then
    raise exception 'No transition configured for claim submission path.';
  end if;

  v_next_level := public.resolve_next_approval_level(v_owner, null, v_transition.next_level_mode);
  v_next_status := v_transition.to_status;

  if v_next_level is null and v_transition.to_status_when_no_next is not null then
    v_next_status := v_transition.to_status_when_no_next;
  end if;

  update public.expense_claims
  set status = v_next_status,
      current_approval_level = v_next_level,
      submitted_at = now(),
      resubmission_count = case
        when v_is_resubmission then resubmission_count + 1
        else resubmission_count
      end,
      updated_at = now()
  where id = v_claim.id;

  if v_is_resubmission then
    insert into public.approval_history (
      claim_id,
      approver_email,
      approval_level,
      action,
      notes,
      metadata
    )
    values (
      v_claim.id,
      v_email,
      null,
      'resubmitted',
      v_notes,
      jsonb_build_object('transition_id', v_transition.id)
    );
  end if;

  perform public.log_claim_status_audit(
    v_claim.id,
    v_email,
    'employee',
    v_trigger_action,
    v_claim.status,
    v_next_status,
    v_claim.current_approval_level,
    v_next_level,
    null,
    v_notes,
    jsonb_build_object('transition_id', v_transition.id)
  );

  return query
  select v_claim.id, v_next_status, v_next_level;
end;
$$;

grant execute on function public.resubmit_claim_after_rejection_atomic(uuid, text)
to authenticated;

delete from public.approval_history
where action = 'bypass_logged';

with ranked as (
  select
    h.id,
    h.claim_id,
    row_number() over (
      partition by h.claim_id
      order by h.acted_at desc, h.id desc
    ) as row_num,
    c.resubmission_count
  from public.approval_history h
  join public.expense_claims c on c.id = h.claim_id
  where h.action = 'resubmitted'
)
delete from public.approval_history h
using ranked r
where h.id = r.id
  and r.row_num > coalesce(r.resubmission_count, 0);

update public.claim_status_audit
set trigger_action = 'submitted'
where trigger_action = 'resubmitted'
  and from_status::text = 'submitted';
