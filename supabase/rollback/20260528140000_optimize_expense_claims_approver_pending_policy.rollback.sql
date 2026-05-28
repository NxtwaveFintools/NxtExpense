-- Rollback: restore the original (pre-optimization) "approver reads pending claims"
-- policy on expense_claims. Reverts 20260528140000.
--
-- WARNING: this reinstates the correlated per-row "employees approver" seq scan that
-- makes finance/approver reads of expense_claims (and, cascading, approval_history)
-- degrade to seconds and time out at large claim volumes. Only use to revert
-- 20260528140000.

DROP POLICY "approver reads pending claims" ON public.expense_claims;

CREATE POLICY "approver reads pending claims" ON public.expense_claims
FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.employees approver
    WHERE lower(approver.employee_email) = current_user_email()
      AND (
        (expense_claims.current_approval_level = 1
         AND EXISTS (
           SELECT 1 FROM public.employees owner
           WHERE owner.id = expense_claims.employee_id
             AND owner.approval_employee_id_level_1 = approver.id))
        OR
        (expense_claims.current_approval_level = 2
         AND EXISTS (
           SELECT 1 FROM public.employees owner
           WHERE owner.id = expense_claims.employee_id
             AND owner.approval_employee_id_level_3 = approver.id))
      )
  )
);
