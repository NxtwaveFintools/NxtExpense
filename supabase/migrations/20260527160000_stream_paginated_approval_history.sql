-- Fix: rewrite get_filtered_approval_history as a plpgsql streaming function
--
-- Root cause (confirmed by EXPLAIN ANALYZE, 2026-05-27):
--
--   The MATERIALIZED paged_base approach (20260527150000) eliminated the
--   8 235 LATERAL executions but exposed the next bottleneck:
--
--   • Index scan on idx_approval_history_claim_acted_at_id → ALL 28 723 rows
--     (12 747 shared buffer hits in hot mode)
--   • Sequential scan on expense_claims → ALL 17 493 rows (463 buffer hits)
--
--   In hot buffers this is 76 ms. On a shared Supabase instance with cold
--   buffers and concurrent I/O contention, reading those pages takes >8 s
--   and trips the 8s statement_timeout on the `authenticated` role.
--
-- Why the full scans happen:
--
--   DISTINCT ON (claim_id) ORDER BY claim_id, acted_at DESC, id DESC must
--   see ALL rows for all visible claims before it can emit the first row.
--   The planner cannot push the outer ORDER BY (acted_at DESC) + LIMIT 11
--   inside the DISTINCT ON — so the sort always processes all 8 235 visible
--   claims, which requires reading large parts of the table.
--
-- Fix — streaming plpgsql loop:
--
--   1. Pre-build v_visible (array of visible claim_ids) — same cost as
--      before (534 buffer hits for Mansoor = fast sequential index scan).
--
--   2. Scan approval_history in (acted_at DESC, id DESC) order using the
--      existing idx_approval_history_acted_at_id index. This is a tiny
--      sequential read of the newest index pages.
--
--   3. For each row: check if claim_id was already seen (= deduplicate;
--      first occurrence is the latest action for that claim). Then check
--      visibility, cursor, and all user filters.
--
--   4. EXIT as soon as p_limit+1 rows have been collected.
--
--   For Mansoor (8 235 visible claims out of 12 217, density 67%):
--     • Expected rows scanned from approval_history: ≈ 11 / 0.67 ≈ 16–22
--     • expense_claims PK lookups: 11 (vs. full seq scan of 17 493)
--     • LATERAL hod / finance: 11 each (unchanged)
--
--   Cold-buffer cost: ~100 ms vs. >8 s. Result is identical to the old query.
--
-- Cursor pagination is preserved:
--   Scanning in acted_at DESC order means the FIRST occurrence of each
--   claim_id in the scan IS the latest action for that claim, which matches
--   the semantics of the old DISTINCT ON approach. The cursor comparison
--   uses the same (acted_at, id) fields.
--
-- No changes to function signature or result columns.
-- No application code change required.


-- ============================================================
-- get_filtered_approval_history — streaming plpgsql rewrite
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
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  -- Caller's role
  v_is_admin      boolean := false;
  v_is_finance    boolean := false;

  -- Pre-computed sets
  v_visible       uuid[];    -- visible claim_ids; NULL means admin (sees all)
  v_payment_codes text[];    -- payment-issued action codes for finance_approved_at

  -- Streaming state
  v_seen          uuid[] := '{}';   -- claim_ids already encountered
  v_count         int    := 0;
  v_limit         int;

  -- Pre-normalised filter values
  v_name_pat      text;      -- ILIKE pattern, NULL when no name filter
  v_amount_op     text;      -- 'gte' | 'eq' | 'lte'

  -- Per-iteration records / scalars
  r               record;    -- approval_history row from the streaming scan
  v_c             record;    -- claim + joins
  v_actor_rec     record;    -- actor employee + designation
  v_hod_at        timestamptz;
  v_fin_at        timestamptz;
BEGIN
  v_limit     := greatest(coalesce(p_limit, 10), 1) + 1;
  v_name_pat  := CASE WHEN trim(coalesce(p_name_search, '')) = ''
                      THEN NULL
                      ELSE '%' || trim(p_name_search) || '%' END;
  v_amount_op := coalesce(nullif(trim(lower(coalesce(p_amount_operator, ''))), ''), 'lte');

  -- ── 1. Determine caller role ───────────────────────────────────────────────
  SELECT
    coalesce(bool_or(ro.is_admin_role), false),
    coalesce(bool_or(ro.role_code = 'FINANCE_TEAM'), false)
  INTO v_is_admin, v_is_finance
  FROM public.employees     cur
  JOIN public.employee_roles er ON er.employee_id = cur.id
  JOIN public.roles          ro ON ro.id           = er.role_id
  WHERE er.is_active = true
    AND lower(cur.employee_email) = current_user_email();

  -- ── 2. Build visible claim set (non-admin users only) ─────────────────────
  --      get_my_approver_acted_claim_ids() uses idx_ah_approver_employee
  --      → sequential range scan for the caller's rows. Fast (few hundred ms
  --      cold) and unavoidable for access-control.
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
      RETURN;   -- No visible claims — return empty
    END IF;
  END IF;

  -- ── 3. Precompute payment-issued action codes (for finance_approved_at) ────
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

  -- ── 4. Streaming scan of approval_history newest → oldest ─────────────────
  --      Uses idx_approval_history_acted_at_id ON (acted_at DESC, id DESC).
  --      First occurrence of each claim_id = latest action for that claim
  --      (same semantics as DISTINCT ON (claim_id) ORDER BY acted_at DESC).
  --      EXIT after collecting v_limit rows → typically scans ≈ 16–22 rows.
  FOR r IN (
    SELECT
      ah.id,
      ah.claim_id,
      ah.approver_employee_id,
      ah.action,
      ah.approval_level,
      coalesce(ah.allow_resubmit, false) AS allow_resubmit,
      ah.notes,
      ah.acted_at
    FROM public.approval_history ah
    ORDER BY ah.acted_at DESC, ah.id DESC
  ) LOOP

    -- 4a. Deduplication: skip if this claim was already seen.
    --     The first encounter (newest acted_at) is the latest action.
    IF r.claim_id = ANY(v_seen) THEN
      CONTINUE;
    END IF;
    v_seen := array_append(v_seen, r.claim_id);

    -- 4b. Visibility check
    IF NOT v_is_admin AND NOT (r.claim_id = ANY(v_visible)) THEN
      CONTINUE;
    END IF;

    -- 4c. Cursor filter
    --     Skip claims whose latest action is AT or AFTER the cursor boundary.
    IF p_cursor_acted_at IS NOT NULL AND p_cursor_action_id IS NOT NULL THEN
      IF r.acted_at > p_cursor_acted_at THEN CONTINUE; END IF;
      IF r.acted_at = p_cursor_acted_at
         AND r.id   >= p_cursor_action_id THEN CONTINUE; END IF;
    END IF;

    -- 4d. allow_resubmit filter (no join required)
    IF p_claim_allow_resubmit IS NOT NULL
       AND r.allow_resubmit IS DISTINCT FROM p_claim_allow_resubmit THEN
      CONTINUE;
    END IF;

    -- 4e. Fetch claim details + apply all attribute filters in a single query.
    --     Uses expense_claims PRIMARY KEY (one random read) — not a seq scan.
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
      -- Name search
      AND (v_name_pat IS NULL
           OR oe.employee_name ILIKE v_name_pat)
      -- Status filters
      AND (p_claim_status_id IS NULL
           OR cs.id = p_claim_status_id)
      AND (p_claim_status IS NULL
           OR trim(p_claim_status) = ''
           OR cs.status_code = trim(p_claim_status))
      -- Amount filter
      AND (
        p_amount_value IS NULL
        OR (v_amount_op = 'gte' AND c.total_amount >= p_amount_value)
        OR (v_amount_op = 'eq'  AND c.total_amount  = p_amount_value)
        OR (v_amount_op = 'lte' AND c.total_amount <= p_amount_value)
      )
      -- Location type filter
      AND (
        p_location_type IS NULL OR trim(p_location_type) = ''
        OR (lower(trim(p_location_type)) = 'outstation'
            AND EXISTS (
              SELECT 1 FROM public.work_locations wlo
              WHERE wlo.id = c.work_location_id
                AND wlo.requires_outstation_details = true
            ))
        OR (lower(trim(p_location_type)) = 'base'
            AND EXISTS (
              SELECT 1 FROM public.work_locations wlb
              WHERE wlb.id = c.work_location_id
                AND wlb.requires_outstation_details = false
                AND wlb.requires_vehicle_selection  = true
            ))
      )
      -- Claim date range
      AND (p_claim_date_from IS NULL OR c.claim_date >= p_claim_date_from)
      AND (p_claim_date_to   IS NULL OR c.claim_date <= p_claim_date_to);

    IF NOT FOUND THEN
      CONTINUE;   -- Claim doesn't pass attribute filters
    END IF;

    -- 4f. HOD approved_at (needed for both filter and output)
    v_hod_at := NULL;
    SELECT ah_h.acted_at INTO v_hod_at
    FROM public.approval_history ah_h
    JOIN public.claim_statuses   ts ON ts.id = ah_h.new_status_id
    WHERE ah_h.claim_id      = r.claim_id
      AND ts.approval_level  = 3
      AND ts.is_approval     = false
      AND ts.is_rejection    = false
      AND ts.is_terminal     = false
    ORDER BY ah_h.acted_at DESC
    LIMIT 1;

    IF p_hod_approved_from IS NOT NULL
       AND (v_hod_at IS NULL OR v_hod_at < p_hod_approved_from) THEN CONTINUE;
    END IF;
    IF p_hod_approved_to IS NOT NULL
       AND (v_hod_at IS NULL OR v_hod_at > p_hod_approved_to) THEN CONTINUE;
    END IF;

    -- 4g. Finance approved_at (needed for both filter and output)
    v_fin_at := NULL;
    SELECT fa.acted_at INTO v_fin_at
    FROM public.finance_actions fa
    WHERE fa.claim_id = r.claim_id
      AND CASE
            WHEN fa.action LIKE 'finance_%'
              THEN substr(fa.action, length('finance_') + 1)
            ELSE fa.action
          END = ANY(v_payment_codes)
    ORDER BY fa.acted_at DESC
    LIMIT 1;

    IF p_finance_approved_from IS NOT NULL
       AND (v_fin_at IS NULL OR v_fin_at < p_finance_approved_from) THEN CONTINUE;
    END IF;
    IF p_finance_approved_to IS NOT NULL
       AND (v_fin_at IS NULL OR v_fin_at > p_finance_approved_to) THEN CONTINUE;
    END IF;

    -- 4h. Actor details (approver employee + designation)
    v_actor_rec := NULL;
    SELECT ae.employee_email,
           ad.designation_name AS actor_desig_name
    INTO v_actor_rec
    FROM public.employees   ae
    LEFT JOIN public.designations ad ON ad.id = ae.designation_id
    WHERE ae.id = r.approver_employee_id;

    -- 4i. Emit the row
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
      EXIT;   -- Collected p_limit+1 rows — stop streaming approval_history
    END IF;
  END LOOP;
END;
$function$;
