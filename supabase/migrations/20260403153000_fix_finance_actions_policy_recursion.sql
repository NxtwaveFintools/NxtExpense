BEGIN;

-- Resolve latest finance action per claim without evaluating finance_actions RLS
-- inside the policy expression itself (prevents recursive policy evaluation).
CREATE OR REPLACE FUNCTION public.get_latest_finance_action_id(p_claim_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT fa.id
  FROM public.finance_actions fa
  WHERE fa.claim_id = p_claim_id
  ORDER BY fa.acted_at DESC, fa.id DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_latest_finance_action_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_latest_finance_action_id(uuid) TO authenticated;

DROP POLICY IF EXISTS "finance or owner can read finance actions" ON public.finance_actions;
CREATE POLICY "finance or owner can read finance actions"
ON public.finance_actions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.expense_claims c
    JOIN public.employees owner_emp
      ON owner_emp.id = c.employee_id
    LEFT JOIN public.employees current_emp
      ON lower(current_emp.employee_email) = public.current_user_email()
    WHERE c.id = finance_actions.claim_id
      AND (
        lower(owner_emp.employee_email) = public.current_user_email()
        OR EXISTS (
          SELECT 1
          FROM public.employee_roles er
          JOIN public.roles r ON r.id = er.role_id
          WHERE er.employee_id = current_emp.id
            AND er.is_active = true
            AND r.is_finance_role = true
            AND r.is_active = true
        )
      )
  )
  AND finance_actions.id = (
    SELECT public.get_latest_finance_action_id(finance_actions.claim_id)
  )
);

COMMIT;