-- Fix: statement timeout on finance/approver direct reads of expense_claims
--      (and, cascading, approval_history) when filtering on /approved-history,
--      /finance, etc.
--
-- Root cause:
--   The "approver reads pending claims" SELECT policy on expense_claims is a
--   permissive policy that is OR'd with the other 4 SELECT policies and so is
--   evaluated for every candidate row a query scans. Its original form was:
--
--     EXISTS (
--       SELECT 1 FROM employees approver
--       WHERE lower(approver.employee_email) = current_user_email()
--         AND (
--           (expense_claims.current_approval_level = 1
--            AND EXISTS (SELECT 1 FROM employees owner
--                        WHERE owner.id = expense_claims.employee_id
--                          AND owner.approval_employee_id_level_1 = approver.id))
--           OR
--           (expense_claims.current_approval_level = 2
--            AND EXISTS (SELECT 1 FROM employees owner
--                        WHERE owner.id = expense_claims.employee_id
--                          AND owner.approval_employee_id_level_3 = approver.id))
--         )
--     )
--
--   The outer "employees approver" lookup is correlated (via approver.id) with the
--   inner EXISTS that references expense_claims columns, so the planner cannot hoist
--   it to a one-time InitPlan. It re-runs as a Seq Scan over employees for EVERY row
--   that is not already admitted by a cheaper policy.
--
--   Measured (finance user, 17,499 claims): SELECT count(*) FROM expense_claims = 5,648 ms,
--   of which ~5.6 s is this policy's per-row seq scan (loops = 5,746, 98% of buffers).
--   approval_history reads inherit the same cost because the "finance can read claim
--   history" policy nested-reads expense_claims (count(*) there = 6,050 ms).
--   At lakhs of claims this guarantees a statement timeout.
--
-- Fix:
--   Resolve the current user's employee id ONCE (uncorrelated subquery → InitPlan)
--   and drive the per-row check from the owner row by primary key. This is the exact
--   pattern the existing "employee reads own claims" policy already uses. The per-row
--   work drops from a 116-row employees seq scan to a single employees_pkey lookup.
--
--   Measured after fix: SELECT count(*) FROM expense_claims = 35 ms (160x), and the
--   visible row set is identical (11,753 rows, 5,746 removed by filter) — access
--   semantics are unchanged. No application or other-policy changes.

DROP POLICY IF EXISTS "approver reads pending claims" ON public.expense_claims;

CREATE POLICY "approver reads pending claims" ON public.expense_claims
FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.employees owner
    WHERE owner.id = expense_claims.employee_id
      AND (
        (expense_claims.current_approval_level = 1
         AND owner.approval_employee_id_level_1 = (
           SELECT e.id FROM public.employees e
           WHERE lower(e.employee_email) = current_user_email()))
        OR
        (expense_claims.current_approval_level = 2
         AND owner.approval_employee_id_level_3 = (
           SELECT e.id FROM public.employees e
           WHERE lower(e.employee_email) = current_user_email()))
      )
  )
);
