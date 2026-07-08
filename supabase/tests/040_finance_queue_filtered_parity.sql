-- Regression guard for Finance Queue's canonical-filter consolidation. No
-- specific bug is being pinned here (none exists) — this asserts the general
-- invariant that get_finance_queue_page and get_finance_queue_count always
-- agree, for a future filter change to break loudly rather than silently.
begin;
set local search_path = public, extensions;

select plan(2);

insert into work_locations (id, location_code, location_name)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'PGTAP_WL4', 'PGTAP Test Location 4');

insert into designations (id, designation_code, designation_name, hierarchy_level)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'PGTAP_FQOWN', 'PGTAP Finance Queue Owner Designation', 1);

insert into employees (id, employee_id, employee_name, employee_email, designation_id, employee_status_id)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'PGTAP0005', 'PGTAP Finance Queue Employee',
  'pgtap-financequeue@nxtwave.co.in', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
  (select id from employee_statuses limit 1)
);

insert into expense_claims (id, employee_id, claim_number, claim_date, work_location_id, designation_id, status_id, total_amount)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
  'PGTAP-CLAIM-0005',
  current_date,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
  (select id from claim_statuses where approval_level = 3 and not is_rejection and not is_terminal and not is_approval and is_active limit 1),
  400.00
);

-- Assertion 1: filtered page row count matches filtered count RPC, for a
-- filter that actually narrows (employee_name substring matching the fixture).
select is(
  (select count(*)::int from get_finance_queue_page(
    (select id from claim_statuses where approval_level = 3 and not is_rejection and not is_terminal and not is_approval and is_active limit 1),
    true, null, 'PGTAP Finance Queue', null, null, null, null, null, null, 'claim_date', null, null, null, null, 10
  )),
  (select get_finance_queue_count(
    (select id from claim_statuses where approval_level = 3 and not is_rejection and not is_terminal and not is_approval and is_active limit 1),
    true, null, 'PGTAP Finance Queue', null, null, null, null, null, null, 'claim_date', null, null
  ))::int,
  'get_finance_queue_page row count matches get_finance_queue_count for an identical filter'
);

-- Assertion 2: the fixture claim is found by name search — proves the filter
-- actually narrows rather than trivially matching everything.
select is(
  (select count(*)::int from get_finance_queue_page(
    (select id from claim_statuses where approval_level = 3 and not is_rejection and not is_terminal and not is_approval and is_active limit 1),
    true, null, 'PGTAP Finance Queue', null, null, null, null, null, null, 'claim_date', null, null, null, null, 10
  )),
  1,
  'the employee_name filter finds exactly the one fixture claim'
);

select * from finish();
rollback;
