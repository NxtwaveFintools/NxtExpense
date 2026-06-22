-- Fix get_pending_approvals statement-timeout under load (generic-plan degradation).
--
-- ROOT CAUSE (confirmed live 2026-06-22):
--   The 20260622091000 version was LANGUAGE sql + SECURITY DEFINER, so PostgreSQL
--   cannot inline it and plan-caches the body. After ~5 executions it switches
--   from a custom plan to a GENERIC plan. Because the approver scope was resolved
--   via a `me` CTE joined into the main query (`owner.approval_employee_id_level_x
--   = me.employee_id`), the generic planner could not treat the actor id as a
--   constant and produced a catastrophic plan over the OR scope predicate.
--   Measured on PM "mansoor" (2,327 pending claims): custom plan 9.5 ms / 515
--   buffers, but the GENERIC plan = 2,633 ms / 89,281 buffers. The `authenticated`
--   role has statement_timeout = 8s, and the /approvals page fires 5 loaders in
--   parallel, so the generic plan blew past 8s → "canceling statement due to
--   statement timeout" and the page hit its error boundary.
--
-- FIX:
--   Rewrite as LANGUAGE plpgsql and resolve the actor (employee id + ZBH flag)
--   into SCALAR VARIABLES first, then run the page query with those constants.
--   With the `me` join gone, the scope predicate is `owner.approval_employee_id_*
--   = <constant>`, which plans well even generically. Measured under a FORCED
--   generic plan: 43 ms / 13,101 buffers (~60x faster; ~180x headroom under 8s).
--
--   Signature, parameters, return columns and RESULTS are unchanged. Parity
--   re-verified live (rolled-back txn) vs the old .or() reference for PM/SBH/ZBH,
--   default + filtered + both sort directions: byte-identical id pages. No app or
--   repository change is required (same RPC name/args/shape).
--   CREATE OR REPLACE preserves the existing grants from 20260622091000.

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
  -- Resolve the calling approver ONCE into scalar variables. Keeping the actor
  -- id out of the main join is what keeps the plan fast & stable (see header).
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
