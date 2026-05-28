-- Optimize get_filtered_approval_history_count: remove per-claim LATERAL joins
--
-- Problem (carried over from 20260527140000):
--   The count function built latest_actions (DISTINCT ON per visible claim) and
--   then COUNT(*) over a join that included TWO correlated LATERAL subqueries
--   (hod_event, finance_event) evaluated for EVERY visible claim — even though
--   their only purpose is to support the hod/finance date-range filters, which
--   are NULL on virtually every call (only finance/admin ever set them).
--
--   For Mansoor (8 235 visible claims today) that is 16 470 correlated subquery
--   executions per page load just to produce a count. The PostgREST wrapper for
--   this path peaked at ~7.9 s — right at the 8 s statement_timeout. At lakh
--   scale it would always time out.
--
-- Fix:
--   plpgsql with two branches so the common case carries ZERO per-claim work:
--
--   FAST PATH (no hod/finance date filter — > 99% of calls, and the only path a
--   normal approver can trigger): a pure set-based count over
--     latest_actions -> expense_claims -> claim_statuses -> employees(owner)
--   No event subqueries at all. Verified ~62 ms for Mansoor as SECURITY DEFINER.
--
--   SLOW PATH (finance/admin set a hod/finance approved date range): the same
--   set, plus the hod/finance "latest approved at" values computed ONCE via
--   GROUP BY LEFT JOINs (single aggregate pass each), NOT a per-claim correlated
--   subquery. This scales linearly instead of O(visible_claims).
--
-- Why not keep it as LANGUAGE sql with gated subqueries:
--   As a sql function the body is planned generically (params as placeholders),
--   so `p_x IS NULL OR <correlated subquery>` cannot be pruned at plan time and
--   the subplan runs per row anyway — reproducing the original blow-up (13 s+).
--   The plpgsql branch removes the subquery from the plan entirely in the common
--   case.
--
-- Result is identical to the previous definition (verified: Mansoor = 8 258).
-- Signature, return type, and calling code are unchanged.

CREATE OR REPLACE FUNCTION public.get_filtered_approval_history_count(
  p_name_search           text                     DEFAULT NULL,
  p_actor_filters         text[]                   DEFAULT NULL,
  p_claim_status          text                     DEFAULT NULL,
  p_claim_status_id       uuid                     DEFAULT NULL,
  p_claim_allow_resubmit  boolean                  DEFAULT NULL,
  p_amount_operator       text                     DEFAULT 'lte',
  p_amount_value          numeric                  DEFAULT NULL,
  p_location_type         text                     DEFAULT NULL,
  p_claim_date_from       date                     DEFAULT NULL,
  p_claim_date_to         date                     DEFAULT NULL,
  p_hod_approved_from     timestamp with time zone DEFAULT NULL,
  p_hod_approved_to       timestamp with time zone DEFAULT NULL,
  p_finance_approved_from timestamp with time zone DEFAULT NULL,
  p_finance_approved_to   timestamp with time zone DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count   bigint;
  v_amount_op text := coalesce(nullif(trim(lower(coalesce(p_amount_operator, ''))), ''), 'lte');
  v_needs_event_filter boolean :=
       p_hod_approved_from     IS NOT NULL
    OR p_hod_approved_to       IS NOT NULL
    OR p_finance_approved_from IS NOT NULL
    OR p_finance_approved_to   IS NOT NULL;
BEGIN
  IF NOT v_needs_event_filter THEN
    -- ── FAST PATH: no event subqueries ─────────────────────────────────────────
    WITH
    role_scope AS (
      SELECT
        coalesce(bool_or(r.is_admin_role), false)              AS is_admin,
        coalesce(bool_or(r.role_code = 'FINANCE_TEAM'), false) AS is_finance
      FROM public.employees      cur
      JOIN public.employee_roles er ON er.employee_id = cur.id
      JOIN public.roles           r  ON r.id           = er.role_id
      WHERE er.is_active = true
        AND lower(cur.employee_email) = current_user_email()
    ),
    visible_claim_ids AS (
      SELECT v.claim_id
      FROM   public.get_my_approver_acted_claim_ids() AS v(claim_id)
      UNION
      SELECT c.id AS claim_id
      FROM   public.expense_claims c
      WHERE  EXISTS (SELECT 1 FROM role_scope rs WHERE rs.is_finance)
        AND  c.status_id IN (
               SELECT s.status_id
               FROM   public.get_finance_visible_status_ids() AS s(status_id)
             )
    ),
    latest_actions AS (
      SELECT DISTINCT ON (ah.claim_id)
        ah.claim_id,
        coalesce(ah.allow_resubmit, false) AS allow_resubmit
      FROM public.approval_history ah
      WHERE
        EXISTS (SELECT 1 FROM role_scope rs WHERE rs.is_admin)
        OR ah.claim_id IN (SELECT vc.claim_id FROM visible_claim_ids vc)
      ORDER BY ah.claim_id, ah.acted_at DESC, ah.id DESC
    )
    SELECT count(*)::bigint
    INTO   v_count
    FROM   latest_actions la
    JOIN   public.expense_claims c         ON c.id         = la.claim_id
    JOIN   public.claim_statuses cs        ON cs.id        = c.status_id
    JOIN   public.employees      owner_emp ON owner_emp.id = c.employee_id
    WHERE
      (
        p_name_search IS NULL
        OR trim(p_name_search) = ''
        OR owner_emp.employee_name ILIKE ('%' || trim(p_name_search) || '%')
      )
      AND (p_claim_status_id IS NULL OR cs.id = p_claim_status_id)
      AND (
        p_claim_status IS NULL
        OR trim(p_claim_status) = ''
        OR cs.status_code = trim(p_claim_status)
      )
      AND (p_claim_allow_resubmit IS NULL OR la.allow_resubmit = p_claim_allow_resubmit)
      AND (
        p_amount_value IS NULL
        OR (v_amount_op = 'gte' AND c.total_amount >= p_amount_value)
        OR (v_amount_op = 'eq'  AND c.total_amount  = p_amount_value)
        OR (v_amount_op = 'lte' AND c.total_amount <= p_amount_value)
      )
      AND (
        p_location_type IS NULL
        OR trim(p_location_type) = ''
        OR (
          lower(trim(p_location_type)) = 'outstation'
          AND EXISTS (
            SELECT 1 FROM public.work_locations wlo
            WHERE wlo.id = c.work_location_id
              AND wlo.requires_outstation_details = true
          )
        )
        OR (
          lower(trim(p_location_type)) = 'base'
          AND EXISTS (
            SELECT 1 FROM public.work_locations wlb
            WHERE wlb.id = c.work_location_id
              AND wlb.requires_outstation_details = false
              AND wlb.requires_vehicle_selection  = true
          )
        )
      )
      AND (p_claim_date_from IS NULL OR c.claim_date >= p_claim_date_from)
      AND (p_claim_date_to   IS NULL OR c.claim_date <= p_claim_date_to);

  ELSE
    -- ── SLOW PATH: hod/finance approved-at via single-pass GROUP BY joins ───────
    WITH
    role_scope AS (
      SELECT
        coalesce(bool_or(r.is_admin_role), false)              AS is_admin,
        coalesce(bool_or(r.role_code = 'FINANCE_TEAM'), false) AS is_finance
      FROM public.employees      cur
      JOIN public.employee_roles er ON er.employee_id = cur.id
      JOIN public.roles           r  ON r.id           = er.role_id
      WHERE er.is_active = true
        AND lower(cur.employee_email) = current_user_email()
    ),
    payment_issued_actions AS (
      SELECT DISTINCT
        CASE
          WHEN coalesce(to_status.is_payment_issued, false)
            AND cst.action_code LIKE 'finance_%'
            THEN substr(cst.action_code, length('finance_') + 1)
          ELSE cst.action_code
        END AS action_code
      FROM public.claim_status_transitions cst
      JOIN public.claim_statuses to_status ON to_status.id = cst.to_status_id
      WHERE cst.is_active       = true
        AND to_status.is_active = true
        AND coalesce(to_status.is_payment_issued, false) = true
    ),
    visible_claim_ids AS (
      SELECT v.claim_id
      FROM   public.get_my_approver_acted_claim_ids() AS v(claim_id)
      UNION
      SELECT c.id AS claim_id
      FROM   public.expense_claims c
      WHERE  EXISTS (SELECT 1 FROM role_scope rs WHERE rs.is_finance)
        AND  c.status_id IN (
               SELECT s.status_id
               FROM   public.get_finance_visible_status_ids() AS s(status_id)
             )
    ),
    latest_actions AS (
      SELECT DISTINCT ON (ah.claim_id)
        ah.claim_id,
        coalesce(ah.allow_resubmit, false) AS allow_resubmit
      FROM public.approval_history ah
      WHERE
        EXISTS (SELECT 1 FROM role_scope rs WHERE rs.is_admin)
        OR ah.claim_id IN (SELECT vc.claim_id FROM visible_claim_ids vc)
      ORDER BY ah.claim_id, ah.acted_at DESC, ah.id DESC
    ),
    -- latest HOD (level-3 pending) approval timestamp per claim, computed once
    hod_event AS (
      SELECT ah_hod.claim_id, max(ah_hod.acted_at) AS hod_approved_at
      FROM   public.approval_history ah_hod
      JOIN   public.claim_statuses   ts ON ts.id = ah_hod.new_status_id
      WHERE  ts.approval_level = 3
        AND  ts.is_approval    = false
        AND  ts.is_rejection   = false
        AND  ts.is_terminal    = false
      GROUP BY ah_hod.claim_id
    ),
    -- latest finance payment-issued timestamp per claim, computed once
    finance_event AS (
      SELECT fa.claim_id, max(fa.acted_at) AS finance_approved_at
      FROM   public.finance_actions fa
      WHERE  CASE
               WHEN fa.action LIKE 'finance_%'
                 THEN substr(fa.action, length('finance_') + 1)
               ELSE fa.action
             END IN (SELECT pia.action_code FROM payment_issued_actions pia)
      GROUP BY fa.claim_id
    )
    SELECT count(*)::bigint
    INTO   v_count
    FROM   latest_actions la
    JOIN   public.expense_claims c         ON c.id         = la.claim_id
    JOIN   public.claim_statuses cs        ON cs.id        = c.status_id
    JOIN   public.employees      owner_emp ON owner_emp.id = c.employee_id
    LEFT JOIN hod_event     he ON he.claim_id = c.id
    LEFT JOIN finance_event fe ON fe.claim_id = c.id
    WHERE
      (
        p_name_search IS NULL
        OR trim(p_name_search) = ''
        OR owner_emp.employee_name ILIKE ('%' || trim(p_name_search) || '%')
      )
      AND (p_claim_status_id IS NULL OR cs.id = p_claim_status_id)
      AND (
        p_claim_status IS NULL
        OR trim(p_claim_status) = ''
        OR cs.status_code = trim(p_claim_status)
      )
      AND (p_claim_allow_resubmit IS NULL OR la.allow_resubmit = p_claim_allow_resubmit)
      AND (
        p_amount_value IS NULL
        OR (v_amount_op = 'gte' AND c.total_amount >= p_amount_value)
        OR (v_amount_op = 'eq'  AND c.total_amount  = p_amount_value)
        OR (v_amount_op = 'lte' AND c.total_amount <= p_amount_value)
      )
      AND (
        p_location_type IS NULL
        OR trim(p_location_type) = ''
        OR (
          lower(trim(p_location_type)) = 'outstation'
          AND EXISTS (
            SELECT 1 FROM public.work_locations wlo
            WHERE wlo.id = c.work_location_id
              AND wlo.requires_outstation_details = true
          )
        )
        OR (
          lower(trim(p_location_type)) = 'base'
          AND EXISTS (
            SELECT 1 FROM public.work_locations wlb
            WHERE wlb.id = c.work_location_id
              AND wlb.requires_outstation_details = false
              AND wlb.requires_vehicle_selection  = true
          )
        )
      )
      AND (p_claim_date_from IS NULL OR c.claim_date >= p_claim_date_from)
      AND (p_claim_date_to   IS NULL OR c.claim_date <= p_claim_date_to)
      AND (p_hod_approved_from     IS NULL OR he.hod_approved_at         >= p_hod_approved_from)
      AND (p_hod_approved_to       IS NULL OR he.hod_approved_at         <= p_hod_approved_to)
      AND (p_finance_approved_from IS NULL OR fe.finance_approved_at     >= p_finance_approved_from)
      AND (p_finance_approved_to   IS NULL OR fe.finance_approved_at     <= p_finance_approved_to);
  END IF;

  RETURN coalesce(v_count, 0);
END;
$function$;
