drop policy if exists "owner and approvers can read claims" on public.expense_claims;

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
        lower(coalesce(owner_emp.approval_email_level_1, '')) = public.current_user_email()
        or lower(coalesce(owner_emp.approval_email_level_2, '')) = public.current_user_email()
        or lower(coalesce(owner_emp.approval_email_level_3, '')) = public.current_user_email()
      )
  )
);
