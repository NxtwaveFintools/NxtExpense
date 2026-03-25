BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_finance_overview_metrics()
RETURNS TABLE (
  total_claims_count bigint,
  total_claims_amount numeric,
  pending_finance_count bigint,
  pending_finance_amount numeric,
  payment_issued_count bigint,
  payment_issued_amount numeric,
  rejected_count bigint,
  rejected_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  v_admin_id := public.require_admin_actor();

  RETURN QUERY
  WITH pending_finance_statuses AS (
    SELECT id
    FROM public.claim_statuses
    WHERE approval_level = 3
      AND is_approval = false
      AND is_rejection = false
      AND is_terminal = false
      AND is_active = true
  ),
  payment_issued_statuses AS (
    SELECT id
    FROM public.claim_statuses
    WHERE is_payment_issued = true
      AND is_active = true
  ),
  rejected_statuses AS (
    SELECT id
    FROM public.claim_statuses
    WHERE is_rejection = true
      AND is_active = true
  )
  SELECT
    count(*)::bigint,
    coalesce(sum(c.total_amount), 0)::numeric,
    count(*) FILTER (
      WHERE c.status_id IN (SELECT id FROM pending_finance_statuses)
    )::bigint,
    coalesce(
      sum(c.total_amount) FILTER (
        WHERE c.status_id IN (SELECT id FROM pending_finance_statuses)
      ),
      0
    )::numeric,
    count(*) FILTER (
      WHERE c.status_id IN (SELECT id FROM payment_issued_statuses)
    )::bigint,
    coalesce(
      sum(c.total_amount) FILTER (
        WHERE c.status_id IN (SELECT id FROM payment_issued_statuses)
      ),
      0
    )::numeric,
    count(*) FILTER (
      WHERE c.status_id IN (SELECT id FROM rejected_statuses)
    )::bigint,
    coalesce(
      sum(c.total_amount) FILTER (
        WHERE c.status_id IN (SELECT id FROM rejected_statuses)
      ),
      0
    )::numeric
  FROM public.expense_claims c;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_finance_overview_metrics()
  TO authenticated;

COMMIT;
