-- Phase 3b: list page RPC plan probes. Inspect for pathological plans on the hot
-- paths. Acceptance (performance, informational): first-page and middle-page keyset
-- reads use idx_expense_claims_created_at_id / idx_finance_actions_acted_at_id and
-- do NOT sort the whole relation. Any unexpected scan on a large relation
-- (expense_claims, finance_actions) must be investigated + justified in the PR.
-- Run against a DB with the Phase 3 migrations applied.

-- =====================================================================
-- Queue page RPC
-- =====================================================================

-- Queue page: no filters (fast path), first page.
explain (analyze, buffers)
select * from public.get_finance_queue_page(
  (select id from claim_statuses where approval_level=3 and is_approval=false
     and is_rejection=false and is_terminal=false and is_active limit 1),
  p_has_filters => false, p_limit => 10);

-- Queue page: filters active (wide payment_released window), first page.
explain (analyze, buffers)
select * from public.get_finance_queue_page(
  (select id from claim_statuses where approval_level=3 and is_approval=false
     and is_rejection=false and is_terminal=false and is_active limit 1),
  p_has_filters => true, p_date_field => 'payment_released_date',
  p_date_from => '2025-09-01T00:00:00+05:30', p_date_to => '2026-05-31T23:59:59.999+05:30',
  p_limit => 10);

-- Queue page: a MIDDLE page (cursor set) — proves keyset paging stays index-driven.
explain (analyze, buffers)
select * from public.get_finance_queue_page(
  (select id from claim_statuses where approval_level=3 and is_approval=false
     and is_rejection=false and is_terminal=false and is_active limit 1),
  p_has_filters => false,
  p_cursor_created_at => (select created_at from expense_claims order by created_at desc, id desc offset 50 limit 1),
  p_cursor_id => (select id from expense_claims order by created_at desc, id desc offset 50 limit 1),
  p_limit => 10);

-- =====================================================================
-- History page RPC (same 3 shapes: no filters, filtered, middle cursor)
-- =====================================================================

-- History page: no filters, first page.
explain (analyze, buffers)
select * from public.get_finance_history_page(p_limit => 10);

-- History page: action-filter active (rejected feed codes), first page.
explain (analyze, buffers)
select * from public.get_finance_history_page(
  p_has_filters => true, p_action_filter => 'rejected_allow_reclaim',
  p_feed_action_codes => array['rejected','finance_rejected'], p_limit => 10);

-- History page: a MIDDLE page (cursor set) — proves keyset paging stays index-driven.
explain (analyze, buffers)
select * from public.get_finance_history_page(
  p_has_filters => false,
  p_cursor_acted_at => (select acted_at from finance_actions order by acted_at desc, id desc offset 50 limit 1),
  p_cursor_id => (select id from finance_actions order by acted_at desc, id desc offset 50 limit 1),
  p_limit => 10);

-- =====================================================================
-- Bounded total-count RPCs (added in Phase 3 for the list page counts)
-- =====================================================================

-- Queue count: no filters (counts finance-review claims) and filtered (counts resolver set).
explain (analyze, buffers)
select public.get_finance_queue_count(
  (select id from claim_statuses where approval_level=3 and is_approval=false
     and is_rejection=false and is_terminal=false and is_active limit 1),
  p_has_filters => false);

explain (analyze, buffers)
select public.get_finance_queue_count(
  (select id from claim_statuses where approval_level=3 and is_approval=false
     and is_rejection=false and is_terminal=false and is_active limit 1),
  p_has_filters => true, p_date_field => 'payment_released_date',
  p_date_from => '2025-09-01T00:00:00+05:30', p_date_to => '2026-05-31T23:59:59.999+05:30');

-- History count: no filters (all finance_actions) and filtered (resolver-joined).
explain (analyze, buffers)
select public.get_finance_history_count(p_has_filters => false);

explain (analyze, buffers)
select public.get_finance_history_count(
  p_has_filters => true, p_action_filter => 'rejected_allow_reclaim');

-- =====================================================================
-- Findings (dev ibrvpangpuxiorspeffz, 2026-06-19 — INFORMATIONAL)
-- =====================================================================
-- Dataset: 2868 finance-review claims; 2609 finance_actions.
--
-- KEYSET PAGING IS INDEX-DRIVEN (no full-relation sort):
--   * queue first page (keyset, no CTE): Index Scan idx_expense_claims_created_at_id,
--     ~0.46 ms; status_id removes ~450 interleaved entries (sub-ms).
--   * queue middle-cursor page: Index Scan idx_expense_claims_created_at_id, ~0.59 ms.
--   * history first / middle page: Index Scan idx_finance_actions_acted_at_id,
--     ~0.10 ms / ~0.28 ms.
--
-- p_has_filters GATE CONFIRMED: with the filter branch false there is NO
--   Function Scan on finance_filtered_claim_ids in the plan — the resolver does
--   not execute on the no-filter path (pruned by one-time filter).
--
-- NO-FILTER PAGE via the function body: base CTE bitmap-scans all status rows
--   (idx_expense_claims_status_allow_resubmit) then a BOUNDED top-N heapsort
--   (26 kB) -> ~4-6.5 ms. The CTE+union-all blocks limit pushdown into the
--   created_at_id index, so it does NOT use the ~0.5 ms pure-keyset fast path.
--   Bounded + cheap at this scale; NOT pathological. No index can fix it (query
--   structure). Candidate future optimization if the finance-review backlog grows
--   very large: restructure so the no-filter branch keyset-scans the index directly.
--
-- FILTERED PAGE (claim_date wide, 598 rows): Hash Join (bitmap status scan ⋈
--   resolver Function Scan) + bounded top-N heapsort, ~22 ms — dominated by the
--   resolver (~19 ms, a Phase 1 concern), not the Phase 3 wrapper.
--
-- CONCLUSION: no pathological plans on hot paths; keyset reads stay index-driven;
--   no unexpected large-relation seq scans (only the 2-row claim_statuses lookup).
--   NO NEW INDEX JUSTIFIED by these probes.
