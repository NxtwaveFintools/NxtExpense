-- Optimize get_filtered_approval_history (paginated list) for lakh-scale
--
-- Problem (carried over from 20260527160000):
--   The streaming plpgsql loop did two O(N) checks per scanned row IN plpgsql:
--     • dedup:      r.claim_id = ANY(v_seen)      -- v_seen grows as we scan
--     • visibility: r.claim_id = ANY(v_visible)   -- v_visible ~ all visible claims
--   v_visible is a fixed large array (8 235 for Mansoor today, lakhs later) so
--   every scanned row costs a full linear array scan. Worse, under a selective
--   filter (e.g. status = REJECTED) the loop must scan many claims before
--   collecting p_limit+1 matches, and v_seen grows with every one — making the
--   whole loop O(n^2). At lakh scale this collapses.
--
-- Fix — push visibility + dedup into the FOR query so the executor handles them,
-- while keeping the index-ordered scan that enables early EXIT:
--   • Visibility: `ah.claim_id = ANY(v_visible)` as a SQL *filter*. On PG 14+
--     a ScalarArrayOp over a >9-element array is evaluated with a HASH (O(1) per
--     row), and because it is a filter (not a join) the planner keeps the
--     idx_approval_history_acted_at_id ordering — so the loop still streams and
--     EXITs after p_limit+1 rows.
--   • Dedup: a correlated `ORDER BY acted_at DESC, id DESC LIMIT 1` subquery
--     (`ah.id = latest-action-id for this claim`). This is a per-row index
--     lookup via idx_approval_history_claim_acted_at_id (O(log n)); it replaces
--     the unbounded v_seen array entirely. Same tiebreak as the old
--     first-encounter dedup, so results are identical.
--   • Cursor + allow_resubmit moved into the same WHERE (cheap, and lets rows be
--     skipped before the per-row claim fetch).
--
-- The loop body (per-claim attribute filters, hod/finance lookups, actor lookup,
-- row emission, EXIT at p_limit+1) is unchanged. Result rows and ordering are
-- identical to the previous definition (verified against the recorded baseline
-- first-page action_ids for Mansoor).
--
-- Function signature, return columns, volatility (STABLE), and calling code are
-- unchanged.

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
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin      boolean := false;
  v_is_finance    boolean := false;
  v_visible       uuid[];     -- visible claim ids; NULL for admin (sees all)
  v_payment_codes text[];
  v_count         int    := 0;
  v_limit         int;
  v_name_pat      text;
  v_amount_op     text;
  r               record;
  v_c             record;
  v_actor_rec     record;
  v_hod_at        timestamptz;
  v_fin_at        timestamptz;
BEGIN
  v_limit     := greatest(coalesce(p_limit, 10), 1) + 1;
  v_name_pat  := CASE WHEN trim(coalesce(p_name_search, '')) = ''
                      THEN NULL
                      ELSE '%' || trim(p_name_search) || '%' END;
  v_amount_op := coalesce(nullif(trim(lower(coalesce(p_amount_operator, ''))), ''), 'lte');

  -- 1. Caller role
  SELECT
    coalesce(bool_or(ro.is_admin_role), false),
    coalesce(bool_or(ro.role_code = 'FINANCE_TEAM'), false)
  INTO v_is_admin, v_is_finance
  FROM public.employees     cur
  JOIN public.employee_roles er ON er.employee_id = cur.id
  JOIN public.roles          ro ON ro.id           = er.role_id
  WHERE er.is_active = true
    AND lower(cur.employee_email) = current_user_email();

  -- 2. Build visible claim set (non-admin only). Used as a hashed ScalarArrayOp
  --    filter inside the streaming scan below.
  IF NOT v_is_admin THEN
    SELECT array_agg(vc.cid)
    INTO v_visible
    FROM (
      SELECT v2.claim_id AS cid
      FROM public.get_my_approver_acted_claim_ids() AS v2(claim_id)
      UNION
      SELECT c2.id AS cid
      FROM public.expense_claims c2
      WHERE v_is_finance
        AND c2.status_id IN (
          SELECT s2.status_id
          FROM public.get_finance_visible_status_ids() AS s2(status_id)
        )
    ) vc;

    IF v_visible IS NULL THEN
      RETURN;   -- no visible claims
    END IF;
  END IF;

  -- 3. Precompute payment-issued action codes (for finance_approved_at)
  SELECT array_agg(DISTINCT
    CASE
      WHEN coalesce(ts2.is_payment_issued, false)
        AND cst2.action_code LIKE 'finance_%'
        THEN substr(cst2.action_code, length('finance_') + 1)
      ELSE cst2.action_code
    END
  )
  INTO v_payment_codes
  FROM public.claim_status_transitions cst2
  JOIN public.claim_statuses ts2 ON ts2.id = cst2.to_status_id
  WHERE cst2.is_active = true
    AND ts2.is_active  = true
    AND coalesce(ts2.is_payment_issued, false) = true;

  -- 4. Streaming scan: approval_history newest to oldest via
  --    idx_approval_history_acted_at_id (acted_at DESC, id DESC).
  --    Visibility + dedup + cursor + allow_resubmit are applied in SQL so the
  --    loop streams and EXITs after v_limit rows. Dedup keeps only the latest
  --    action per claim (correlated LIMIT 1 subquery), so each claim appears once.
  FOR r IN (
    SELECT
      ah.id,
      ah.claim_id,
      ah.approver_employee_id,
      ah.action,
      ah.approval_level,
      ah.notes,
      ah.acted_at
    FROM public.approval_history ah
    WHERE
      -- visibility (admin sees all; otherwise hashed membership in v_visible)
      (v_is_admin OR ah.claim_id = ANY(v_visible))
      -- dedup: keep only the latest action row per claim
      AND ah.id = (
        SELECT ah_latest.id
        FROM public.approval_history ah_latest
        WHERE ah_latest.claim_id = ah.claim_id
        ORDER BY ah_latest.acted_at DESC, ah_latest.id DESC
        LIMIT 1
      )
      -- cursor (keyset) — compare on the latest action's (acted_at, id)
      AND (
        p_cursor_acted_at IS NULL
        OR p_cursor_action_id IS NULL
        OR ah.acted_at < p_cursor_acted_at
        OR (ah.acted_at = p_cursor_acted_at AND ah.id < p_cursor_action_id)
      )
      -- allow_resubmit filter
      AND (
        p_claim_allow_resubmit IS NULL
        OR coalesce(ah.allow_resubmit, false) = p_claim_allow_resubmit
      )
    ORDER BY ah.acted_at DESC, ah.id DESC
  ) LOOP

    -- 4e. Claim attribute filters (single PK lookup + joins)
    v_c := NULL;
    SELECT
      c.claim_number,
      c.claim_date,
      c.total_amount,
      wl.location_name           AS work_location,
      cs.status_code             AS claim_status,
      cs.status_name             AS claim_status_name,
      cs.display_color           AS claim_status_display_color,
      oe.employee_name           AS owner_name,
      od.designation_name        AS owner_designation
    INTO v_c
    FROM public.expense_claims    c
    JOIN public.claim_statuses    cs ON cs.id = c.status_id
    JOIN public.employees         oe ON oe.id = c.employee_id
    LEFT JOIN public.designations od ON od.id = oe.designation_id
    LEFT JOIN public.work_locations wl ON wl.id = c.work_location_id
    WHERE c.id = r.claim_id
      AND (v_name_pat IS NULL OR oe.employee_name ILIKE v_name_pat)
      AND (p_claim_status_id IS NULL OR cs.id = p_claim_status_id)
      AND (p_claim_status IS NULL OR trim(p_claim_status) = ''
           OR cs.status_code = trim(p_claim_status))
      AND (
        p_amount_value IS NULL
        OR (v_amount_op = 'gte' AND c.total_amount >= p_amount_value)
        OR (v_amount_op = 'eq'  AND c.total_amount  = p_amount_value)
        OR (v_amount_op = 'lte' AND c.total_amount <= p_amount_value)
      )
      AND (
        p_location_type IS NULL OR trim(p_location_type) = ''
        OR (lower(trim(p_location_type)) = 'outstation'
            AND EXISTS (SELECT 1 FROM public.work_locations wlo
                        WHERE wlo.id = c.work_location_id AND wlo.requires_outstation_details = true))
        OR (lower(trim(p_location_type)) = 'base'
            AND EXISTS (SELECT 1 FROM public.work_locations wlb
                        WHERE wlb.id = c.work_location_id
                          AND wlb.requires_outstation_details = false
                          AND wlb.requires_vehicle_selection  = true))
      )
      AND (p_claim_date_from IS NULL OR c.claim_date >= p_claim_date_from)
      AND (p_claim_date_to   IS NULL OR c.claim_date <= p_claim_date_to);

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- 4f. HOD approved_at
    v_hod_at := NULL;
    SELECT ah_h.acted_at INTO v_hod_at
    FROM public.approval_history ah_h
    JOIN public.claim_statuses   ts ON ts.id = ah_h.new_status_id
    WHERE ah_h.claim_id    = r.claim_id
      AND ts.approval_level = 3
      AND ts.is_approval    = false
      AND ts.is_rejection   = false
      AND ts.is_terminal    = false
    ORDER BY ah_h.acted_at DESC LIMIT 1;

    IF p_hod_approved_from IS NOT NULL
       AND (v_hod_at IS NULL OR v_hod_at < p_hod_approved_from) THEN CONTINUE; END IF;
    IF p_hod_approved_to IS NOT NULL
       AND (v_hod_at IS NULL OR v_hod_at > p_hod_approved_to) THEN CONTINUE; END IF;

    -- 4g. Finance approved_at
    v_fin_at := NULL;
    SELECT fa.acted_at INTO v_fin_at
    FROM public.finance_actions fa
    WHERE fa.claim_id = r.claim_id
      AND CASE
            WHEN fa.action LIKE 'finance_%'
              THEN substr(fa.action, length('finance_') + 1)
            ELSE fa.action
          END = ANY(v_payment_codes)
    ORDER BY fa.acted_at DESC LIMIT 1;

    IF p_finance_approved_from IS NOT NULL
       AND (v_fin_at IS NULL OR v_fin_at < p_finance_approved_from) THEN CONTINUE; END IF;
    IF p_finance_approved_to IS NOT NULL
       AND (v_fin_at IS NULL OR v_fin_at > p_finance_approved_to) THEN CONTINUE; END IF;

    -- 4h. Actor details
    v_actor_rec := NULL;
    SELECT ae.employee_email, ad.designation_name AS actor_desig_name
    INTO v_actor_rec
    FROM public.employees   ae
    LEFT JOIN public.designations ad ON ad.id = ae.designation_id
    WHERE ae.id = r.approver_employee_id;

    -- 4i. Emit row
    action_id                  := r.id;
    claim_id                   := r.claim_id;
    claim_number               := v_c.claim_number;
    claim_date                 := v_c.claim_date;
    work_location              := v_c.work_location;
    total_amount               := v_c.total_amount;
    claim_status               := v_c.claim_status;
    claim_status_name          := v_c.claim_status_name;
    claim_status_display_color := v_c.claim_status_display_color;
    owner_name                 := v_c.owner_name;
    owner_designation          := v_c.owner_designation;
    actor_email                := v_actor_rec.employee_email;
    actor_designation          := v_actor_rec.actor_desig_name;
    action                     := r.action;
    approval_level             := r.approval_level;
    notes                      := r.notes;
    acted_at                   := r.acted_at;
    hod_approved_at            := v_hod_at;
    finance_approved_at        := v_fin_at;
    RETURN NEXT;

    v_count := v_count + 1;
    IF v_count >= v_limit THEN
      EXIT;
    END IF;
  END LOOP;
END;
$function$;
