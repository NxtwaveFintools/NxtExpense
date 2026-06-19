-- Phase 4b: EXPLAIN probes for the payment-journals export aggregation
-- (get_finance_payment_journal_totals). Informational — the hard release gate for
-- Phase 4 is the export PARITY gate (finance-export-parity.test.ts), not these timings.
--
-- Run after the migration is applied:
--   psql "$DATABASE_URL" -f scripts/finance-export-explain.sql
-- Acceptance: no pathological plans; the GROUP BY employee_id aggregates over the
-- resolver-scoped set without scanning all of finance_actions/expense_claims
-- unjustifiably. Any unexpected large-relation scan must be investigated + justified.

-- ── Probe A: wide payment_released window (p_has_filters via the date filter) ────────
explain (analyze, buffers)
select * from public.get_finance_payment_journal_totals(
  p_has_filters       => true,
  p_date_field        => 'payment_released_date',
  p_date_from         => '2025-09-01T00:00:00+05:30',
  p_date_to           => '2026-05-31T23:59:59.999+05:30',
  p_feed_action_codes => array['payment_released']::text[],
  p_feed_from         => '2025-09-01T00:00:00+05:30',
  p_feed_to           => '2026-05-31T23:59:59.999+05:30');

-- ── Probe B: no filters (resolver bypassed) ─────────────────────────────────────────
explain (analyze, buffers)
select * from public.get_finance_payment_journal_totals();

-- ── Probe C: plain action filter (p_has_filters=false, feed codes, no resolver) ──────
explain (analyze, buffers)
select * from public.get_finance_payment_journal_totals(
  p_has_filters       => false,
  p_action_filter     => 'finance_rejected',
  p_feed_action_codes => array['finance_rejected']::text[]);

-- ────────────────────────────────────────────────────────────────────────────────────
-- Recorded findings (dev ref ibrvpangpuxiorspeffz, ~17.5k claims / 2609 finance_actions,
-- 2026-06-19, measured on the inline-equivalent SQL since the function ships in this PR):
--
--   Probe B (no filters):  HashAggregate over 84 employee groups, Memory Usage 48kB,
--     Execution ~10.8ms. finance_actions read via Index Only Scan
--     (idx_finance_actions_claim_id); expense_claims is a seq scan (17.5k rows) hash-
--     joined down to the ~2.5k claims that have a finance_action — justified for the
--     no-filter shape (the export legitimately spans every acted-on claim). Bounded
--     aggregate memory; no pathological plan.
--
--   Probe A (payment_released wide):  Execution ~41ms, DOMINATED by the resolver
--     Function Scan on finance_filtered_claim_ids (~37ms) — the pre-existing Phase-1
--     resolver cost (see Phase 3b notes), NOT the aggregation. The aggregation tail is
--     cheap: Index Scan on idx_finance_actions_acted_at_id (638 rows) + pkey lookups on
--     expense_claims + HashAggregate (48kB). No index on this function can reduce the
--     resolver cost.
--
-- Index decision: NO NEW INDEX. The aggregate's own access paths are already index-
-- driven (claim_id / acted_at_id / pkey); the only material cost is the shared resolver,
-- which is out of scope for Phase 4. HashAggregate memory is bounded by employee count
-- (48kB), satisfying the Phase-4 bounded-memory invariant on the DB side.
--
-- Memory validation (Phase 4b Step 4): the payment-journals route holds only the
-- per-employee Map returned by getFinancePaymentJournalTotals (bounded by employee
-- count); bc-expense streams one get_finance_history_page page at a time (bounded by
-- page size). No export path materializes a claim-count-sized collection.
