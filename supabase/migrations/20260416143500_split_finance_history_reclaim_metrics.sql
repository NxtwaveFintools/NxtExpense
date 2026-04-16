BEGIN;

-- OUT parameter shape changed; Postgres requires a drop before recreate.
DROP FUNCTION IF EXISTS public.get_finance_history_action_metrics(
  uuid[],
  text,
  timestamptz,
  timestamptz,
  text[],
  text[],
  text[]
);

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
  rejected_without_reclaim_count integer,
  rejected_without_reclaim_amount numeric,
  rejected_allow_reclaim_count integer,
  rejected_allow_reclaim_amount numeric,
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
      c.total_amount,
      COALESCE(c.allow_resubmit, false) AS allow_resubmit
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
      WHERE COALESCE(array_length(p_rejected_actions, 1), 0) > 0
        AND sa.action = ANY(p_rejected_actions)
        AND sa.allow_resubmit = false
    )::int AS rejected_without_reclaim_count,
    COALESCE(SUM(sa.total_amount) FILTER (
      WHERE COALESCE(array_length(p_rejected_actions, 1), 0) > 0
        AND sa.action = ANY(p_rejected_actions)
        AND sa.allow_resubmit = false
    ), 0)::numeric AS rejected_without_reclaim_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(array_length(p_rejected_actions, 1), 0) > 0
        AND sa.action = ANY(p_rejected_actions)
        AND sa.allow_resubmit = true
    )::int AS rejected_allow_reclaim_count,
    COALESCE(SUM(sa.total_amount) FILTER (
      WHERE COALESCE(array_length(p_rejected_actions, 1), 0) > 0
        AND sa.action = ANY(p_rejected_actions)
        AND sa.allow_resubmit = true
    ), 0)::numeric AS rejected_allow_reclaim_amount,
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

COMMIT;
