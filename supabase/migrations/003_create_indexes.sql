create index idx_employees_employee_email
  on public.employees (employee_email);

create index idx_expense_claims_employee_id
  on public.expense_claims (employee_id);

create index idx_expense_claims_claim_date
  on public.expense_claims (claim_date);

create index idx_expense_claims_status_created_at_id
  on public.expense_claims (status, created_at desc, id desc);

create index idx_expense_claims_approval_level
  on public.expense_claims (current_approval_level);

create index idx_expense_claim_items_claim_id
  on public.expense_claim_items (claim_id);

create index idx_approval_history_claim_id
  on public.approval_history (claim_id);

create index idx_approval_history_approver_email
  on public.approval_history (approver_email);
