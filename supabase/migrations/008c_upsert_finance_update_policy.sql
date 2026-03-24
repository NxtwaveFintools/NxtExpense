-- #region agent log
do $$
begin
  raise notice '[agent-log][session=0c4042][hypothesis=H3] entering 008c_upsert_finance_update_policy';
  drop policy if exists "finance can update finance review claims" on public.expense_claims;
  execute $policy$
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
    )
  $policy$;
end;
$$;
-- #endregion
