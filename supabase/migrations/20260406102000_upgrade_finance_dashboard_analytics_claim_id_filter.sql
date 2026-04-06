BEGIN;

CREATE OR REPLACE FUNCTION public.get_finance_pending_dashboard_analytics(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_claim_id text DEFAULT NULL,
  p_designation_id uuid DEFAULT NULL,
  p_work_location_id uuid DEFAULT NULL,
  p_state_id uuid DEFAULT NULL,
  p_employee_id text DEFAULT NULL,
  p_employee_name text DEFAULT NULL,
  p_vehicle_code text DEFAULT NULL,
  p_date_filter_field text DEFAULT 'travel_date'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_finance_id uuid;
  v_result jsonb;
  v_date_filter_field text;
BEGIN
  v_finance_id := public.require_finance_actor();
  v_date_filter_field := lower(coalesce(nullif(trim(p_date_filter_field), ''), 'travel_date'));

  IF v_date_filter_field NOT IN ('travel_date', 'submission_date') THEN
    RAISE EXCEPTION 'Invalid date filter field. Expected travel_date or submission_date.';
  END IF;

  WITH finance_status AS (
    SELECT cs.id
    FROM public.claim_statuses cs
    WHERE cs.approval_level = 3
      AND cs.is_approval = false
      AND cs.is_rejection = false
      AND cs.is_terminal = false
      AND cs.is_active = true
    LIMIT 1
  ),
  filtered_claims AS (
    SELECT
      c.id,
      c.total_amount,
      c.designation_id,
      c.work_location_id,
      c.vehicle_type_id,
      c.submitted_at,
      c.employee_id,
      c.claim_date
    FROM public.expense_claims c
    JOIN finance_status fs ON c.status_id = fs.id
    JOIN public.employees e ON e.id = c.employee_id
    WHERE true
      AND (
        p_date_from IS NULL
        OR (
          (v_date_filter_field = 'travel_date' AND c.claim_date >= p_date_from)
          OR (v_date_filter_field = 'submission_date' AND c.submitted_at::date >= p_date_from)
        )
      )
      AND (
        p_date_to IS NULL
        OR (
          (v_date_filter_field = 'travel_date' AND c.claim_date <= p_date_to)
          OR (v_date_filter_field = 'submission_date' AND c.submitted_at::date <= p_date_to)
        )
      )
      AND (
        p_claim_id IS NULL
        OR c.claim_number ILIKE '%' || p_claim_id || '%'
        OR c.id::text ILIKE '%' || p_claim_id || '%'
      )
      AND (p_designation_id IS NULL OR c.designation_id = p_designation_id)
      AND (p_work_location_id IS NULL OR c.work_location_id = p_work_location_id)
      AND (p_employee_id IS NULL OR e.employee_id ILIKE '%' || p_employee_id || '%')
      AND (p_employee_name IS NULL OR e.employee_name ILIKE '%' || p_employee_name || '%')
      AND (
        p_vehicle_code IS NULL
        OR c.vehicle_type_id = (
          SELECT vt.id
          FROM public.vehicle_types vt
          WHERE vt.vehicle_code = p_vehicle_code
            AND vt.is_active = true
          LIMIT 1
        )
      )
      AND (
        p_state_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.employee_states es
          WHERE es.employee_id = c.employee_id
            AND es.state_id = p_state_id
        )
      )
  ),
  kpi AS (
    SELECT
      count(*)::int AS total_count,
      coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
    FROM filtered_claims fc
  ),
  item_totals AS (
    SELECT
      lower(ci.item_type::text) AS item_type_key,
      coalesce(sum(ci.amount), 0)::numeric AS total_amount
    FROM filtered_claims fc
    JOIN public.expense_claim_items ci ON ci.claim_id = fc.id
    GROUP BY 1
  ),
  expense_breakdown_totals AS (
    SELECT
      CASE
        WHEN lower(ci.item_type::text) = 'food'
          AND upper(coalesce(wl.location_code, '')) = 'FIELD_BASE'
          THEN 'food_base'
        WHEN lower(ci.item_type::text) = 'food'
          AND upper(coalesce(wl.location_code, '')) = 'FIELD_OUTSTATION'
          THEN 'food_outstation'
        ELSE lower(ci.item_type::text)
      END AS expense_type,
      coalesce(sum(ci.amount), 0)::numeric AS total_amount
    FROM filtered_claims fc
    JOIN public.expense_claim_items ci ON ci.claim_id = fc.id
    JOIN public.work_locations wl ON wl.id = fc.work_location_id
    GROUP BY 1
  ),
  by_expense_type AS (
    SELECT jsonb_agg(
      jsonb_build_object('expense_type', ebt.expense_type, 'total_amount', ebt.total_amount)
      ORDER BY ebt.total_amount DESC
    ) AS data
    FROM expense_breakdown_totals ebt
  ),
  by_designation AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'designation_name', d.designation_name,
        'total_amount', agg.total_amount,
        'avg_amount', agg.avg_amount,
        'claim_count', agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        fc.designation_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        coalesce(avg(fc.total_amount), 0)::numeric AS avg_amount,
        count(*)::int AS claim_count
      FROM filtered_claims fc
      GROUP BY fc.designation_id
    ) agg
    JOIN public.designations d ON d.id = agg.designation_id
  ),
  by_work_location AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'location_name', wl.location_name,
        'total_amount', agg.total_amount,
        'claim_count', agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        fc.work_location_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        count(*)::int AS claim_count
      FROM filtered_claims fc
      GROUP BY fc.work_location_id
    ) agg
    JOIN public.work_locations wl ON wl.id = agg.work_location_id
  ),
  by_state AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'state_name', s.state_name,
        'total_amount', agg.total_amount,
        'claim_count', agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        es.state_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        count(*)::int AS claim_count
      FROM filtered_claims fc
      JOIN public.employee_states es
        ON es.employee_id = fc.employee_id
       AND es.is_primary = true
      GROUP BY es.state_id
    ) agg
    JOIN public.states s ON s.id = agg.state_id
  ),
  by_vehicle_type AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'vehicle_name', coalesce(vt.vehicle_name, 'No Vehicle'),
        'total_amount', agg.total_amount,
        'claim_count', agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        fc.vehicle_type_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        count(*)::int AS claim_count
      FROM filtered_claims fc
      GROUP BY fc.vehicle_type_id
    ) agg
    LEFT JOIN public.vehicle_types vt ON vt.id = agg.vehicle_type_id
  )
  SELECT jsonb_build_object(
    'kpi', (
      SELECT jsonb_build_object(
        'total_count', k.total_count,
        'total_amount', k.total_amount,
        'food_amount', coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'food'), 0),
        'fuel_amount', coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'fuel'), 0),
        'intercity_travel_amount', coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'intercity_travel'), 0),
        'intracity_allowance_amount', coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'intracity_allowance'), 0)
      )
      FROM kpi k
    ),
    'by_expense_type', coalesce((SELECT data FROM by_expense_type), '[]'::jsonb),
    'by_designation', coalesce((SELECT data FROM by_designation), '[]'::jsonb),
    'by_work_location', coalesce((SELECT data FROM by_work_location), '[]'::jsonb),
    'by_state', coalesce((SELECT data FROM by_state), '[]'::jsonb),
    'by_vehicle_type', coalesce((SELECT data FROM by_vehicle_type), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_finance_pending_dashboard_analytics(
  date,
  date,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text
) TO authenticated;

COMMIT;
