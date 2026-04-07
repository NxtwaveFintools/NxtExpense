BEGIN;

CREATE OR REPLACE FUNCTION public.get_claim_bucket_metrics(
  p_claim_ids uuid[] DEFAULT NULL,
  p_pending_status_ids uuid[] DEFAULT NULL,
  p_approved_status_ids uuid[] DEFAULT NULL,
  p_rejected_status_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  total_count integer,
  total_amount numeric,
  pending_count integer,
  pending_amount numeric,
  approved_count integer,
  approved_amount numeric,
  rejected_count integer,
  rejected_amount numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.get_claim_bucket_metrics(uuid[], uuid[], uuid[], uuid[])
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_finance_history_action_metrics(
  p_claim_ids uuid[] DEFAULT NULL,
  p_action_filter text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_date_scoped_actions text[] DEFAULT NULL,
  p_approved_actions text[] DEFAULT NULL,
  p_rejected_actions text[] DEFAULT NULL
)
RETURNS TABLE(
  total_count integer,
  total_amount numeric,
  approved_count integer,
  approved_amount numeric,
  rejected_count integer,
  rejected_amount numeric,
  other_count integer,
  other_amount numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH scoped_actions AS (
    SELECT
      fa.action,
      c.total_amount
    FROM public.finance_actions fa
    JOIN public.expense_claims c ON c.id = fa.claim_id
    WHERE (p_claim_ids IS NULL OR fa.claim_id = ANY(p_claim_ids))
      AND (p_date_from IS NULL OR fa.acted_at >= p_date_from)
      AND (p_date_to IS NULL OR fa.acted_at <= p_date_to)
      AND (
        (
          COALESCE(array_length(p_date_scoped_actions, 1), 0) > 0
          AND fa.action = ANY(p_date_scoped_actions)
        )
        OR (
          COALESCE(array_length(p_date_scoped_actions, 1), 0) = 0
          AND p_action_filter IS NOT NULL
          AND fa.action = p_action_filter
        )
        OR (
          COALESCE(array_length(p_date_scoped_actions, 1), 0) = 0
          AND p_action_filter IS NULL
        )
      )
  )
  SELECT
    COUNT(*)::int AS total_count,
    COALESCE(SUM(sa.total_amount), 0)::numeric AS total_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(array_length(p_approved_actions, 1), 0) > 0
        AND sa.action = ANY(p_approved_actions)
    )::int AS approved_count,
    COALESCE(SUM(sa.total_amount) FILTER (
      WHERE COALESCE(array_length(p_approved_actions, 1), 0) > 0
        AND sa.action = ANY(p_approved_actions)
    ), 0)::numeric AS approved_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(array_length(p_rejected_actions, 1), 0) > 0
        AND sa.action = ANY(p_rejected_actions)
    )::int AS rejected_count,
    COALESCE(SUM(sa.total_amount) FILTER (
      WHERE COALESCE(array_length(p_rejected_actions, 1), 0) > 0
        AND sa.action = ANY(p_rejected_actions)
    ), 0)::numeric AS rejected_amount,
    COUNT(*) FILTER (
      WHERE NOT (
        (
          COALESCE(array_length(p_approved_actions, 1), 0) > 0
          AND sa.action = ANY(p_approved_actions)
        )
        OR (
          COALESCE(array_length(p_rejected_actions, 1), 0) > 0
          AND sa.action = ANY(p_rejected_actions)
        )
      )
    )::int AS other_count,
    COALESCE(SUM(sa.total_amount) FILTER (
      WHERE NOT (
        (
          COALESCE(array_length(p_approved_actions, 1), 0) > 0
          AND sa.action = ANY(p_approved_actions)
        )
        OR (
          COALESCE(array_length(p_rejected_actions, 1), 0) > 0
          AND sa.action = ANY(p_rejected_actions)
        )
      )
    ), 0)::numeric AS other_amount
  FROM scoped_actions sa;
$$;

GRANT EXECUTE ON FUNCTION public.get_finance_history_action_metrics(uuid[], text, timestamptz, timestamptz, text[], text[], text[])
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_employee_claim_metrics(
  p_employee_id uuid
)
RETURNS TABLE(
  total_count integer,
  total_amount numeric,
  pending_count integer,
  pending_amount numeric,
  approved_count integer,
  approved_amount numeric,
  rejected_count integer,
  rejected_amount numeric,
  rejected_allow_reclaim_count integer,
  rejected_allow_reclaim_amount numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH scoped_claims AS (
    SELECT
      c.total_amount,
      c.allow_resubmit,
      cs.is_rejection,
      cs.is_payment_issued
    FROM public.expense_claims c
    JOIN public.claim_statuses cs ON cs.id = c.status_id
    WHERE c.employee_id = p_employee_id
  )
  SELECT
    COUNT(*)::int AS total_count,
    COALESCE(SUM(sc.total_amount), 0)::numeric AS total_amount,
    COUNT(*) FILTER (
      WHERE NOT COALESCE(sc.is_rejection, false)
        AND NOT COALESCE(sc.is_payment_issued, false)
    )::int AS pending_count,
    COALESCE(SUM(sc.total_amount) FILTER (
      WHERE NOT COALESCE(sc.is_rejection, false)
        AND NOT COALESCE(sc.is_payment_issued, false)
    ), 0)::numeric AS pending_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(sc.is_payment_issued, false)
    )::int AS approved_count,
    COALESCE(SUM(sc.total_amount) FILTER (
      WHERE COALESCE(sc.is_payment_issued, false)
    ), 0)::numeric AS approved_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(sc.is_rejection, false)
        AND NOT COALESCE(sc.allow_resubmit, false)
    )::int AS rejected_count,
    COALESCE(SUM(sc.total_amount) FILTER (
      WHERE COALESCE(sc.is_rejection, false)
        AND NOT COALESCE(sc.allow_resubmit, false)
    ), 0)::numeric AS rejected_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(sc.is_rejection, false)
        AND COALESCE(sc.allow_resubmit, false)
    )::int AS rejected_allow_reclaim_count,
    COALESCE(SUM(sc.total_amount) FILTER (
      WHERE COALESCE(sc.is_rejection, false)
        AND COALESCE(sc.allow_resubmit, false)
    ), 0)::numeric AS rejected_allow_reclaim_amount
  FROM scoped_claims sc;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_claim_metrics(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_pending_approval_scope_summary(
  p_level1_employee_ids uuid[] DEFAULT NULL,
  p_level2_employee_ids uuid[] DEFAULT NULL,
  p_pending_status_ids uuid[] DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT NULL,
  p_employee_name text DEFAULT NULL,
  p_claim_date_from date DEFAULT NULL,
  p_claim_date_to date DEFAULT NULL,
  p_amount_operator text DEFAULT NULL,
  p_amount_value numeric DEFAULT NULL,
  p_location_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  claim_count integer,
  total_amount numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH scoped_claims AS (
    SELECT c.total_amount
    FROM public.expense_claims c
    JOIN public.employees e ON e.id = c.employee_id
    WHERE (
      COALESCE(array_length(p_pending_status_ids, 1), 0) = 0
      OR c.status_id = ANY(p_pending_status_ids)
    )
      AND (
        (
          COALESCE(array_length(p_level1_employee_ids, 1), 0) > 0
          AND c.current_approval_level = 1
          AND c.employee_id = ANY(p_level1_employee_ids)
        )
        OR (
          COALESCE(array_length(p_level2_employee_ids, 1), 0) > 0
          AND c.current_approval_level = 2
          AND c.employee_id = ANY(p_level2_employee_ids)
        )
      )
      AND (p_allow_resubmit IS NULL OR c.allow_resubmit = p_allow_resubmit)
      AND (
        p_employee_name IS NULL
        OR e.employee_name ILIKE '%' || p_employee_name || '%'
      )
      AND (p_claim_date_from IS NULL OR c.claim_date >= p_claim_date_from)
      AND (p_claim_date_to IS NULL OR c.claim_date <= p_claim_date_to)
      AND (
        p_amount_value IS NULL
        OR (
          COALESCE(p_amount_operator, 'lte') = 'gte'
          AND c.total_amount >= p_amount_value
        )
        OR (
          COALESCE(p_amount_operator, 'lte') = 'eq'
          AND c.total_amount = p_amount_value
        )
        OR (
          COALESCE(p_amount_operator, 'lte') NOT IN ('gte', 'eq')
          AND c.total_amount <= p_amount_value
        )
      )
      AND (
        COALESCE(array_length(p_location_ids, 1), 0) = 0
        OR c.work_location_id = ANY(p_location_ids)
      )
  )
  SELECT
    COUNT(*)::int AS claim_count,
    COALESCE(SUM(sc.total_amount), 0)::numeric AS total_amount
  FROM scoped_claims sc;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_approval_scope_summary(uuid[], uuid[], uuid[], boolean, text, date, date, text, numeric, uuid[])
  TO authenticated;

COMMIT;
