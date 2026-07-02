-- Regression test for Finding 4 (2026-07-01 filter/display consistency audit):
-- get_pending_approval_scope_summary did not escape %/_ wildcards in
-- p_employee_name, unlike get_pending_approvals. get_pending_approval_scope_summary
-- no longer exists; this test pins the replacement
-- (get_pending_approvals_metrics, sourced from pending_approvals_filtered())
-- to escape correctly, matching get_pending_approvals_page.
begin;
set local search_path = public, extensions;

select plan(3);

-- Fixture: an approver, and a claim owner whose name contains a LITERAL
-- underscore ("Ankur_Test", mirroring the audit's real "Ankur_Hemant_Akre"
-- search that exposed this bug), reporting to the approver at level 1.
insert into work_locations (id, location_code, location_name)
values ('66666666-6666-6666-6666-666666666661', 'PGTAP_WL2', 'PGTAP Test Location 2');

insert into designations (id, designation_code, designation_name, hierarchy_level)
values
  ('77777777-7777-7777-7777-777777777771', 'PGTAP_APPR', 'PGTAP Approver Designation', 2),
  ('77777777-7777-7777-7777-777777777772', 'PGTAP_OWNR', 'PGTAP Owner Designation', 1);

insert into employees (id, employee_id, employee_name, employee_email, designation_id, employee_status_id)
values (
  '88888888-8888-8888-8888-888888888881', 'PGTAP0002', 'PGTAP Approver',
  'pgtap-approver@nxtwave.co.in', '77777777-7777-7777-7777-777777777771',
  (select id from employee_statuses limit 1)
);

insert into employees (id, employee_id, employee_name, employee_email, designation_id, employee_status_id, approval_employee_id_level_1)
values (
  '88888888-8888-8888-8888-888888888882', 'PGTAP0003', 'Ankur_Test Owner',
  'pgtap-owner@nxtwave.co.in', '77777777-7777-7777-7777-777777777772',
  (select id from employee_statuses limit 1),
  '88888888-8888-8888-8888-888888888881'
);

insert into expense_claims (id, employee_id, claim_number, claim_date, work_location_id, designation_id, status_id, total_amount, current_approval_level)
values (
  '99999999-9999-9999-9999-999999999991',
  '88888888-8888-8888-8888-888888888882',
  'PGTAP-CLAIM-0002',
  current_date,
  '66666666-6666-6666-6666-666666666661',
  '77777777-7777-7777-7777-777777777772',
  (select id from claim_statuses where approval_level = 1 and not is_rejection and not is_terminal and is_active limit 1),
  750.00,
  1
);

-- Simulate being logged in as the approver (current_user_email() reads this).
select set_config('request.jwt.claims', json_build_object('email', 'pgtap-approver@nxtwave.co.in')::text, true);

-- Assertion 1: searching the LITERAL name "Ankur_Test" (with the real
-- underscore) matches via the page RPC.
select is(
  (select count(*)::int from get_pending_approvals_page(
    10, null, null, 'desc', null, null, 'Ankur_Test', 'lte', null, null, null, null
  )),
  1,
  'get_pending_approvals_page matches the literal underscore in the search term'
);

-- Assertion 2: the metrics RPC agrees exactly (this is the bug: the old
-- unescaped summary RPC would over-match here via the wildcard-underscore).
select is(
  (select claim_count from get_pending_approvals_metrics(
    null, null, 'Ankur_Test', 'lte', null, null, null, null
  )),
  1,
  'get_pending_approvals_metrics matches exactly the same one row as the page RPC'
);

-- Assertion 3: replacing the underscore with an unrelated single character
-- ("AnkurXTest") must NOT match under a correctly-escaped search — proves the
-- escaping is real, not incidentally passing.
select is(
  (select claim_count from get_pending_approvals_metrics(
    null, null, 'AnkurXTest', 'lte', null, null, null, null
  )),
  0,
  'get_pending_approvals_metrics does not match when the underscore is replaced with a different literal character'
);

select * from finish();
rollback;
