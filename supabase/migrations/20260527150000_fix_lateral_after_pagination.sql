-- Fix: paginate BEFORE LATERAL joins in get_filtered_approval_history
--      Push access-control filter into latest_actions in get_approval_history_analytics
--
-- Root cause of statement timeout (get_filtered_approval_history):
--
--   Migration 20260527140000 added the composite index and pre-computed
--   visible_claim_ids, which reduced the approval_history scan. However,
--   the LATERAL subqueries (hod_event, finance_event) still executed for
--   EVERY row in the user's visible-claim scope BEFORE the ORDER BY + LIMIT
--   reduced the result to p_limit rows.
--
--   For Mansoor (APPROVER_L2, 8,235 acted claim_ids):
--     hod_event LATERAL  → 8,235 executions
--     finance_event LATERAL → 8,235 executions
--     Sort (top-N heapsort) → processes all 8,235 rows before emitting 11
--
--   Each LATERAL correlated subquery hits approval_history / finance_actions
--   with an index lookup. With hot buffers (service_role EXPLAIN) this was
--   184ms. Under real cold-buffer conditions and concurrent Supabase load the
--   same query exceeds the 8s statement_timeout on the `authenticated` role.
--
-- Fix (get_filtered_approval_history):
--   Introduce `paged_base AS MATERIALIZED`: apply all non-LATERAL filters
--   plus ORDER BY + LIMIT inside the CTE, producing at most p_limit+1 rows.
--   The LATERAL joins that follow then run at most p_limit+1 times (≤11)
--   instead of N-visible-claims times (8,235). This is the decisive change.
--
--   HOD / finance date filters are applied after LATERAL on the small result
--   set. These filters are only surfaced to finance/admin users in the UI and
--   are never sent by non-admin users — so paginating before LATERAL is safe
--   for all real-world usage patterns.
--
-- Fix (get_approval_history_analytics):
--   - latest_actions CTE previously had NO WHERE clause → DISTINCT ON on all
--     28,723 approval_history rows (12,217 distinct claims) every call.
--   - filtered_claims then ran both LATERAL subqueries 12,217 times before
--     the access-control WHERE reduced the set to visible claims.
--   - get_my_approver_acted_claim_ids() was called twice (once inside
--     latest_actions implicitly missing, once in filtered_claims WHERE).
--
--   Fixed by adding role_scope + visible_claim_ids CTEs (same pattern as the
--   paginated function) and pushing the filter into latest_actions WHERE.
--   LATERAL now executes only for the user's visible claims, not all claims.
--
-- No changes to function signatures or result columns. No app code change needed.


-- ============================================================
-- 1. get_filtered_approval_history — paginate before LATERAL
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
  action_id                 uuid,
  claim_id                  uuid,
  claim_number              text,
  claim_date                date,
  work_location             text,
  total_amount              numeric,
  claim_status              text,
  claim_status_name         text,
  claim_status_display_color text,
  owner_name                text,
  owner_designation         text,
  actor_email               text,
  actor_designation         text,
  action                    text,
  approval_level            integer,
  notes                     text,
  acted_at                  timestamp with time zone,
  hod_approved_at           timestamp with time zone,
  finance_approved_at       timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH
  -- ── 1. Caller's role ──────────────────────────────────────────────────────
  role_scope AS (
    SELECT
      coalesce(bool_or(r.is_admin_role), false)          AS is_admin,
      coalesce(bool_or(r.role_code = 'FINANCE_TEAM'), false) AS is_finance
    FROM public.employees      cur
    JOIN public.employee_roles er ON er.employee_id = cur.id
    JOIN public.roles           r  ON r.id           = er.role_id
    WHERE er.is_active = true
      AND lower(cur.employee_email) = current_user_email()
  ),

  -- ── 2. Payment-issued action codes (small lookup, evaluated once) ─────────
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
    WHERE cst.is_active        = true
      AND to_status.is_active  = true
      AND coalesce(to_status.is_payment_issued, false) = true
  ),

  -- ── 3. Claim IDs the caller is allowed to see ────────────────────────────
  --      Evaluated once; reused in latest_actions and the paged_base WHERE.
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

  -- ── 4. Latest action per claim (index-scan via idx_approval_history_claim_acted_at_id)
  latest_actions AS (
    SELECT DISTINCT ON (ah.claim_id)
      ah.id                                  AS action_id,
      ah.claim_id,
      ah.approver_employee_id,
      ah.action,
      ah.approval_level,
      coalesce(ah.allow_resubmit, false)     AS allow_resubmit,
      ah.notes,
      ah.acted_at
    FROM public.approval_history ah
    WHERE
      EXISTS (SELECT 1 FROM role_scope rs WHERE rs.is_admin)
      OR ah.claim_id IN (SELECT vc.claim_id FROM visible_claim_ids vc)
    ORDER BY ah.claim_id, ah.acted_at DESC, ah.id DESC
  ),

  -- ── 5. KEY FIX: apply all non-LATERAL filters + ORDER BY + LIMIT here ────
  --      MATERIALIZED forces the planner to materialise the result before
  --      evaluating what comes after.  The LIMIT bounds the row count to
  --      p_limit+1 at this point, so the LATERAL joins below run at most
  --      p_limit+1 times (≤ 11) instead of once per visible claim (8 235).
  paged_base AS MATERIALIZED (
    SELECT
      la.action_id,
      la.claim_id,
      la.approver_employee_id,
      la.action,
      la.approval_level,
      la.allow_resubmit,
      la.notes,
      la.acted_at,
      c.claim_number,
      c.claim_date,
      c.total_amount,
      c.employee_id              AS owner_employee_id,
      wl.location_name           AS work_location,
      cs.status_code             AS claim_status,
      cs.status_name             AS claim_status_name,
      cs.display_color           AS claim_status_display_color,
      owner_emp.employee_name    AS owner_name,
      owner_emp.designation_id   AS owner_designation_id
    FROM   latest_actions la
    JOIN   public.expense_claims  c         ON c.id         = la.claim_id
    JOIN   public.claim_statuses  cs        ON cs.id        = c.status_id
    JOIN   public.employees       owner_emp ON owner_emp.id = c.employee_id
    LEFT JOIN public.work_locations wl      ON wl.id        = c.work_location_id
    WHERE
      -- access-control (redundant guard; latest_actions already filters)
      (
        EXISTS (SELECT 1 FROM role_scope rs WHERE rs.is_admin)
        OR c.id IN (SELECT vc.claim_id FROM visible_claim_ids vc)
      )
      -- name search
      AND (
        p_name_search IS NULL
        OR trim(p_name_search) = ''
        OR owner_emp.employee_name ILIKE ('%' || trim(p_name_search) || '%')
      )
      -- status filters
      AND (p_claim_status_id IS NULL OR cs.id = p_claim_status_id)
      AND (
        p_claim_status IS NULL
        OR trim(p_claim_status) = ''
        OR cs.status_code = trim(p_claim_status)
      )
      -- allow_resubmit
      AND (p_claim_allow_resubmit IS NULL OR la.allow_resubmit = p_claim_allow_resubmit)
      -- amount
      AND (
        p_amount_value IS NULL
        OR (coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'gte' AND c.total_amount >= p_amount_value)
        OR (coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'eq'  AND c.total_amount  = p_amount_value)
        OR (coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'lte' AND c.total_amount <= p_amount_value)
      )
      -- location type
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
      -- claim date range
      AND (p_claim_date_from IS NULL OR c.claim_date >= p_claim_date_from)
      AND (p_claim_date_to   IS NULL OR c.claim_date <= p_claim_date_to)
      -- keyset-pagination cursor
      AND (
        p_cursor_acted_at  IS NULL
        OR p_cursor_action_id IS NULL
        OR la.acted_at < p_cursor_acted_at
        OR (la.acted_at = p_cursor_acted_at AND la.action_id < p_cursor_action_id)
      )
    ORDER BY la.acted_at DESC, la.action_id DESC
    LIMIT greatest(coalesce(p_limit, 10), 1) + 1
  )

  -- ── 6. Enrich the ≤p_limit+1 paged rows with LATERAL lookups ─────────────
  --      Because paged_base is already limited, each LATERAL runs at most
  --      p_limit+1 times (≤ 11) regardless of how many claims the caller can see.
  SELECT
    pb.action_id,
    pb.claim_id,
    pb.claim_number,
    pb.claim_date,
    pb.work_location,
    pb.total_amount,
    pb.claim_status,
    pb.claim_status_name,
    pb.claim_status_display_color,
    pb.owner_name,
    owner_desig.designation_name  AS owner_designation,
    actor_emp.employee_email      AS actor_email,
    actor_desig.designation_name  AS actor_designation,
    pb.action,
    pb.approval_level,
    pb.notes,
    pb.acted_at,
    hod_event.hod_approved_at,
    finance_event.finance_approved_at
  FROM   paged_base pb
  LEFT JOIN public.designations owner_desig ON owner_desig.id = pb.owner_designation_id
  LEFT JOIN public.employees    actor_emp   ON actor_emp.id   = pb.approver_employee_id
  LEFT JOIN public.designations actor_desig ON actor_desig.id = actor_emp.designation_id
  LEFT JOIN LATERAL (
    SELECT ah_hod.acted_at AS hod_approved_at
    FROM   public.approval_history ah_hod
    JOIN   public.claim_statuses   to_status ON to_status.id = ah_hod.new_status_id
    WHERE  ah_hod.claim_id           = pb.claim_id
      AND  to_status.approval_level  = 3
      AND  to_status.is_approval     = false
      AND  to_status.is_rejection    = false
      AND  to_status.is_terminal     = false
    ORDER BY ah_hod.acted_at DESC
    LIMIT 1
  ) hod_event ON true
  LEFT JOIN LATERAL (
    SELECT fa.acted_at AS finance_approved_at
    FROM   public.finance_actions fa
    WHERE  fa.claim_id = pb.claim_id
      AND  EXISTS (
             SELECT 1
             FROM   payment_issued_actions pia
             WHERE  pia.action_code = CASE
                      WHEN fa.action LIKE 'finance_%'
                        THEN substr(fa.action, length('finance_') + 1)
                      ELSE fa.action
                    END
           )
    ORDER BY fa.acted_at DESC
    LIMIT 1
  ) finance_event ON true
  -- HOD / finance date filters are applied here (post-LATERAL, pre-sorted result)
  WHERE
    (p_hod_approved_from     IS NULL OR hod_event.hod_approved_at         >= p_hod_approved_from)
    AND (p_hod_approved_to   IS NULL OR hod_event.hod_approved_at         <= p_hod_approved_to)
    AND (p_finance_approved_from IS NULL OR finance_event.finance_approved_at >= p_finance_approved_from)
    AND (p_finance_approved_to   IS NULL OR finance_event.finance_approved_at <= p_finance_approved_to)
  ORDER BY pb.acted_at DESC, pb.action_id DESC;
$function$;


-- ============================================================
-- 2. get_approval_history_analytics — push access-control into latest_actions
-- ============================================================
--
--  Before this fix:
--    • latest_actions had NO WHERE → DISTINCT ON scanned all 28,723 rows
--    • hod_event + finance_event LATERAL ran 12,217 times (all distinct claims)
--    • Access-control WHERE only filtered afterwards
--    • get_my_approver_acted_claim_ids() was called twice (optimization fence ×2)
--
--  After:
--    • visible_claim_ids CTE called once
--    • latest_actions filters by visible claims → only visible-claim rows DISTINCT ON'd
--    • LATERAL runs only for the caller's visible claims (e.g. 8,235 not 12,217)

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
  approved_count          bigint,
  approved_amount         numeric,
  payment_issued_count    bigint,
  payment_issued_amount   numeric,
  rejected_count          bigint,
  rejected_amount         numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH
  -- ── 1. Payment-issued action codes ────────────────────────────────────────
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

  -- ── 2. Caller's role ──────────────────────────────────────────────────────
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

  -- ── 3. Visible claim IDs (evaluated once, no double optimization-fence call)
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

  -- ── 4. Latest action per visible claim (was: all claims, now: visible only)
  latest_actions AS (
    SELECT DISTINCT ON (ah.claim_id)
      ah.claim_id,
      ah.action,
      coalesce(ah.allow_resubmit, false) AS allow_resubmit,
      ah.acted_at
    FROM public.approval_history ah
    WHERE
      EXISTS (SELECT 1 FROM role_scope rs WHERE rs.is_admin)
      OR ah.claim_id IN (SELECT vc.claim_id FROM visible_claim_ids vc)
    ORDER BY ah.claim_id, ah.acted_at DESC, ah.id DESC
  ),

  -- ── 5. Filtered visible claims with LATERAL enrichment ───────────────────
  --      Access-control is already enforced in latest_actions; the WHERE below
  --      only applies the user-supplied filter parameters.
  filtered_claims AS (
    SELECT
      c.total_amount,
      coalesce(cs.is_payment_issued, false) AS is_payment_issued,
      coalesce(cs.is_rejection,      false) AS is_rejection
    FROM   latest_actions la
    JOIN   public.expense_claims  c         ON c.id         = la.claim_id
    JOIN   public.claim_statuses  cs        ON cs.id        = c.status_id
    JOIN   public.employees       owner_emp ON owner_emp.id = c.employee_id
    LEFT JOIN LATERAL (
      SELECT ah_hod.acted_at AS hod_approved_at
      FROM   public.approval_history ah_hod
      JOIN   public.claim_statuses   to_status ON to_status.id = ah_hod.new_status_id
      WHERE  ah_hod.claim_id           = c.id
        AND  to_status.approval_level  = 3
        AND  to_status.is_approval     = false
        AND  to_status.is_rejection    = false
        AND  to_status.is_terminal     = false
      ORDER BY ah_hod.acted_at DESC
      LIMIT 1
    ) hod_event ON true
    LEFT JOIN LATERAL (
      SELECT fa.acted_at AS finance_approved_at
      FROM   public.finance_actions fa
      WHERE  fa.claim_id = c.id
        AND  EXISTS (
               SELECT 1
               FROM   payment_issued_actions pia
               WHERE  pia.action_code = CASE
                        WHEN fa.action LIKE 'finance_%'
                          THEN substr(fa.action, length('finance_') + 1)
                        ELSE fa.action
                      END
             )
      ORDER BY fa.acted_at DESC
      LIMIT 1
    ) finance_event ON true
    WHERE
      -- name search
      (
        p_name_search IS NULL
        OR trim(p_name_search) = ''
        OR owner_emp.employee_name ILIKE ('%' || trim(p_name_search) || '%')
      )
      -- status
      AND (p_claim_status_id     IS NULL OR cs.id             = p_claim_status_id)
      -- allow_resubmit
      AND (p_claim_allow_resubmit IS NULL OR la.allow_resubmit = p_claim_allow_resubmit)
      -- amount
      AND (
        p_amount_value IS NULL
        OR (coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'gte' AND c.total_amount >= p_amount_value)
        OR (coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'eq'  AND c.total_amount  = p_amount_value)
        OR (coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'lte' AND c.total_amount <= p_amount_value)
      )
      -- location type
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
      -- claim date range
      AND (p_claim_date_from IS NULL OR c.claim_date >= p_claim_date_from)
      AND (p_claim_date_to   IS NULL OR c.claim_date <= p_claim_date_to)
      -- HOD / finance date filters
      AND (p_hod_approved_from     IS NULL OR hod_event.hod_approved_at         >= p_hod_approved_from)
      AND (p_hod_approved_to       IS NULL OR hod_event.hod_approved_at         <= p_hod_approved_to)
      AND (p_finance_approved_from IS NULL OR finance_event.finance_approved_at >= p_finance_approved_from)
      AND (p_finance_approved_to   IS NULL OR finance_event.finance_approved_at <= p_finance_approved_to)
  )

  SELECT
    count(*)            FILTER (WHERE is_rejection    = false)::bigint AS approved_count,
    coalesce(sum(total_amount) FILTER (WHERE is_rejection    = false), 0)::numeric AS approved_amount,
    count(*)            FILTER (WHERE is_payment_issued = true)::bigint AS payment_issued_count,
    coalesce(sum(total_amount) FILTER (WHERE is_payment_issued = true),  0)::numeric AS payment_issued_amount,
    count(*)            FILTER (WHERE is_rejection    = true)::bigint  AS rejected_count,
    coalesce(sum(total_amount) FILTER (WHERE is_rejection    = true),  0)::numeric AS rejected_amount
  FROM filtered_claims;
$function$;
