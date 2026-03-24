BEGIN;

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


update public.expense_claims c
set resubmission_count = coalesce(
  (
    select count(*)::int
    from public.claim_status_audit a
    where a.claim_id = c.id
      and a.trigger_action = 'resubmitted'
      and a.from_status::text = 'returned_for_modification'
  ),
  0
);

COMMIT;
