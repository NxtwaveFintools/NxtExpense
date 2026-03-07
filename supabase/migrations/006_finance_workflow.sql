alter type public.designation_type add value if not exists 'Finance';

alter type public.claim_status add value if not exists 'finance_review';
alter type public.claim_status add value if not exists 'issued';
alter type public.claim_status add value if not exists 'finance_rejected';

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create type public.finance_action_type as enum (
  'issued',
  'finance_rejected'
);

create table public.finance_actions (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.expense_claims(id) on delete cascade,
  actor_email text not null,
  action public.finance_action_type not null,
  notes text,
  acted_at timestamptz not null default now()
);

create index idx_finance_actions_claim_id
  on public.finance_actions (claim_id);

create index idx_finance_actions_actor_email
  on public.finance_actions (actor_email);

alter table public.finance_actions enable row level security;

create policy "finance or owner can read finance actions"
on public.finance_actions
for select
to authenticated
using (
  exists (
    select 1
    from public.expense_claims c
    join public.employees owner_emp on owner_emp.id = c.employee_id
    left join public.employees current_emp
      on lower(current_emp.employee_email) = public.current_user_email()
    where c.id = finance_actions.claim_id
      and (
        lower(owner_emp.employee_email) = public.current_user_email()
        or current_emp.designation::text = 'Finance'
      )
  )
);

create policy "finance can insert finance actions"
on public.finance_actions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.employees current_emp
    where lower(current_emp.employee_email) = public.current_user_email()
      and current_emp.designation::text = 'Finance'
      and lower(finance_actions.actor_email) = public.current_user_email()
  )
);
