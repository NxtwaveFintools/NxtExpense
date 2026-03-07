create or replace function public.resolve_next_approval_level(
  p_owner public.employees,
  p_current_level int,
  p_mode public.claim_next_level_mode
)
returns int
language plpgsql
stable
set search_path = public
as $$
declare
  v_level int;
begin
  if p_mode = 'clear' then
    return null;
  end if;

  if p_mode = 'retain' then
    return p_current_level;
  end if;

  if p_mode = 'reset_first_configured' then
    if p_owner.approval_email_level_1 is not null then
      return 1;
    end if;
    if p_owner.approval_email_level_2 is not null then
      return 2;
    end if;
    if p_owner.approval_email_level_3 is not null then
      return 3;
    end if;
    return null;
  end if;

  if p_current_level is null then
    return null;
  end if;

  v_level := null;

  if p_current_level < 2 and p_owner.approval_email_level_2 is not null then
    v_level := 2;
  elsif p_current_level < 3 and p_owner.approval_email_level_3 is not null then
    v_level := 3;
  end if;

  return v_level;
end;
$$;

create or replace function public.log_claim_status_audit(
  p_claim_id uuid,
  p_actor_email text,
  p_actor_scope public.claim_actor_scope,
  p_trigger_action text,
  p_from_status public.claim_status,
  p_to_status public.claim_status,
  p_from_approval_level int,
  p_to_approval_level int,
  p_allow_resubmit boolean,
  p_notes text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.claim_status_audit (
    claim_id,
    actor_email,
    actor_scope,
    trigger_action,
    from_status,
    to_status,
    from_approval_level,
    to_approval_level,
    allow_resubmit,
    notes,
    metadata
  )
  values (
    p_claim_id,
    lower(p_actor_email),
    p_actor_scope,
    p_trigger_action,
    p_from_status,
    p_to_status,
    p_from_approval_level,
    p_to_approval_level,
    p_allow_resubmit,
    p_notes,
    coalesce(p_metadata, '{}'::jsonb)
  );
$$;

insert into public.claim_status_catalog (
  status,
  display_label,
  is_terminal,
  sort_order,
  color_token,
  description
)
values
  ('draft', 'Draft', false, 10, 'slate', 'Claim created but not submitted.'),
  ('submitted', 'Submitted', false, 20, 'blue', 'Submitted and awaiting processing.'),
  ('pending_approval', 'Pending Approval', false, 30, 'amber', 'Waiting for approval action.'),
  ('returned_for_modification', 'Returned for Modification', false, 35, 'orange', 'Returned to employee with notes for correction.'),
  ('approved', 'Approved', false, 40, 'emerald', 'Approval completed.'),
  ('rejected', 'Rejected', true, 50, 'red', 'Final rejection by approver.'),
  ('finance_review', 'Finance Review', false, 60, 'indigo', 'Waiting for finance action.'),
  ('issued', 'Issued', true, 70, 'teal', 'Payment issued by finance.'),
  ('finance_rejected', 'Finance Rejected', true, 80, 'rose', 'Final rejection by finance.')
on conflict (status)
do update set
  display_label = excluded.display_label,
  is_terminal = excluded.is_terminal,
  sort_order = excluded.sort_order,
  color_token = excluded.color_token,
  description = excluded.description;

delete from public.claim_transition_graph
where tenant_id = 'default';

insert into public.claim_transition_graph (
  tenant_id,
  from_status,
  to_status,
  to_status_when_no_next,
  trigger_action,
  action_label,
  actor_scope,
  allowed_approver_levels,
  require_notes,
  allow_resubmit,
  next_level_mode,
  bypass_reason_template,
  metadata
)
values
  ('default', 'pending_approval', 'pending_approval', 'finance_review', 'approved', 'Approve', 'approver', '{1}', false, null, 'next_configured', 'Intermediate approver level is not configured for this employee.', '{"route":"approver"}'),
  ('default', 'pending_approval', 'pending_approval', 'finance_review', 'approved', 'Approve', 'approver', '{2}', false, null, 'next_configured', 'Intermediate approver level is not configured for this employee.', '{"route":"approver"}'),
  ('default', 'pending_approval', 'finance_review', null, 'approved', 'Approve', 'approver', '{3}', false, null, 'clear', null, '{"route":"approver"}'),
  ('default', 'pending_approval', 'rejected', null, 'rejected', 'Reject', 'approver', '{1,2,3}', true, false, 'clear', null, '{"route":"approver"}'),
  ('default', 'pending_approval', 'returned_for_modification', null, 'rejected', 'Reject', 'approver', '{1,2,3}', true, true, 'clear', null, '{"route":"approver"}'),
  ('default', 'submitted', 'pending_approval', 'finance_review', 'resubmitted', 'Submit Claim', 'employee', null, false, null, 'reset_first_configured', null, '{"route":"employee"}'),
  ('default', 'returned_for_modification', 'pending_approval', 'finance_review', 'resubmitted', 'Resubmit', 'employee', null, false, null, 'reset_first_configured', null, '{"route":"employee"}'),
  ('default', 'finance_review', 'issued', null, 'issued', 'Issue', 'finance', null, false, null, 'clear', null, '{"route":"finance"}'),
  ('default', 'finance_review', 'finance_rejected', null, 'finance_rejected', 'Reject', 'finance', null, true, false, 'clear', null, '{"route":"finance"}'),
  ('default', 'finance_review', 'returned_for_modification', null, 'finance_rejected', 'Reject', 'finance', null, true, true, 'clear', null, '{"route":"finance"}'),
  ('default', 'issued', 'finance_review', null, 'reopened', 'Reopen Claim', 'finance', null, true, null, 'clear', null, '{"route":"finance"}'),
  ('default', 'issued', 'finance_review', null, 'admin_override', 'Admin Rollback', 'admin', null, true, null, 'clear', null, '{"route":"admin"}'),
  ('default', 'finance_rejected', 'finance_review', null, 'admin_override', 'Admin Rollback', 'admin', null, true, null, 'clear', null, '{"route":"admin"}'),
  ('default', 'rejected', 'pending_approval', 'finance_review', 'admin_override', 'Admin Rollback', 'admin', null, true, null, 'reset_first_configured', null, '{"route":"admin"}'),
  ('default', 'returned_for_modification', 'pending_approval', 'finance_review', 'admin_override', 'Admin Rollback', 'admin', null, true, null, 'reset_first_configured', null, '{"route":"admin"}'),
  ('default', 'finance_review', 'pending_approval', 'finance_review', 'admin_override', 'Admin Rollback', 'admin', null, true, null, 'reset_first_configured', null, '{"route":"admin"}');

drop function if exists public.submit_approval_action_atomic(uuid, public.approval_action_type, text);

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
  v_skipped_levels int[];
  v_bypass_reason text;
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

  v_skipped_levels := array[]::int[];
  if p_action::text = 'approved' then
    if v_level = 1 and v_owner.approval_email_level_2 is null and (v_next_level is null or v_next_level > 2) then
      v_skipped_levels := array_append(v_skipped_levels, 2);
    end if;

    if v_level <= 2 and v_owner.approval_email_level_3 is null and v_next_level is null then
      v_skipped_levels := array_append(v_skipped_levels, 3);
    end if;
  end if;

  if coalesce(array_length(v_skipped_levels, 1), 0) > 0 then
    v_bypass_reason := coalesce(
      v_transition.bypass_reason_template,
      'Approver level is not configured for this employee.'
    );

    insert into public.approval_history (
      claim_id,
      approver_email,
      approval_level,
      action,
      notes,
      bypass_reason,
      skipped_levels,
      metadata
    )
    values (
      v_claim.id,
      v_email,
      v_level,
      'bypass_logged',
      v_bypass_reason,
      v_bypass_reason,
      to_jsonb(v_skipped_levels),
      jsonb_build_object('triggering_action', p_action::text)
    );
  end if;

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
  v_skipped_levels int[];
  v_bypass_reason text;
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

  select *
  into v_owner
  from public.employees
  where id = v_claim.employee_id;

  select *
  into v_transition
  from public.claim_transition_graph t
  where t.tenant_id = v_claim.tenant_id
    and t.from_status = v_claim.status
    and t.trigger_action = 'resubmitted'
    and t.actor_scope = 'employee'
    and t.is_active = true
  order by t.created_at desc
  limit 1;

  if not found then
    raise exception 'No transition configured for claim resubmission.';
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
        when v_claim.status::text = 'returned_for_modification' then resubmission_count + 1
        else resubmission_count
      end,
      updated_at = now()
  where id = v_claim.id;

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

  v_skipped_levels := array[]::int[];

  if v_next_level = 2 and v_owner.approval_email_level_1 is null then
    v_skipped_levels := array_append(v_skipped_levels, 1);
  elsif v_next_level = 3 then
    if v_owner.approval_email_level_1 is null then
      v_skipped_levels := array_append(v_skipped_levels, 1);
    end if;
    if v_owner.approval_email_level_2 is null then
      v_skipped_levels := array_append(v_skipped_levels, 2);
    end if;
  end if;

  if coalesce(array_length(v_skipped_levels, 1), 0) > 0 then
    v_bypass_reason := 'Approver level is not configured for this employee.';

    insert into public.approval_history (
      claim_id,
      approver_email,
      approval_level,
      action,
      notes,
      bypass_reason,
      skipped_levels,
      metadata
    )
    values (
      v_claim.id,
      v_email,
      null,
      'bypass_logged',
      v_bypass_reason,
      v_bypass_reason,
      to_jsonb(v_skipped_levels),
      jsonb_build_object('triggering_action', 'resubmitted')
    );
  end if;

  perform public.log_claim_status_audit(
    v_claim.id,
    v_email,
    'employee',
    'resubmitted',
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
