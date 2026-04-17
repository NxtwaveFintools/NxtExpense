BEGIN;

CREATE OR REPLACE FUNCTION public.get_claim_available_actions(p_claim_id uuid)
RETURNS TABLE(
  action text,
  display_label text,
  require_notes boolean,
  supports_allow_resubmit boolean,
  actor_scope text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_email text;
  v_claim public.expense_claims%rowtype;
  v_owner public.employees%rowtype;
  v_current public.employees%rowtype;
  v_actor text;
  v_is_zbh boolean := false;
BEGIN
  v_email := public.current_user_email();
  IF coalesce(v_email, '') = '' THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_claim
  FROM public.expense_claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_owner
  FROM public.employees
  WHERE id = v_claim.employee_id;

  SELECT *
  INTO v_current
  FROM public.employees
  WHERE lower(employee_email) = v_email;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.designations d
    WHERE d.id = v_current.designation_id
      AND d.designation_code = 'ZBH'
      AND d.is_active = true
  )
  INTO v_is_zbh;

  IF v_is_zbh THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_current.id
      AND er.is_active = true
      AND r.is_admin_role = true
  ) THEN
    v_actor := 'admin';
  ELSIF EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_current.id
      AND er.is_active = true
      AND r.is_finance_role = true
  ) THEN
    v_actor := 'finance';
  ELSIF v_owner.approval_employee_id_level_1 = v_current.id
    AND v_claim.current_approval_level = 1
  THEN
    v_actor := 'approver';
  ELSIF v_owner.approval_employee_id_level_3 = v_current.id
    AND v_claim.current_approval_level = 2
  THEN
    v_actor := 'approver';
  ELSE
    RETURN;
  END IF;

  RETURN QUERY
  WITH eligible_transitions AS (
    SELECT
      t.action_code,
      t.requires_comment,
      coalesce(t.allow_resubmit, false) AS allow_resubmit,
      t.created_at,
      to_status.is_payment_issued,
      to_status.is_rejection
    FROM public.claim_status_transitions t
    JOIN public.claim_statuses to_status ON to_status.id = t.to_status_id
    WHERE t.from_status_id = v_claim.status_id
      AND t.is_active = true
      AND t.is_auto_transition = false
      AND (
        v_actor = 'admin'
        OR t.requires_role_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.employee_roles er
          WHERE er.employee_id = v_current.id
            AND er.role_id = t.requires_role_id
            AND er.is_active = true
        )
      )
  ),
  normalized_transitions AS (
    SELECT
      CASE
        WHEN coalesce(is_payment_issued, false) = true
          AND action_code LIKE 'finance_%'
          THEN substr(action_code, length('finance_') + 1)
        ELSE action_code
      END AS normalized_action,
      requires_comment,
      allow_resubmit,
      is_rejection,
      created_at
    FROM eligible_transitions
  )
  SELECT
    nt.normalized_action AS action,
    initcap(replace(nt.normalized_action, '_', ' ')) AS display_label,
    bool_or(nt.requires_comment) AS require_notes,
    bool_or(nt.allow_resubmit OR coalesce(nt.is_rejection, false)) AS supports_allow_resubmit,
    v_actor AS actor_scope
  FROM normalized_transitions nt
  GROUP BY nt.normalized_action
  ORDER BY min(nt.created_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_claim_available_actions(uuid)
  TO authenticated, service_role;

COMMIT;
