-- Rollback for 20260702110000_pending_approvals_canonical_filter.sql
-- Restores get_pending_approvals verbatim from
-- 20260622092000_fix_get_pending_approvals_plan_degradation.sql and
-- get_pending_approval_scope_summary verbatim from
-- 20260429080441_remote_schema.sql (lines 4025-4080).

-- ============================================================================
-- 1. Restore get_pending_approvals
-- ============================================================================

drop function if exists public.get_pending_approvals_page(
  integer, date, uuid, text, uuid, boolean, text, text, numeric, text, date, date
);

CREATE OR REPLACE FUNCTION public.get_pending_approvals(
  p_limit             integer DEFAULT 10,
  p_cursor_claim_date date    DEFAULT NULL,
  p_cursor_id         uuid    DEFAULT NULL,
  p_sort              text    DEFAULT 'desc',
  p_claim_status_id   uuid    DEFAULT NULL,
  p_allow_resubmit    boolean DEFAULT NULL,
  p_employee_name     text    DEFAULT NULL,
  p_amount_operator   text    DEFAULT 'lte',
  p_amount_value      numeric DEFAULT NULL,
  p_location_type     text    DEFAULT NULL,
  p_claim_date_from   date    DEFAULT NULL,
  p_claim_date_to     date    DEFAULT NULL
)
RETURNS TABLE(id uuid, claim_date date)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_id uuid;
  v_is_zbh      boolean;
BEGIN
  SELECT e.id, (d.designation_code = 'ZBH')
    INTO v_employee_id, v_is_zbh
  FROM public.employees e
  LEFT JOIN public.designations d ON d.id = e.designation_id
  WHERE lower(e.employee_email) = current_user_email()
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, c.claim_date
  FROM public.expense_claims c
  JOIN public.employees owner ON owner.id = c.employee_id
  WHERE c.status_id IN (
      SELECT s.id
      FROM public.claim_statuses s
      WHERE s.approval_level IN (1, 2)
        AND s.is_rejection = false
        AND s.is_terminal = false
        AND s.is_active = true
        AND (p_claim_status_id IS NULL OR s.id = p_claim_status_id)
    )
    AND (
      (c.current_approval_level = 1 AND (
         owner.approval_employee_id_level_1 = v_employee_id
         OR (v_is_zbh AND owner.approval_employee_id_level_2 = v_employee_id)
      ))
      OR (c.current_approval_level = 2 AND owner.approval_employee_id_level_3 = v_employee_id)
    )
    AND (p_allow_resubmit IS NULL OR c.allow_resubmit = p_allow_resubmit)
    AND (p_claim_date_from IS NULL OR c.claim_date >= p_claim_date_from)
    AND (p_claim_date_to   IS NULL OR c.claim_date <= p_claim_date_to)
    AND (p_amount_value IS NULL OR (CASE
          WHEN p_amount_operator = 'gte' THEN c.total_amount >= p_amount_value
          WHEN p_amount_operator = 'eq'  THEN c.total_amount =  p_amount_value
          ELSE c.total_amount <= p_amount_value
        END))
    AND (p_location_type IS NULL OR c.work_location_id IN (
          SELECT w.id
          FROM public.work_locations w
          WHERE (p_location_type = 'outstation' AND w.requires_outstation_details = true)
             OR (p_location_type <> 'outstation'
                 AND w.requires_outstation_details = false
                 AND w.requires_vehicle_selection = true)
        ))
    AND (p_employee_name IS NULL OR p_employee_name = '' OR
         owner.employee_name ILIKE '%' || replace(replace(p_employee_name, '%', '\%'), '_', '\_') || '%')
    AND (p_cursor_claim_date IS NULL OR p_cursor_id IS NULL OR (CASE
          WHEN p_sort = 'asc'
            THEN (c.claim_date > p_cursor_claim_date OR (c.claim_date = p_cursor_claim_date AND c.id > p_cursor_id))
            ELSE (c.claim_date < p_cursor_claim_date OR (c.claim_date = p_cursor_claim_date AND c.id < p_cursor_id))
        END))
  ORDER BY
    CASE WHEN p_sort = 'asc'  THEN c.claim_date END ASC,
    CASE WHEN p_sort <> 'asc' THEN c.claim_date END DESC,
    CASE WHEN p_sort = 'asc'  THEN c.id END ASC,
    CASE WHEN p_sort <> 'asc' THEN c.id END DESC
  LIMIT GREATEST(p_limit, 0) + 1;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_pending_approvals(
  integer, date, uuid, text, uuid, boolean, text, text, numeric, text, date, date
) TO authenticated, service_role;

-- ============================================================================
-- 2. Restore get_pending_approval_scope_summary
-- ============================================================================

drop function if exists public.get_pending_approvals_metrics(
  uuid, boolean, text, text, numeric, text, date, date
);

CREATE OR REPLACE FUNCTION public.get_pending_approval_scope_summary(
  p_level1_employee_ids uuid[] DEFAULT NULL,
  p_level2_employee_ids uuid[] DEFAULT NULL,
  p_pending_status_ids  uuid[] DEFAULT NULL,
  p_allow_resubmit      boolean DEFAULT NULL,
  p_employee_name       text DEFAULT NULL,
  p_claim_date_from     date DEFAULT NULL,
  p_claim_date_to       date DEFAULT NULL,
  p_amount_operator     text DEFAULT NULL,
  p_amount_value        numeric DEFAULT NULL,
  p_location_ids        uuid[] DEFAULT NULL
)
RETURNS TABLE(claim_count integer, total_amount numeric)
LANGUAGE sql STABLE
SET search_path TO 'public'
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

GRANT EXECUTE ON FUNCTION public.get_pending_approval_scope_summary(
  uuid[], uuid[], uuid[], boolean, text, date, date, text, numeric, uuid[]
) TO authenticated, service_role;

-- ============================================================================
-- 3. Drop the canonical function — now unreferenced by the restored RPCs above
-- ============================================================================

drop function if exists public.pending_approvals_filtered(
  uuid, boolean, text, text, numeric, text, date, date
);
