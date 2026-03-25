BEGIN;

CREATE TABLE IF NOT EXISTS public.approver_selection_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_level integer NOT NULL CHECK (approval_level BETWEEN 1 AND 3),
  designation_id uuid NOT NULL REFERENCES public.designations(id),
  requires_same_state boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (approval_level, designation_id)
);

CREATE INDEX IF NOT EXISTS idx_approver_selection_rules_level_active
  ON public.approver_selection_rules (approval_level, is_active);

INSERT INTO public.approver_selection_rules (
  approval_level,
  designation_id,
  requires_same_state,
  is_active
)
SELECT
  seed.approval_level,
  d.id,
  seed.requires_same_state,
  true
FROM (
  VALUES
    (1, 'SBH'::text, true),
    (2, 'ZBH'::text, true),
    (3, 'PM'::text, false),
    (3, 'ADM'::text, false)
) AS seed(approval_level, designation_code, requires_same_state)
JOIN public.designations d ON d.designation_code = seed.designation_code
ON CONFLICT (approval_level, designation_id)
DO UPDATE SET
  requires_same_state = EXCLUDED.requires_same_state,
  is_active = true,
  updated_at = now();

GRANT SELECT ON public.approver_selection_rules TO authenticated;

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
    r.approval_level,
    e.id,
    e.employee_name,
    e.employee_email,
    d.id,
    d.designation_name,
    es.state_id,
    s.state_name
  FROM public.approver_selection_rules r
  JOIN public.employees e
    ON e.designation_id = r.designation_id
  JOIN public.designations d
    ON d.id = e.designation_id
  LEFT JOIN public.employee_states es
    ON es.employee_id = e.id
   AND es.is_primary = true
  LEFT JOIN public.states s
    ON s.id = es.state_id
  WHERE r.is_active = true
    AND (
      r.requires_same_state = false
      OR es.state_id = p_state_id
    )
  ORDER BY r.approval_level ASC, e.employee_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_approver_options_by_state(uuid)
  TO authenticated;

COMMIT;
