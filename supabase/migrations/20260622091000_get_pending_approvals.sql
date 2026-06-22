-- get_pending_approvals: server-side keyset page of pending-approval claim IDs.
--
-- WHY:
--   The previous Pending Approvals list (getPendingApprovalsPaginated) resolved
--   the approver's subordinate EMPLOYEE ids in the app and sent them to PostgREST
--   as a URL filter: `.or(current_approval_level.eq.2,employee_id.in.(<ids>))`.
--   That URL grows with the approver's org scope. Today the worst case (PM
--   "mansoor", 105 subordinates) is ~4 KB and safe, but it scales with headcount
--   and is the same class of problem that previously broke Approval History at
--   8k+ claim ids (HTTP 414). This mirrors the History/Finance design: resolve
--   the scope INSIDE Postgres from the caller's identity, return only a keyset
--   page of claim ids, and let the app do bounded (<= p_limit) enrichment. The
--   request URL is now tiny and constant regardless of HOD/SBH/ZBH size.
--
-- SCOPE (identical to the old app-side getPendingApprovalScopeByActor):
--   level 1 (acts): claims at current_approval_level = 1 whose owner has
--                   approval_employee_id_level_1 = me; PLUS, only when I am a ZBH,
--                   owner.approval_employee_id_level_2 = me (view-only scope).
--   level 2 (acts): claims at current_approval_level = 2 whose owner has
--                   approval_employee_id_level_3 = me  (HOD/PM act at L2 via the
--                   level_3 assignment — see approval-detail.tsx routing).
--   Pending status set = active, non-terminal, non-rejection statuses with
--   approval_level in (1,2), optionally narrowed to p_claim_status_id.
--   NOTE: unlike History, pending scope does NOT inherit employee_replacements
--   (parity with the previous behaviour).
--
-- Returns p_limit + 1 rows so the caller can detect hasNextPage and slice.
-- Keyset cursor over (claim_date, id) honouring p_sort ('asc' | 'desc').
--
-- Parity verified live 2026-06-22 (rolled-back transaction, EXPLAIN + array-equal
-- comparison vs the old .or() logic) for PM/SBH/ZBH actors, default + filtered
-- (amount + date window) + both sort directions: byte-identical id pages.
--
-- SECURITY DEFINER + pinned search_path: the scope predicate (computed from
-- current_user_email()) is the authorization gate, exactly as get_my_approver_acted_claim_ids
-- gates History. Each caller only ever sees claims pending at a level where they
-- are the assigned approver.

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
    SELECT s.id
    FROM public.claim_statuses s
    WHERE s.approval_level IN (1, 2)
      AND s.is_rejection = false
      AND s.is_terminal = false
      AND s.is_active = true
      AND (p_claim_status_id IS NULL OR s.id = p_claim_status_id)
  ),
  loc AS (
    SELECT w.id
    FROM public.work_locations w
    WHERE p_location_type IS NOT NULL
      AND (
        (p_location_type = 'outstation' AND w.requires_outstation_details = true)
        OR (p_location_type <> 'outstation'
            AND w.requires_outstation_details = false
            AND w.requires_vehicle_selection = true)
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
          ELSE c.total_amount <= p_amount_value
        END))
    AND (p_location_type IS NULL OR c.work_location_id IN (SELECT id FROM loc))
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
$function$;

GRANT EXECUTE ON FUNCTION public.get_pending_approvals(
  integer, date, uuid, text, uuid, boolean, text, text, numeric, text, date, date
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_pending_approvals(
  integer, date, uuid, text, uuid, boolean, text, text, numeric, text, date, date
) TO service_role;
