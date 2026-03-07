alter table public.employees enable row level security;
alter table public.expense_reimbursement_rates enable row level security;
alter table public.expense_claims enable row level security;
alter table public.expense_claim_items enable row level security;
alter table public.approval_history enable row level security;

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create policy "authenticated users can read employees"
on public.employees
for select
to authenticated
using (true);

create policy "authenticated users can read rates"
on public.expense_reimbursement_rates
for select
to authenticated
using (true);

create policy "employee inserts own claim"
on public.expense_claims
for insert
to authenticated
with check (
  employee_id = (
    select e.id
    from public.employees e
    where lower(e.employee_email) = public.current_user_email()
  )
);

create policy "owner and approvers can read claims"
on public.expense_claims
for select
to authenticated
using (
  employee_id = (
    select e.id
    from public.employees e
    where lower(e.employee_email) = public.current_user_email()
  )
  or exists (
    select 1
    from public.employees owner_emp
    where owner_emp.id = expense_claims.employee_id
      and (
        (expense_claims.current_approval_level = 1 and lower(coalesce(owner_emp.approval_email_level_1, '')) = public.current_user_email())
        or (expense_claims.current_approval_level = 2 and lower(coalesce(owner_emp.approval_email_level_2, '')) = public.current_user_email())
        or (expense_claims.current_approval_level = 3 and lower(coalesce(owner_emp.approval_email_level_3, '')) = public.current_user_email())
      )
  )
);

create policy "owner and active approver can update claims"
on public.expense_claims
for update
to authenticated
using (
  employee_id = (
    select e.id
    from public.employees e
    where lower(e.employee_email) = public.current_user_email()
  )
  or exists (
    select 1
    from public.employees owner_emp
    where owner_emp.id = expense_claims.employee_id
      and (
        (expense_claims.current_approval_level = 1 and lower(coalesce(owner_emp.approval_email_level_1, '')) = public.current_user_email())
        or (expense_claims.current_approval_level = 2 and lower(coalesce(owner_emp.approval_email_level_2, '')) = public.current_user_email())
        or (expense_claims.current_approval_level = 3 and lower(coalesce(owner_emp.approval_email_level_3, '')) = public.current_user_email())
      )
  )
)
with check (true);

create policy "owner can insert claim items"
on public.expense_claim_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.expense_claims c
    join public.employees e on e.id = c.employee_id
    where c.id = expense_claim_items.claim_id
      and lower(e.employee_email) = public.current_user_email()
  )
);

create policy "owner and approvers can read claim items"
on public.expense_claim_items
for select
to authenticated
using (
  exists (
    select 1
    from public.expense_claims c
    join public.employees e on e.id = c.employee_id
    where c.id = expense_claim_items.claim_id
      and (
        lower(e.employee_email) = public.current_user_email()
        or lower(coalesce(e.approval_email_level_1, '')) = public.current_user_email()
        or lower(coalesce(e.approval_email_level_2, '')) = public.current_user_email()
        or lower(coalesce(e.approval_email_level_3, '')) = public.current_user_email()
      )
  )
);

create policy "owner and approvers can read approval history"
on public.approval_history
for select
to authenticated
using (
  exists (
    select 1
    from public.expense_claims c
    join public.employees e on e.id = c.employee_id
    where c.id = approval_history.claim_id
      and (
        lower(e.employee_email) = public.current_user_email()
        or lower(coalesce(e.approval_email_level_1, '')) = public.current_user_email()
        or lower(coalesce(e.approval_email_level_2, '')) = public.current_user_email()
        or lower(coalesce(e.approval_email_level_3, '')) = public.current_user_email()
      )
  )
);

create policy "active approver can insert approval history"
on public.approval_history
for insert
to authenticated
with check (
  exists (
    select 1
    from public.expense_claims c
    join public.employees e on e.id = c.employee_id
    where c.id = approval_history.claim_id
      and (
        (c.current_approval_level = 1 and lower(coalesce(e.approval_email_level_1, '')) = public.current_user_email())
        or (c.current_approval_level = 2 and lower(coalesce(e.approval_email_level_2, '')) = public.current_user_email())
        or (c.current_approval_level = 3 and lower(coalesce(e.approval_email_level_3, '')) = public.current_user_email())
      )
      and lower(approval_history.approver_email) = public.current_user_email()
  )
);
