BEGIN;

create index if not exists idx_approval_history_acted_at_id
  on public.approval_history (acted_at desc, id desc);

create index if not exists idx_claim_status_audit_claim_scope_trigger_changed_at
  on public.claim_status_audit (claim_id, actor_scope, trigger_action, changed_at desc);

create index if not exists idx_claim_status_audit_claim_to_status_changed_at
  on public.claim_status_audit (claim_id, to_status, changed_at desc);

create index if not exists idx_claim_status_audit_actor_email
  on public.claim_status_audit (actor_email);

create index if not exists idx_employees_employee_name
  on public.employees (employee_name);

create or replace function public.get_filtered_approval_history(
  p_limit int default 10,
  p_cursor_acted_at timestamptz default null,
  p_cursor_action_id uuid default null,
  p_name_search text default null,
  p_actor_filters text[] default null,
  p_claim_date_from date default null,
  p_claim_date_to date default null,
  p_hod_approved_from timestamptz default null,
  p_hod_approved_to timestamptz default null,
  p_finance_approved_from timestamptz default null,
  p_finance_approved_to timestamptz default null
)
returns table (
  action_id uuid,
  claim_id uuid,
  claim_number text,
  claim_date date,
  work_location public.work_location_type,
  total_amount numeric,
  claim_status public.claim_status,
  owner_name text,
  owner_designation public.designation_type,
  actor_email text,
  actor_designation public.designation_type,
  action public.approval_action_type,
  approval_level int,
  notes text,
  acted_at timestamptz,
  hod_approved_at timestamptz,
  finance_approved_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    ah.id as action_id,
    ah.claim_id,
    c.claim_number,
    c.claim_date,
    c.work_location,
    c.total_amount,
    c.status as claim_status,
    owner_emp.employee_name as owner_name,
    owner_emp.designation as owner_designation,
    lower(ah.approver_email) as actor_email,
    actor_emp.designation as actor_designation,
    ah.action,
    ah.approval_level,
    ah.notes,
    ah.acted_at,
    hod_event.hod_approved_at,
    finance_event.finance_approved_at
  from public.approval_history ah
  join public.expense_claims c
    on c.id = ah.claim_id
  join public.employees owner_emp
    on owner_emp.id = c.employee_id
  left join public.employees actor_emp
    on lower(actor_emp.employee_email) = lower(ah.approver_email)
  left join lateral (
    select a.changed_at as hod_approved_at
    from public.claim_status_audit a
    where a.claim_id = c.id
      and a.actor_scope = 'approver'
      and a.trigger_action = 'approved'
      and a.to_status = 'finance_review'
    order by a.changed_at desc
    limit 1
  ) hod_event on true
  left join lateral (
    select a.changed_at as finance_approved_at
    from public.claim_status_audit a
    where a.claim_id = c.id
      and a.actor_scope = 'finance'
      and a.trigger_action = 'issued'
    order by a.changed_at desc
    limit 1
  ) finance_event on true
  where (
      p_name_search is null
      or trim(p_name_search) = ''
      or owner_emp.employee_name ilike ('%' || trim(p_name_search) || '%')
    )
    and (p_claim_date_from is null or c.claim_date >= p_claim_date_from)
    and (p_claim_date_to is null or c.claim_date <= p_claim_date_to)
    and (
      p_hod_approved_from is null
      or hod_event.hod_approved_at >= p_hod_approved_from
    )
    and (
      p_hod_approved_to is null
      or hod_event.hod_approved_at <= p_hod_approved_to
    )
    and (
      p_finance_approved_from is null
      or finance_event.finance_approved_at >= p_finance_approved_from
    )
    and (
      p_finance_approved_to is null
      or finance_event.finance_approved_at <= p_finance_approved_to
    )
    and (
      p_actor_filters is null
      or cardinality(p_actor_filters) = 0
      or 'all' = any(p_actor_filters)
      or (
        ('sbh' = any(p_actor_filters)
          and actor_emp.designation = 'State Business Head')
        or (
          'finance' = any(p_actor_filters)
          and actor_emp.designation = 'Finance'
        )
        or (
          'hod' = any(p_actor_filters)
          and exists (
            select 1
            from public.claim_status_audit hod_audit
            where hod_audit.claim_id = ah.claim_id
              and lower(hod_audit.actor_email) = lower(ah.approver_email)
              and hod_audit.actor_scope = 'approver'
              and hod_audit.trigger_action = 'approved'
              and hod_audit.to_status = 'finance_review'
          )
        )
      )
    )
    and (
      p_cursor_acted_at is null
      or p_cursor_action_id is null
      or ah.acted_at < p_cursor_acted_at
      or (
        ah.acted_at = p_cursor_acted_at
        and ah.id < p_cursor_action_id
      )
    )
  order by ah.acted_at desc, ah.id desc
  limit greatest(coalesce(p_limit, 10), 1) + 1;
$$;

COMMIT;

