create or replace function public.submit_approval_action_atomic(
  p_claim_id uuid,
  p_action public.approval_action_type,
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
  v_claim public.expense_claims%rowtype;
  v_owner public.employees%rowtype;
  v_level int;
  v_next_level int;
  v_next_status public.claim_status;
begin
  v_email := public.current_user_email();

  if coalesce(v_email, '') = '' then
    raise exception 'Unauthorized request.';
  end if;

  select *
  into v_claim
  from public.expense_claims
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'Claim not found.';
  end if;

  if v_claim.status::text <> 'pending_approval' then
    raise exception 'Claim is not in pending approval state.';
  end if;

  select *
  into v_owner
  from public.employees
  where id = v_claim.employee_id;

  if not found then
    raise exception 'Claim owner record not found.';
  end if;

  v_level := null;

  if lower(coalesce(v_owner.approval_email_level_1, '')) = v_email then
    v_level := 1;
  elsif lower(coalesce(v_owner.approval_email_level_2, '')) = v_email then
    v_level := 2;
  elsif lower(coalesce(v_owner.approval_email_level_3, '')) = v_email then
    v_level := 3;
  end if;

  if v_level is null then
    raise exception 'You are not authorized to act on this claim.';
  end if;

  if v_claim.current_approval_level is distinct from v_level then
    raise exception 'You are not authorized to act on this claim at the current level.';
  end if;

  insert into public.approval_history (
    claim_id,
    approver_email,
    approval_level,
    action,
    notes
  )
  values (
    v_claim.id,
    v_email,
    v_level,
    p_action,
    nullif(trim(coalesce(p_notes, '')), '')
  );

  if p_action::text = 'rejected' then
    v_next_level := null;
    v_next_status := 'rejected'::public.claim_status;
  else
    if v_level = 1 then
      if v_owner.approval_email_level_2 is not null then
        v_next_level := 2;
      elsif v_owner.approval_email_level_3 is not null then
        v_next_level := 3;
      else
        v_next_level := null;
      end if;
    elsif v_level = 2 then
      if v_owner.approval_email_level_3 is not null then
        v_next_level := 3;
      else
        v_next_level := null;
      end if;
    else
      v_next_level := null;
    end if;

    if v_next_level is null then
      v_next_status := 'finance_review'::public.claim_status;
    else
      v_next_status := 'pending_approval'::public.claim_status;
    end if;
  end if;

  update public.expense_claims
  set status = v_next_status,
      current_approval_level = v_next_level,
      updated_at = now()
  where id = v_claim.id;

  return query
  select v_claim.id, v_next_status, v_next_level;
end;
$$;

grant execute on function public.submit_approval_action_atomic(uuid, public.approval_action_type, text)
to authenticated;

drop policy if exists "finance can read finance claims" on public.expense_claims;
create policy "finance can read finance claims"
on public.expense_claims
for select
to authenticated
using (
  exists (
    select 1
    from public.employees current_emp
    where lower(current_emp.employee_email) = public.current_user_email()
      and current_emp.designation::text = 'Finance'
  )
  and status::text in ('finance_review', 'issued', 'finance_rejected')
);

drop policy if exists "finance can update finance review claims" on public.expense_claims;
create policy "finance can update finance review claims"
on public.expense_claims
for update
to authenticated
using (
  exists (
    select 1
    from public.employees current_emp
    where lower(current_emp.employee_email) = public.current_user_email()
      and current_emp.designation::text = 'Finance'
  )
  and status::text = 'finance_review'
)
with check (
  exists (
    select 1
    from public.employees current_emp
    where lower(current_emp.employee_email) = public.current_user_email()
      and current_emp.designation::text = 'Finance'
  )
  and status::text in ('issued', 'finance_rejected')
  and current_approval_level is null
);
