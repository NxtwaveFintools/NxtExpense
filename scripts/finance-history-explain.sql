-- Phase 6 performance probes for get_finance_history_page's hydrated rewrite.
-- See docs/superpowers/plans/2026-07-01-finance-history-single-rpc-hydration.md (Task 6).
--
-- NOTE: EXPLAIN on a top-level call to a `language sql` function shows an opaque
-- "Function Scan" — Postgres doesn't inline the body for a bare `select * from fn(...)`
-- call. To see the real join plan, EXPLAIN the function's inner query directly with
-- parameters substituted (probe 1 below). Probes 2-3 call the function directly —
-- useful for confirming row counts / timing, not plan shape.

-- Probe 1: no filters, first page at export chunk size (500) — the REAL join plan.
-- Confirms: (a) the `page` CTE's LIMIT executes BEFORE enrichment joins (the keyset
-- Index Scan producing exactly `limit+1` rows, with every downstream join then running
-- at `loops = limit+1`, never against the full table); (b) PK-based joins to large
-- tables (expense_claims, employees) use index scans; (c) small reference tables
-- (designations, work_locations, expense_locations, vehicle_types, claim_statuses —
-- all under ~120 rows) correctly use sequential scans, which is the OPTIMAL plan for
-- tables that size, not a red flag.
explain (analyze, buffers)
with base as (
  select fa.id, fa.claim_id, fa.acted_at, fa.action, fa.notes, fa.actor_employee_id
  from finance_actions fa
),
page as (
  select b.id, b.claim_id, b.acted_at, b.action, b.notes, b.actor_employee_id
  from base b
  order by acted_at desc, id desc
  limit 501
)
select
  p.id, p.claim_id, p.acted_at, p.action, p.notes,
  actor.employee_email, actor.employee_name,
  c.claim_number, c.employee_id, c.claim_date, wl.location_name, el.location_name, el.region_code,
  c.own_vehicle_used, vt.vehicle_name, c.total_amount, cs.status_code, cs.status_name,
  e.id, e.employee_id, e.employee_name, e.employee_email, d.designation_name
from page p
join expense_claims c on c.id = p.claim_id
join employees e on e.id = c.employee_id
left join designations d on d.id = e.designation_id
left join work_locations wl on wl.id = c.work_location_id
left join expense_locations el on el.id = c.expense_location_id
left join vehicle_types vt on vt.id = c.vehicle_type_id
left join claim_statuses cs on cs.id = c.status_id
left join employees actor on actor.id = p.actor_employee_id
order by p.acted_at desc, p.id desc;
-- Recorded 2026-07-01 (dev, ~2.9k finance_actions rows): Execution Time 5.169ms for
-- 501 rows. Limit node used idx_finance_actions_acted_at_id, rows=501 exactly (no
-- over-fetch). All enrichment joins ran at loops=501 (never the full table).

-- Probe 2: no filters, UI page size (10) — first page.
explain (analyze, buffers)
select * from public.get_finance_history_page(p_has_filters => false, p_limit => 10);
-- Recorded 2026-07-01: 11 rows, ~21ms (opaque Function Scan — see note above).

-- Probe 3: filtered (employee filter active) — confirms the resolver-join path
-- doesn't regress with the wider enrichment added.
explain (analyze, buffers)
select * from public.get_finance_history_page(
  p_has_filters => true, p_employee_id => 'NW0000282', p_limit => 10
);
-- Recorded 2026-07-01: 11 rows, ~20ms — same ballpark as the unfiltered case.

-- Acceptance (Phase 6): no pathological plans on the hot history-feed path; the page
-- CTE's LIMIT stays a genuine barrier (enrichment joins never scan more than
-- `limit + 1` rows); no unexpected scan on a large relation. All satisfied above — no
-- new index added as part of this phase.
