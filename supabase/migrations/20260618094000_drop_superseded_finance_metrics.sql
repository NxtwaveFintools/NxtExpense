-- Phase 5a (Finance DB-side filtering) — drop superseded aggregation RPCs.
--
-- Both functions below were the pre-Phase-2 "fed a claim-ID array" aggregation
-- entry points. Phase 2 replaced them with resolver-backed equivalents that take
-- filter parameters directly and resolve the claim scope server-side:
--   get_claim_bucket_metrics            -> get_finance_queue_metrics
--   get_finance_history_action_metrics  -> get_finance_history_metrics
--
-- Verified zero callers before dropping (Phase 5 Task 5):
--   * No production code references either function.
--   * The only callers were the migration-only finance-analytics-parity test and
--     its RPC wrappers (getClaimBucketMetricsRpc / getFinanceHistoryActionMetricsRpc),
--     all removed in Phase 5a.
--   * get_claim_bucket_metrics has no non-finance caller (e.g. claims dashboard).

drop function if exists public.get_finance_history_action_metrics(
  uuid[], text, timestamptz, timestamptz, text[], text[], text[]
);

drop function if exists public.get_claim_bucket_metrics(
  uuid[], uuid[], uuid[], uuid[]
);
