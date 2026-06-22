-- Rollback for 20260622092000_fix_get_pending_approvals_plan_degradation.sql
-- Restores the prior LANGUAGE sql version from 20260622091000.
-- WARNING: this reintroduces the generic-plan degradation that caused
-- "canceling statement due to statement timeout" on /approvals for large
-- approver scopes (e.g. PM mansoor). Only use to revert to the exact prior state.

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
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT e.id AS employee_id, d.designation_code
    FROM public.employees e
    LEFT JOIN public.designations d ON d.id = e.designation_id
    WHERE lower(e.employee_email) = current_user_email()
    LIMIT 1
  ),
  pending_status AS (
    SELECT s.id FROM public.claim_statuses s
    WHERE s.approval_level IN (1, 2) AND s.is_rejection = false
      AND s.is_terminal = false AND s.is_active = true
      AND (p_claim_status_id IS NULL OR s.id = p_claim_status_id)
  ),
  loc AS (
    SELECT w.id FROM public.work_locations w
    WHERE p_location_type IS NOT NULL AND (
      (p_location_type = 'outstation' AND w.requires_outstation_details = true)
      OR (p_location_type <> 'outstation' AND w.requires_outstation_details = false AND w.requires_vehicle_selection = true)
    )
  )
  SELECT c.id, c.claim_date
  FROM public.expense_claims c
  JOIN public.employees owner ON owner.id = c.employee_id
  JOIN me ON true
  WHERE c.status_id IN (SELECT id FROM pending_status)
    AND (
      (c.current_approval_level = 1 AND (
         owner.approval_employee_id_level_1 = me.employee_id
         OR (me.designation_code = 'ZBH' AND owner.approval_employee_id_level_2 = me.employee_id)
      ))
      OR (c.current_approval_level = 2 AND owner.approval_employee_id_level_3 = me.employee_id)
    )
    AND (p_allow_resubmit IS NULL OR c.allow_resubmit = p_allow_resubmit)
    AND (p_claim_date_from IS NULL OR c.claim_date >= p_claim_date_from)
    AND (p_claim_date_to   IS NULL OR c.claim_date <= p_claim_date_to)
    AND (p_amount_value IS NULL OR (CASE
          WHEN p_amount_operator = 'gte' THEN c.total_amount >= p_amount_value
          WHEN p_amount_operator = 'eq'  THEN c.total_amount =  p_amount_value
          ELSE c.total_amount <= p_amount_value END))
    AND (p_location_type IS NULL OR c.work_location_id IN (SELECT id FROM loc))
    AND (p_employee_name IS NULL OR p_employee_name = '' OR
         owner.employee_name ILIKE '%' || replace(replace(p_employee_name, '%', '\%'), '_', '\_') || '%')
    AND (p_cursor_claim_date IS NULL OR p_cursor_id IS NULL OR (CASE WHEN p_sort='asc'
          THEN (c.claim_date > p_cursor_claim_date OR (c.claim_date = p_cursor_claim_date AND c.id > p_cursor_id))
          ELSE (c.claim_date < p_cursor_claim_date OR (c.claim_date = p_cursor_claim_date AND c.id < p_cursor_id)) END))
  ORDER BY
    CASE WHEN p_sort='asc' THEN c.claim_date END ASC, CASE WHEN p_sort<>'asc' THEN c.claim_date END DESC,
    CASE WHEN p_sort='asc' THEN c.id END ASC, CASE WHEN p_sort<>'asc' THEN c.id END DESC
  LIMIT GREATEST(p_limit, 0) + 1;
$function$;
