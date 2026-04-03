BEGIN;

-- Improve latest-row lookups used by policy and history query ordering.
CREATE INDEX IF NOT EXISTS idx_finance_actions_claim_latest
ON public.finance_actions (claim_id, acted_at DESC, id DESC);

-- Keep INSERT authorization aligned with finance RPC checks.
DROP POLICY IF EXISTS "finance can insert finance actions" ON public.finance_actions;
CREATE POLICY "finance can insert finance actions"
ON public.finance_actions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.employees current_emp
    JOIN public.employee_roles er
      ON er.employee_id = current_emp.id
     AND er.is_active = true
    JOIN public.roles r
      ON r.id = er.role_id
    WHERE lower(current_emp.employee_email) = public.current_user_email()
      AND r.is_finance_role = true
      AND r.is_active = true
  )
);

-- Finance team members should see the same shared finance history.
-- Return only the latest finance action row per claim so released claims
-- do not appear twice as both finance_approved and payment_released.
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
    SELECT fa_latest.id
    FROM public.finance_actions fa_latest
    WHERE fa_latest.claim_id = finance_actions.claim_id
    ORDER BY fa_latest.acted_at DESC, fa_latest.id DESC
    LIMIT 1
  )
);

COMMIT;