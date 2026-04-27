BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_approver_options_by_state(
  p_state_id uuid
)
RETURNS TABLE (
  approval_level integer,
  employee_id uuid,
  employee_name text,
  employee_email text,
  designation_id uuid,
  designation_name text,
  state_id uuid,
  state_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  v_admin_id := public.require_admin_actor();

  RETURN QUERY
  SELECT
    r.approval_level::integer,
    e.id::uuid,
    e.employee_name::text,
    e.employee_email::text,
    d.id::uuid,
    d.designation_name::text,
    display_state.state_id::uuid,
    s.state_name::text
  FROM public.approver_selection_rules r
  JOIN public.employees e
    ON e.designation_id = r.designation_id
  JOIN public.employee_statuses est
    ON est.id = e.employee_status_id
   AND est.status_code = 'ACTIVE'
  JOIN public.designations d
    ON d.id = e.designation_id
  LEFT JOIN LATERAL (
    SELECT es.state_id
    FROM public.employee_states es
    WHERE es.employee_id = e.id
    ORDER BY es.is_primary DESC, es.created_at ASC, es.state_id ASC
    LIMIT 1
  ) AS display_state ON true
  LEFT JOIN public.states s
    ON s.id = display_state.state_id
  WHERE r.is_active = true
    AND d.is_active = true
    AND (
      r.requires_same_state = false
      OR EXISTS (
        SELECT 1
        FROM public.employee_states same_state_es
        WHERE same_state_es.employee_id = e.id
          AND same_state_es.state_id = p_state_id
      )
    )
  ORDER BY r.approval_level ASC, e.employee_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_approver_options_by_state(uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;