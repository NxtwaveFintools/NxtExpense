-- Regression test for Finding 3 (2026-07-01 filter/display consistency audit):
-- get_employee_claim_metrics(p_employee_id) took no filter params at all, so
-- the /claims page's KPI cards never reflected the active filter while the
-- list and pagination total (both already correctly filtered) did. This test
-- pins get_my_claims_metrics to actually respond to a status filter.
begin;
set local search_path = public, extensions;

select plan(3);

insert into work_locations (id, location_code, location_name)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'PGTAP_WL3', 'PGTAP Test Location 3');

insert into designations (id, designation_code, designation_name, hierarchy_level)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'PGTAP_CLMOWN', 'PGTAP Claim Owner Designation', 1);

insert into employees (id, employee_id, employee_name, employee_email, designation_id, employee_status_id)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'PGTAP0004', 'PGTAP Claims Employee',
  'pgtap-claims@nxtwave.co.in', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  (select id from employee_statuses limit 1)
);

-- Two claims for the SAME employee, DIFFERENT statuses: one pending
-- (approval_level not null, not rejection/payment-issued), one rejected.
insert into expense_claims (id, employee_id, claim_number, claim_date, work_location_id, designation_id, status_id, total_amount)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  'PGTAP-CLAIM-0003',
  current_date,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  (select id from claim_statuses where approval_level = 1 and not is_rejection and not is_terminal and is_active limit 1),
  200.00
);

-- Different claim_date: expense_claims_one_active_per_employee_date is a
-- unique index on (employee_id, claim_date) WHERE NOT is_superseded — two
-- non-superseded claims for the same employee cannot share a claim_date.
insert into expense_claims (id, employee_id, claim_number, claim_date, work_location_id, designation_id, status_id, total_amount)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  'PGTAP-CLAIM-0004',
  current_date - 1,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  (select id from claim_statuses where is_rejection and is_active limit 1),
  300.00
);

-- Assertion 1: unfiltered metrics count both claims.
select is(
  (select total_count from get_my_claims_metrics('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', null, null, null, null, null)),
  2,
  'unfiltered get_my_claims_metrics counts both claims'
);

-- Assertion 2: filtering to the pending claim's exact status_id narrows
-- metrics to 1 — the exact symptom Finding 3 describes (cards must move).
select is(
  (select total_count from get_my_claims_metrics(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    (select status_id from expense_claims where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'),
    null, null, null, null
  )),
  1,
  'get_my_claims_metrics narrows to 1 when filtered to the pending claim''s status — cards now respond to the filter'
);

-- Assertion 3: page row count for the identical filter matches metrics
-- total_count (INV-1) — asserted directly, not just trusted from architecture.
select is(
  (select count(*)::int from get_my_claims_page(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    (select status_id from expense_claims where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'),
    null, null, null, null, null, null, 10
  )),
  (select total_count from get_my_claims_metrics(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    (select status_id from expense_claims where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'),
    null, null, null, null
  )),
  'page row count and metrics total_count agree for an identical filter'
);

select * from finish();
rollback;
