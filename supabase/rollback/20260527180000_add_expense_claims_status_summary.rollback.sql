-- Rollback for: 20260527180000_add_expense_claims_status_summary.sql
--
-- Removes the summary table, trigger, and trigger function.
-- Restores get_claim_bucket_metrics to the plpgsql version from
-- migration 20260527170000 (index-only scan on expense_claims directly).
--
-- NOTE: after rollback, the finance page initial load will again be subject
-- to cold-buffer delays (~7.5 s) if expense_claims pages are not in cache.
-- Only roll back if the trigger or summary table has a correctness bug;
-- re-apply 20260527180000 with the fix instead.


-- ── 1. Drop trigger and function ─────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_expense_claims_status_summary ON public.expense_claims;
DROP FUNCTION IF EXISTS public.maintain_expense_claims_status_summary();


-- ── 2. Drop summary table ────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.expense_claims_status_summary;


-- ── 3. Restore get_claim_bucket_metrics (version from 20260527170000) ────────

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
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_has_pending  boolean := coalesce(array_length(p_pending_status_ids,  1), 0) > 0;
  v_has_approved boolean := coalesce(array_length(p_approved_status_ids, 1), 0) > 0;
  v_has_rejected boolean := coalesce(array_length(p_rejected_status_ids, 1), 0) > 0;
BEGIN
  IF p_claim_ids IS NULL THEN
    SELECT
      count(*)::int,
      coalesce(sum(ec.total_amount), 0)::numeric,
      count(*) FILTER (WHERE v_has_pending  AND ec.status_id = ANY(p_pending_status_ids))::int,
      coalesce(sum(ec.total_amount) FILTER (WHERE v_has_pending  AND ec.status_id = ANY(p_pending_status_ids)), 0)::numeric,
      count(*) FILTER (WHERE v_has_approved AND ec.status_id = ANY(p_approved_status_ids))::int,
      coalesce(sum(ec.total_amount) FILTER (WHERE v_has_approved AND ec.status_id = ANY(p_approved_status_ids)), 0)::numeric,
      count(*) FILTER (WHERE v_has_rejected AND ec.status_id = ANY(p_rejected_status_ids))::int,
      coalesce(sum(ec.total_amount) FILTER (WHERE v_has_rejected AND ec.status_id = ANY(p_rejected_status_ids)), 0)::numeric
    INTO
      total_count,    total_amount,
      pending_count,  pending_amount,
      approved_count, approved_amount,
      rejected_count, rejected_amount
    FROM public.expense_claims ec;
  ELSE
    SELECT
      count(*)::int,
      coalesce(sum(ec.total_amount), 0)::numeric,
      count(*) FILTER (WHERE v_has_pending  AND ec.status_id = ANY(p_pending_status_ids))::int,
      coalesce(sum(ec.total_amount) FILTER (WHERE v_has_pending  AND ec.status_id = ANY(p_pending_status_ids)), 0)::numeric,
      count(*) FILTER (WHERE v_has_approved AND ec.status_id = ANY(p_approved_status_ids))::int,
      coalesce(sum(ec.total_amount) FILTER (WHERE v_has_approved AND ec.status_id = ANY(p_approved_status_ids)), 0)::numeric,
      count(*) FILTER (WHERE v_has_rejected AND ec.status_id = ANY(p_rejected_status_ids))::int,
      coalesce(sum(ec.total_amount) FILTER (WHERE v_has_rejected AND ec.status_id = ANY(p_rejected_status_ids)), 0)::numeric
    INTO
      total_count,    total_amount,
      pending_count,  pending_amount,
      approved_count, approved_amount,
      rejected_count, rejected_amount
    FROM unnest(p_claim_ids) AS cid(id)
    JOIN public.expense_claims ec ON ec.id = cid.id;
  END IF;

  total_count     := coalesce(total_count,     0);
  total_amount    := coalesce(total_amount,    0);
  pending_count   := coalesce(pending_count,   0);
  pending_amount  := coalesce(pending_amount,  0);
  approved_count  := coalesce(approved_count,  0);
  approved_amount := coalesce(approved_amount, 0);
  rejected_count  := coalesce(rejected_count,  0);
  rejected_amount := coalesce(rejected_amount, 0);

  RETURN NEXT;
END;
$function$;
