-- Migration 129: Refactor RLS policies to use role-based checks (Part 2)
-- Phase 8 of ID-based architecture migration
--
-- Tables: expense_claims (2 policies), finance_actions (2 policies)

-- =============================================================================
-- 1. expense_claims — "finance can read finance claims"
-- =============================================================================
DROP POLICY IF EXISTS "finance can read finance claims" ON public.expense_claims;

CREATE POLICY "finance can read finance claims"
  ON public.expense_claims
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1
      FROM public.employees current_emp
      JOIN public.employee_roles er ON er.employee_id = current_emp.id AND er.is_active = true
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(current_emp.employee_email) = public.current_user_email()
        AND r.role_code IN ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
    ))
    AND
    (status IN ('finance_review', 'issued', 'finance_rejected'))
  );

-- =============================================================================
-- 2. expense_claims — "finance can update finance review claims"
-- =============================================================================
DROP POLICY IF EXISTS "finance can update finance review claims" ON public.expense_claims;

CREATE POLICY "finance can update finance review claims"
  ON public.expense_claims
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1
      FROM public.employees current_emp
      JOIN public.employee_roles er ON er.employee_id = current_emp.id AND er.is_active = true
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(current_emp.employee_email) = public.current_user_email()
        AND r.role_code IN ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
    ))
    AND
    (status = 'finance_review')
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1
      FROM public.employees current_emp
      JOIN public.employee_roles er ON er.employee_id = current_emp.id AND er.is_active = true
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(current_emp.employee_email) = public.current_user_email()
        AND r.role_code IN ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
    ))
    AND
    (status IN ('issued', 'finance_rejected'))
    AND
    (current_approval_level IS NULL)
  );

-- =============================================================================
-- 3. finance_actions — "finance can insert finance actions"
-- =============================================================================
DROP POLICY IF EXISTS "finance can insert finance actions" ON public.finance_actions;

CREATE POLICY "finance can insert finance actions"
  ON public.finance_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees current_emp
      JOIN public.employee_roles er ON er.employee_id = current_emp.id AND er.is_active = true
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(current_emp.employee_email) = public.current_user_email()
        AND r.role_code IN ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
        AND lower(finance_actions.actor_email) = public.current_user_email()
    )
  );

-- =============================================================================
-- 4. finance_actions — "finance or owner can read finance actions"
-- =============================================================================
DROP POLICY IF EXISTS "finance or owner can read finance actions" ON public.finance_actions;

CREATE POLICY "finance or owner can read finance actions"
  ON public.finance_actions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.expense_claims c
      JOIN public.employees owner_emp ON owner_emp.id = c.employee_id
      LEFT JOIN public.employees current_emp ON lower(current_emp.employee_email) = public.current_user_email()
      WHERE c.id = finance_actions.claim_id
        AND (
          -- Owner can read
          lower(owner_emp.employee_email) = public.current_user_email()
          -- Finance role holder can read
          OR EXISTS (
            SELECT 1
            FROM public.employee_roles er
            JOIN public.roles r ON r.id = er.role_id
            WHERE er.employee_id = current_emp.id
              AND er.is_active = true
              AND r.role_code IN ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
          )
        )
    )
  );
