create or replace function public.bulk_finance_actions_atomic(
  p_claim_ids uuid[],
  p_action public.finance_action_type,
  p_notes text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_is_finance boolean;
  v_requested_count int;
  v_eligible_count int;
  v_updated_count int;
  v_next_status public.claim_status;
begin
  v_email := public.current_user_email();

  if coalesce(v_email, '') = '' then
    raise exception 'Unauthorized request.';
  end if;

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

  if p_claim_ids is null or coalesce(array_length(p_claim_ids, 1), 0) = 0 then
    raise exception 'At least one claim must be selected.';
  end if;

  v_next_status := case
    when p_action::text = 'issued' then 'issued'::public.claim_status
    else 'finance_rejected'::public.claim_status
  end;

  with requested as (
    select distinct unnest(p_claim_ids) as claim_id
  )
  select count(*) into v_requested_count from requested;

  with requested as (
    select distinct unnest(p_claim_ids) as claim_id
  ),
  eligible as (
    select c.id
    from public.expense_claims c
    join requested r on r.claim_id = c.id
    where c.status::text = 'finance_review'
    for update
  )
  select count(*) into v_eligible_count from eligible;

  if v_eligible_count <> v_requested_count then
    raise exception 'One or more selected claims are not available in finance review.';
  end if;

  with requested as (
    select distinct unnest(p_claim_ids) as claim_id
  )
  insert into public.finance_actions (
    claim_id,
    actor_email,
    action,
    notes
  )
  select
    r.claim_id,
    v_email,
    p_action,
    nullif(trim(coalesce(p_notes, '')), '')
  from requested r;

  with requested as (
    select distinct unnest(p_claim_ids) as claim_id
  )
  update public.expense_claims c
  set status = v_next_status,
      current_approval_level = null,
      updated_at = now()
  from requested r
  where c.id = r.claim_id;

  get diagnostics v_updated_count = row_count;

  return v_updated_count;
end;
$$;

grant execute on function public.bulk_finance_actions_atomic(uuid[], public.finance_action_type, text)
to authenticated;
