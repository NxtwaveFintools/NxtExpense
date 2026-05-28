-- Rollback for: 20260527170000_optimize_finance_bucket_metrics.sql
--
-- Restores get_claim_bucket_metrics to its original LANGUAGE sql form
-- and drops the covering index added by the migration.
--
-- NOTE: rolling back means the finance page will again be subject to
-- cold-buffer timeouts on the initial page load (full heap scan of
-- 17 494 expense_claims rows).  Only use this if the plpgsql version
-- has a correctness bug; re-apply 20260527170000 with the fix instead.


-- ── 1. Restore original function ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_claim_bucket_metrics(
  p_claim_ids           uuid[]  DEFAULT NULL::uuid[],
  p_pending_status_ids  uuid[]  DEFAULT NULL::uuid[],
  p_approved_status_ids uuid[]  DEFAULT NULL::uuid[],
  p_rejected_status_ids uuid[]  DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  total_count     integer,
  total_amount    numeric,
  pending_count   integer,
  pending_amount  numeric,
  approved_count  integer,
  approved_amount numeric,
  rejected_count  integer,
  rejected_amount numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH scoped_claims AS (
    SELECT c.status_id, c.total_amount
    FROM public.expense_claims c
    WHERE p_claim_ids IS NULL OR c.id = ANY(p_claim_ids)
  )
  SELECT
    COUNT(*)::int AS total_count,
    COALESCE(SUM(sc.total_amount), 0)::numeric AS total_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(array_length(p_pending_status_ids, 1), 0) > 0
        AND sc.status_id = ANY(p_pending_status_ids)
    )::int AS pending_count,
    COALESCE(SUM(sc.total_amount) FILTER (
      WHERE COALESCE(array_length(p_pending_status_ids, 1), 0) > 0
        AND sc.status_id = ANY(p_pending_status_ids)
    ), 0)::numeric AS pending_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(array_length(p_approved_status_ids, 1), 0) > 0
        AND sc.status_id = ANY(p_approved_status_ids)
    )::int AS approved_count,
    COALESCE(SUM(sc.total_amount) FILTER (
      WHERE COALESCE(array_length(p_approved_status_ids, 1), 0) > 0
        AND sc.status_id = ANY(p_approved_status_ids)
    ), 0)::numeric AS approved_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(array_length(p_rejected_status_ids, 1), 0) > 0
        AND sc.status_id = ANY(p_rejected_status_ids)
    )::int AS rejected_count,
    COALESCE(SUM(sc.total_amount) FILTER (
      WHERE COALESCE(array_length(p_rejected_status_ids, 1), 0) > 0
        AND sc.status_id = ANY(p_rejected_status_ids)
    ), 0)::numeric AS rejected_amount
  FROM scoped_claims sc;
$function$;


-- ── 2. Drop the covering index ────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_ec_status_total_amount;
