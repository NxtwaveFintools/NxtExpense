BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_analytics(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_claim_id text DEFAULT NULL,
  p_date_filter_field text DEFAULT 'travel_date',
  p_designation_id uuid DEFAULT NULL,
  p_work_location_id uuid DEFAULT NULL,
  p_state_id uuid DEFAULT NULL,
  p_employee_id text DEFAULT NULL,
  p_employee_name text DEFAULT NULL,
  p_vehicle_code text DEFAULT NULL,
  p_claim_status_id uuid DEFAULT NULL,
  p_pending_only boolean DEFAULT false,
  p_top_claims_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid;
  v_result jsonb;
  v_date_filter_field text;
  v_top_claims_limit integer;
BEGIN
  v_admin_id := public.require_admin_actor();
  v_date_filter_field := lower(coalesce(nullif(trim(p_date_filter_field), ''), 'travel_date'));

  IF v_date_filter_field NOT IN ('travel_date', 'submission_date') THEN
    RAISE EXCEPTION 'Invalid date filter field. Expected travel_date or submission_date.';
  END IF;

  v_top_claims_limit := greatest(1, least(coalesce(p_top_claims_limit, 10), 50));

  WITH pending_statuses AS (
    SELECT cs.id
    FROM public.claim_statuses cs
    WHERE cs.is_active = true
      AND cs.is_terminal = false
      AND cs.is_rejection = false
      AND cs.is_approval = false
  ),
  payment_issued_statuses AS (
    SELECT cs.id
    FROM public.claim_statuses cs
    WHERE cs.is_active = true
      AND cs.is_payment_issued = true
  ),
  rejected_statuses AS (
    SELECT cs.id
    FROM public.claim_statuses cs
    WHERE cs.is_active = true
      AND cs.is_rejection = true
  ),
  filtered_claims AS (
    SELECT
      c.id,
      c.claim_number,
      c.claim_date,
      c.submitted_at,
      c.total_amount,
      c.status_id,
      c.designation_id,
      c.work_location_id,
      c.vehicle_type_id,
      c.employee_id,
      e.employee_id AS employee_code,
      e.employee_name
    FROM public.expense_claims c
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
      AND (p_claim_status_id IS NULL OR c.status_id = p_claim_status_id)
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
      AND (NOT coalesce(p_pending_only, false) OR c.status_id IN (SELECT id FROM pending_statuses))
  ),
  kpi AS (
    SELECT
      count(*)::int AS total_count,
      coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
      coalesce(avg(fc.total_amount), 0)::numeric AS avg_amount,
      count(*) FILTER (WHERE fc.status_id IN (SELECT id FROM pending_statuses))::int AS pending_count,
      coalesce(sum(fc.total_amount) FILTER (WHERE fc.status_id IN (SELECT id FROM pending_statuses)), 0)::numeric AS pending_amount,
      count(*) FILTER (WHERE fc.status_id IN (SELECT id FROM payment_issued_statuses))::int AS payment_released_count,
      coalesce(sum(fc.total_amount) FILTER (WHERE fc.status_id IN (SELECT id FROM payment_issued_statuses)), 0)::numeric AS payment_released_amount,
      count(*) FILTER (WHERE fc.status_id IN (SELECT id FROM rejected_statuses))::int AS rejected_count,
      coalesce(sum(fc.total_amount) FILTER (WHERE fc.status_id IN (SELECT id FROM rejected_statuses)), 0)::numeric AS rejected_amount
    FROM filtered_claims fc
  ),
  by_status AS (
    SELECT jsonb_agg(jsonb_build_object('status_name', cs.status_name, 'claim_count', agg.claim_count, 'total_amount', agg.total_amount) ORDER BY agg.claim_count DESC) AS data
    FROM (
      SELECT fc.status_id, count(*)::int AS claim_count, coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
      FROM filtered_claims fc
      GROUP BY fc.status_id
    ) agg
    LEFT JOIN public.claim_statuses cs ON cs.id = agg.status_id
  ),
  by_designation AS (
    SELECT jsonb_agg(jsonb_build_object('designation_name', d.designation_name, 'claim_count', agg.claim_count, 'total_amount', agg.total_amount, 'avg_amount', agg.avg_amount) ORDER BY agg.total_amount DESC) AS data
    FROM (
      SELECT
        fc.designation_id,
        count(*)::int AS claim_count,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        coalesce(avg(fc.total_amount), 0)::numeric AS avg_amount
      FROM filtered_claims fc
      GROUP BY fc.designation_id
    ) agg
    LEFT JOIN public.designations d ON d.id = agg.designation_id
  ),
  by_work_location AS (
    SELECT jsonb_agg(jsonb_build_object('location_name', wl.location_name, 'claim_count', agg.claim_count, 'total_amount', agg.total_amount) ORDER BY agg.total_amount DESC) AS data
    FROM (
      SELECT fc.work_location_id, count(*)::int AS claim_count, coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
      FROM filtered_claims fc
      GROUP BY fc.work_location_id
    ) agg
    LEFT JOIN public.work_locations wl ON wl.id = agg.work_location_id
  ),
  by_state AS (
    SELECT jsonb_agg(jsonb_build_object('state_name', s.state_name, 'claim_count', agg.claim_count, 'total_amount', agg.total_amount) ORDER BY agg.total_amount DESC) AS data
    FROM (
      SELECT es.state_id, count(*)::int AS claim_count, coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
      FROM filtered_claims fc
      JOIN public.employee_states es ON es.employee_id = fc.employee_id AND es.is_primary = true
      GROUP BY es.state_id
    ) agg
    LEFT JOIN public.states s ON s.id = agg.state_id
  ),
  by_vehicle_type AS (
    SELECT jsonb_agg(jsonb_build_object('vehicle_name', coalesce(vt.vehicle_name, 'No Vehicle'), 'claim_count', agg.claim_count, 'total_amount', agg.total_amount) ORDER BY agg.total_amount DESC) AS data
    FROM (
      SELECT fc.vehicle_type_id, count(*)::int AS claim_count, coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
      FROM filtered_claims fc
      GROUP BY fc.vehicle_type_id
    ) agg
    LEFT JOIN public.vehicle_types vt ON vt.id = agg.vehicle_type_id
  ),
  top_claims AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'claim_id', rows.id,
        'claim_number', rows.claim_number,
        'employee_id', rows.employee_code,
        'employee_name', rows.employee_name,
        'claim_date', rows.claim_date,
        'submitted_at', rows.submitted_at,
        'status_name', rows.status_name,
        'total_amount', rows.total_amount
      )
      ORDER BY rows.total_amount DESC, rows.submitted_at ASC NULLS LAST
    ) AS data
    FROM (
      SELECT
        fc.id,
        fc.claim_number,
        fc.employee_code,
        fc.employee_name,
        fc.claim_date,
        fc.submitted_at,
        coalesce(cs.status_name, 'Unknown') AS status_name,
        fc.total_amount
      FROM filtered_claims fc
      LEFT JOIN public.claim_statuses cs ON cs.id = fc.status_id
      ORDER BY fc.total_amount DESC, fc.submitted_at ASC NULLS LAST
      LIMIT v_top_claims_limit
    ) rows
  )
  SELECT jsonb_build_object(
    'kpi', (
      SELECT jsonb_build_object(
        'total_count', k.total_count,
        'total_amount', k.total_amount,
        'avg_amount', k.avg_amount,
        'pending_count', k.pending_count,
        'pending_amount', k.pending_amount,
        'payment_released_count', k.payment_released_count,
        'payment_released_amount', k.payment_released_amount,
        'rejected_count', k.rejected_count,
        'rejected_amount', k.rejected_amount
      )
      FROM kpi k
    ),
    'by_status', coalesce((SELECT data FROM by_status), '[]'::jsonb),
    'by_designation', coalesce((SELECT data FROM by_designation), '[]'::jsonb),
    'by_work_location', coalesce((SELECT data FROM by_work_location), '[]'::jsonb),
    'by_state', coalesce((SELECT data FROM by_state), '[]'::jsonb),
    'by_vehicle_type', coalesce((SELECT data FROM by_vehicle_type), '[]'::jsonb),
    'top_claims', coalesce((SELECT data FROM top_claims), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_analytics(
  date,
  date,
  text,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  boolean,
  integer
) TO authenticated;

COMMIT;
