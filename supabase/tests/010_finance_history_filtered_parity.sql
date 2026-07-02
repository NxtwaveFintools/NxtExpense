-- Regression test for Finding 1 (2026-07-01 filter/display consistency audit):
-- get_finance_history_count used to ignore p_action_filter entirely, counting
-- ALL finance_actions of matched claims instead of only the filtered action
-- type. get_finance_history_count no longer exists; this test pins the
-- replacement (get_finance_history_metrics, sourced from
-- finance_history_filtered()) to the correct behavior so this bug class
-- cannot silently reappear.
--
-- Fixture columns/constraints verified live against the dev schema
-- (information_schema.columns, NOT NULL check) during planning — see
-- docs/superpowers/plans/2026-07-02-finance-history-dropdown-and-canonical-filter-plan.md,
-- Task 5.
begin;
set local search_path = public, extensions;

select plan(3);

-- Fixture: one work location, one designation, one status, one employee, one
-- claim with TWO finance actions of different types (finance_approved and
-- payment_released) — the exact shape Finding 1 got wrong: the old count
-- summed BOTH actions regardless of which action type was requested.
insert into work_locations (id, location_code, location_name)
values ('11111111-1111-1111-1111-111111111111', 'PGTAP_WL', 'PGTAP Test Location');

insert into designations (id, designation_code, designation_name, hierarchy_level)
values ('22222222-2222-2222-2222-222222222222', 'PGTAP_DESIG', 'PGTAP Test Designation', 1);

select id as v_status_id from claim_statuses
where is_approval and not is_rejection and not is_terminal
  and not is_payment_issued and approval_level is null and is_active
limit 1 \gset

select id as v_employee_status_id from employee_statuses limit 1 \gset

insert into employees (id, employee_id, employee_name, employee_email, designation_id, employee_status_id)
values (
  '33333333-3333-3333-3333-333333333333', 'PGTAP0001', 'PGTAP Test Employee',
  'pgtap-test@nxtwave.co.in', '22222222-2222-2222-2222-222222222222',
  :'v_employee_status_id'
);

insert into expense_claims (id, employee_id, claim_number, claim_date, work_location_id, designation_id, status_id, total_amount)
values (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  'PGTAP-CLAIM-0001',
  current_date,
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  :'v_status_id',
  500.00
);

insert into finance_actions (id, claim_id, action, acted_at, actor_employee_id)
values
  ('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444444', 'finance_approved', now() - interval '2 hours', '33333333-3333-3333-3333-333333333333'),
  ('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444444', 'payment_released', now() - interval '1 hour', '33333333-3333-3333-3333-333333333333');

-- Assertion 1: filtering to 'finance_approved' returns exactly ONE matching
-- action for this claim, not both of its actions (the exact Finding-1 bug).
select is(
  (select total_count from get_finance_history_metrics(
    true, null, null, null, null, null, null,
    '11111111-1111-1111-1111-111111111111', 'finance_approved', 'claim_date', null, null
  )),
  1,
  'metrics.total_count for action_filter=finance_approved counts only matching actions, not every action of the matched claim'
);

-- Assertion 2: filtering to 'payment_released' on the SAME claim also returns
-- exactly one — proves the two action types are distinguished, not summed.
select is(
  (select total_count from get_finance_history_metrics(
    true, null, null, null, null, null, null,
    '11111111-1111-1111-1111-111111111111', 'payment_released', 'claim_date', null, null
  )),
  1,
  'metrics.total_count for action_filter=payment_released counts only matching actions'
);

-- Assertion 3: get_finance_history_page's row count for the same filter
-- matches metrics.total_count exactly (INV-1) — structurally guaranteed since
-- both read finance_history_filtered(), but asserted directly as a
-- regression pin, not just trusted from the architecture.
select is(
  (select count(*)::int from get_finance_history_page(
    true, null, null, null, null, null, null,
    '11111111-1111-1111-1111-111111111111', 'finance_approved', 'claim_date', null, null,
    null, null, 10
  )),
  (select total_count from get_finance_history_metrics(
    true, null, null, null, null, null, null,
    '11111111-1111-1111-1111-111111111111', 'finance_approved', 'claim_date', null, null
  )),
  'page row count and metrics total_count agree for an identical filter'
);

select * from finish();
rollback;
