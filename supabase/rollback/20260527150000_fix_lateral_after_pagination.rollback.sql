-- Rollback for: 20260527150000_fix_lateral_after_pagination.sql
--
-- Restores get_filtered_approval_history (17-param) to the
-- 20260527140000 version (visible_claim_ids + LATERAL-before-LIMIT approach).
--
-- Restores get_approval_history_analytics to the pre-20260527150000
-- version (no role_scope/visible_claim_ids in latest_actions).
--
-- NOTE: After rolling back, the statement timeout issue for large-scope
-- non-admin users (e.g. Mansoor, 8 235 acted claims) will recur because
-- the full approval_history index scan + LATERAL × 8 235 is the root cause.
-- Apply 20260527160000 (streaming rewrite) instead of this rollback target.


-- ============================================================
-- 1. Restore get_filtered_approval_history → 20260527140000 version
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_filtered_approval_history(
  p_limit                 integer                  DEFAULT 10,
  p_cursor_acted_at       timestamp with time zone DEFAULT NULL,
  p_cursor_action_id      uuid                     DEFAULT NULL,
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
RETURNS TABLE(
  action_id                  uuid,
  claim_id                   uuid,
  claim_number               text,
  claim_date                 date,
  work_location              text,
  total_amount               numeric,
  claim_status               text,
  claim_status_name          text,
  claim_status_display_color text,
  owner_name                 text,
  owner_designation          text,
  actor_email                text,
  actor_designation          text,
  action                     text,
  approval_level             integer,
  notes                      text,
  acted_at                   timestamp with time zone,
  hod_approved_at            timestamp with time zone,
  finance_approved_at        timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH role_scope AS (
    SELECT
      coalesce(bool_or(r.is_admin_role), false) AS is_admin,
      coalesce(bool_or(r.role_code = 'FINANCE_TEAM'), false) AS is_finance
    FROM public.employees cur
    JOIN public.employee_roles er ON er.employee_id = cur.id
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.is_active = true
      AND lower(cur.employee_email) = current_user_email()
  ),
  payment_issued_actions AS (
    SELECT DISTINCT
      CASE
        WHEN coalesce(to_status.is_payment_issued, false) = true
          AND cst.action_code LIKE 'finance_%'
          THEN substr(cst.action_code, length('finance_') + 1)
        ELSE cst.action_code
      END AS action_code
    FROM public.claim_status_transitions cst
    JOIN public.claim_statuses to_status ON to_status.id = cst.to_status_id
    WHERE cst.is_active = true
      AND to_status.is_active = true
      AND coalesce(to_status.is_payment_issued, false) = true
  ),
  visible_claim_ids AS (
    SELECT v.claim_id
    FROM public.get_my_approver_acted_claim_ids() AS v(claim_id)
    UNION
    SELECT c.id AS claim_id
    FROM public.expense_claims c
    WHERE EXISTS (SELECT 1 FROM role_scope rs WHERE rs.is_finance)
      AND c.status_id IN (
        SELECT s.status_id
        FROM public.get_finance_visible_status_ids() AS s(status_id)
      )
  ),
  latest_actions AS (
    SELECT DISTINCT ON (ah.claim_id)
      ah.id AS action_id,
      ah.claim_id,
      ah.approver_employee_id,
      ah.action,
      ah.approval_level,
      coalesce(ah.allow_resubmit, false) AS allow_resubmit,
      ah.notes,
      ah.acted_at
    FROM public.approval_history ah
    WHERE
      EXISTS (SELECT 1 FROM role_scope rs WHERE rs.is_admin)
      OR ah.claim_id IN (SELECT vc.claim_id FROM visible_claim_ids vc)
    ORDER BY ah.claim_id, ah.acted_at DESC, ah.id DESC
  )
  SELECT
    la.action_id,
    la.claim_id,
    c.claim_number,
    c.claim_date,
    wl.location_name AS work_location,
    c.total_amount,
    cs.status_code AS claim_status,
    cs.status_name AS claim_status_name,
    cs.display_color AS claim_status_display_color,
    owner_emp.employee_name AS owner_name,
    owner_desig.designation_name AS owner_designation,
    actor_emp.employee_email AS actor_email,
    actor_desig.designation_name AS actor_designation,
    la.action,
    la.approval_level,
    la.notes,
    la.acted_at,
    hod_event.hod_approved_at,
    finance_event.finance_approved_at
  FROM latest_actions la
  JOIN public.expense_claims c ON c.id = la.claim_id
  JOIN public.claim_statuses cs ON cs.id = c.status_id
  JOIN public.employees owner_emp ON owner_emp.id = c.employee_id
  LEFT JOIN public.work_locations wl ON wl.id = c.work_location_id
  LEFT JOIN public.designations owner_desig ON owner_desig.id = owner_emp.designation_id
  LEFT JOIN public.employees actor_emp ON actor_emp.id = la.approver_employee_id
  LEFT JOIN public.designations actor_desig ON actor_desig.id = actor_emp.designation_id
  LEFT JOIN LATERAL (
    SELECT ah_hod.acted_at AS hod_approved_at
    FROM public.approval_history ah_hod
    JOIN public.claim_statuses to_status ON to_status.id = ah_hod.new_status_id
    WHERE ah_hod.claim_id = c.id
      AND to_status.approval_level = 3
      AND to_status.is_approval = false
      AND to_status.is_rejection = false
      AND to_status.is_terminal = false
    ORDER BY ah_hod.acted_at DESC
    LIMIT 1
  ) hod_event ON true
  LEFT JOIN LATERAL (
    SELECT fa.acted_at AS finance_approved_at
    FROM public.finance_actions fa
    WHERE fa.claim_id = c.id
      AND EXISTS (
        SELECT 1
        FROM payment_issued_actions pia
        WHERE pia.action_code = CASE
          WHEN fa.action LIKE 'finance_%' THEN substr(fa.action, length('finance_') + 1)
          ELSE fa.action
        END
      )
    ORDER BY fa.acted_at DESC
    LIMIT 1
  ) finance_event ON true
  WHERE
    (
      EXISTS (SELECT 1 FROM role_scope rs WHERE rs.is_admin)
      OR c.id IN (SELECT vc.claim_id FROM visible_claim_ids vc)
    )
    AND (
      p_name_search IS NULL
      OR trim(p_name_search) = ''
      OR owner_emp.employee_name ILIKE ('%' || trim(p_name_search) || '%')
    )
    AND (
      p_claim_status_id IS NULL
      OR cs.id = p_claim_status_id
    )
    AND (
      p_claim_allow_resubmit IS NULL
      OR la.allow_resubmit = p_claim_allow_resubmit
    )
    AND (
      p_claim_status IS NULL
      OR trim(p_claim_status) = ''
      OR cs.status_code = trim(p_claim_status)
    )
    AND (
      p_amount_value IS NULL
      OR (
        coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'gte'
        AND c.total_amount >= p_amount_value
      )
      OR (
        coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'eq'
        AND c.total_amount = p_amount_value
      )
      OR (
        coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'lte'
        AND c.total_amount <= p_amount_value
      )
    )
    AND (
      p_location_type IS NULL
      OR trim(p_location_type) = ''
      OR (
        lower(trim(p_location_type)) = 'outstation'
        AND EXISTS (
          SELECT 1
          FROM public.work_locations wlo
          WHERE wlo.id = c.work_location_id
            AND wlo.requires_outstation_details = true
        )
      )
      OR (
        lower(trim(p_location_type)) = 'base'
        AND EXISTS (
          SELECT 1
          FROM public.work_locations wlb
          WHERE wlb.id = c.work_location_id
            AND wlb.requires_outstation_details = false
            AND wlb.requires_vehicle_selection = true
        )
      )
    )
    AND (
      p_claim_date_from IS NULL
      OR c.claim_date >= p_claim_date_from
    )
    AND (
      p_claim_date_to IS NULL
      OR c.claim_date <= p_claim_date_to
    )
    AND (
      p_hod_approved_from IS NULL
      OR hod_event.hod_approved_at >= p_hod_approved_from
    )
    AND (
      p_hod_approved_to IS NULL
      OR hod_event.hod_approved_at <= p_hod_approved_to
    )
    AND (
      p_finance_approved_from IS NULL
      OR finance_event.finance_approved_at >= p_finance_approved_from
    )
    AND (
      p_finance_approved_to IS NULL
      OR finance_event.finance_approved_at <= p_finance_approved_to
    )
    AND (
      p_cursor_acted_at IS NULL
      OR p_cursor_action_id IS NULL
      OR la.acted_at < p_cursor_acted_at
      OR (la.acted_at = p_cursor_acted_at AND la.action_id < p_cursor_action_id)
    )
  ORDER BY la.acted_at DESC, la.action_id DESC
  LIMIT greatest(coalesce(p_limit, 10), 1) + 1;
$function$;


-- ============================================================
-- 2. Restore get_approval_history_analytics → original version
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_approval_history_analytics(
  p_name_search           text                     DEFAULT NULL,
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
RETURNS TABLE(
  approved_count       bigint,
  approved_amount      numeric,
  payment_issued_count bigint,
  payment_issued_amount numeric,
  rejected_count       bigint,
  rejected_amount      numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH payment_issued_actions AS (
    SELECT DISTINCT
      CASE
        WHEN coalesce(to_status.is_payment_issued, false) = true
          AND cst.action_code LIKE 'finance_%'
          THEN substr(cst.action_code, length('finance_') + 1)
        ELSE cst.action_code
      END AS action_code
    FROM public.claim_status_transitions cst
    JOIN public.claim_statuses to_status ON to_status.id = cst.to_status_id
    WHERE cst.is_active = true
      AND to_status.is_active = true
      AND coalesce(to_status.is_payment_issued, false) = true
  ),
  role_scope AS (
    SELECT
      bool_or(r.is_admin_role) AS is_admin,
      bool_or(r.role_code = 'FINANCE_TEAM') AS is_finance
    FROM public.employees cur
    JOIN public.employee_roles er ON er.employee_id = cur.id
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.is_active = true
      AND lower(cur.employee_email) = current_user_email()
  ),
  latest_actions AS (
    SELECT DISTINCT ON (ah.claim_id)
      ah.claim_id,
      ah.action,
      coalesce(ah.allow_resubmit, false) AS allow_resubmit,
      ah.acted_at
    FROM public.approval_history ah
    ORDER BY ah.claim_id, ah.acted_at DESC, ah.id DESC
  ),
  filtered_claims AS (
    SELECT
      c.id,
      c.total_amount,
      coalesce(cs.is_payment_issued, false) AS is_payment_issued,
      coalesce(cs.is_rejection, false) AS is_rejection
    FROM latest_actions la
    JOIN public.expense_claims c ON c.id = la.claim_id
    JOIN public.claim_statuses cs ON cs.id = c.status_id
    JOIN public.employees owner_emp ON owner_emp.id = c.employee_id
    LEFT JOIN LATERAL (
      SELECT ah_hod.acted_at AS hod_approved_at
      FROM public.approval_history ah_hod
      JOIN public.claim_statuses to_status ON to_status.id = ah_hod.new_status_id
      WHERE ah_hod.claim_id = c.id
        AND to_status.approval_level = 3
        AND to_status.is_approval = false
        AND to_status.is_rejection = false
        AND to_status.is_terminal = false
      ORDER BY ah_hod.acted_at DESC
      LIMIT 1
    ) hod_event ON true
    LEFT JOIN LATERAL (
      SELECT fa.acted_at AS finance_approved_at
      FROM public.finance_actions fa
      WHERE fa.claim_id = c.id
        AND EXISTS (
          SELECT 1
          FROM payment_issued_actions pia
          WHERE pia.action_code = CASE
            WHEN fa.action LIKE 'finance_%' THEN substr(fa.action, length('finance_') + 1)
            ELSE fa.action
          END
        )
      ORDER BY fa.acted_at DESC
      LIMIT 1
    ) finance_event ON true
    WHERE
      (
        c.id IN (SELECT public.get_my_approver_acted_claim_ids())
        OR coalesce((SELECT rs.is_admin FROM role_scope rs LIMIT 1), false)
        OR (
          coalesce((SELECT rs.is_finance FROM role_scope rs LIMIT 1), false)
          AND c.status_id IN (SELECT public.get_finance_visible_status_ids())
        )
      )
      AND (
        p_name_search IS NULL
        OR trim(p_name_search) = ''
        OR owner_emp.employee_name ILIKE ('%' || trim(p_name_search) || '%')
      )
      AND (
        p_claim_status_id IS NULL
        OR cs.id = p_claim_status_id
      )
      AND (
        p_claim_allow_resubmit IS NULL
        OR la.allow_resubmit = p_claim_allow_resubmit
      )
      AND (
        p_amount_value IS NULL
        OR (
          coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'gte'
          AND c.total_amount >= p_amount_value
        )
        OR (
          coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'eq'
          AND c.total_amount = p_amount_value
        )
        OR (
          coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'lte'
          AND c.total_amount <= p_amount_value
        )
      )
      AND (
        p_location_type IS NULL
        OR trim(p_location_type) = ''
        OR (
          lower(trim(p_location_type)) = 'outstation'
          AND EXISTS (
            SELECT 1
            FROM public.work_locations wlo
            WHERE wlo.id = c.work_location_id
              AND wlo.requires_outstation_details = true
          )
        )
        OR (
          lower(trim(p_location_type)) = 'base'
          AND EXISTS (
            SELECT 1
            FROM public.work_locations wlb
            WHERE wlb.id = c.work_location_id
              AND wlb.requires_outstation_details = false
              AND wlb.requires_vehicle_selection = true
          )
        )
      )
      AND (
        p_claim_date_from IS NULL
        OR c.claim_date >= p_claim_date_from
      )
      AND (
        p_claim_date_to IS NULL
        OR c.claim_date <= p_claim_date_to
      )
      AND (
        p_hod_approved_from IS NULL
        OR hod_event.hod_approved_at >= p_hod_approved_from
      )
      AND (
        p_hod_approved_to IS NULL
        OR hod_event.hod_approved_at <= p_hod_approved_to
      )
      AND (
        p_finance_approved_from IS NULL
        OR finance_event.finance_approved_at >= p_finance_approved_from
      )
      AND (
        p_finance_approved_to IS NULL
        OR finance_event.finance_approved_at <= p_finance_approved_to
      )
  )
  SELECT
    count(*) FILTER (WHERE is_rejection = false)::bigint AS approved_count,
    coalesce(sum(total_amount) FILTER (WHERE is_rejection = false), 0)::numeric AS approved_amount,
    count(*) FILTER (WHERE is_payment_issued = true)::bigint AS payment_issued_count,
    coalesce(sum(total_amount) FILTER (WHERE is_payment_issued = true), 0)::numeric AS payment_issued_amount,
    count(*) FILTER (WHERE is_rejection = true)::bigint AS rejected_count,
    coalesce(sum(total_amount) FILTER (WHERE is_rejection = true), 0)::numeric AS rejected_amount
  FROM filtered_claims;
$function$;
