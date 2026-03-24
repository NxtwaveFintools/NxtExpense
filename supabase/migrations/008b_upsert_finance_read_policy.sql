-- #region agent log
do $$
begin
  raise notice '[agent-log][session=0c4042][hypothesis=H2] entering 008b_upsert_finance_read_policy';
  drop policy if exists "finance can read finance claims" on public.expense_claims;
  execute $policy$
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
    )
  $policy$;
end;
$$;
-- #endregion
