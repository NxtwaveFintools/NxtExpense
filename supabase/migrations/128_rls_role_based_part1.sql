-- Migration 128: Refactor RLS policies to use role-based checks (Part 1)
-- Phase 8 of ID-based architecture migration
--
-- Replaces designation::text = 'Finance' / 'Admin' with employee_roles/roles join
-- Tables: approval_history, claim_expenses, claim_status_audit, expense_claim_items

-- =============================================================================
-- 1. approval_history — "finance can read claim history"
-- =============================================================================
DROP POLICY IF EXISTS "finance can read claim history" ON public.approval_history;

CREATE POLICY "finance can read claim history"
  ON public.approval_history
  FOR SELECT
  TO public
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
    (EXISTS (
      SELECT 1
      FROM public.expense_claims c
      WHERE c.id = approval_history.claim_id
        AND c.status IN ('finance_review', 'issued', 'finance_rejected')
    ))
  );

-- =============================================================================
-- 2. claim_expenses — "finance can read claim expenses"
-- =============================================================================
DROP POLICY IF EXISTS "finance can read claim expenses" ON public.claim_expenses;

CREATE POLICY "finance can read claim expenses"
  ON public.claim_expenses
  FOR SELECT
  TO public
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
    (EXISTS (
      SELECT 1
      FROM public.expense_claims ec
      WHERE ec.id = claim_expenses.claim_id
        AND ec.status IN ('finance_review', 'issued', 'finance_rejected')
    ))
  );

-- =============================================================================
-- 3. claim_status_audit — "participants can read claim status audit"
--    Old: designation IN ('Finance', 'Admin')
--    New: role_code IN ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR', 'ADMIN')
-- =============================================================================
DROP POLICY IF EXISTS "participants can read claim status audit" ON public.claim_status_audit;

CREATE POLICY "participants can read claim status audit"
  ON public.claim_status_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.expense_claims c
      JOIN public.employees owner_emp ON owner_emp.id = c.employee_id
      LEFT JOIN public.employees current_emp ON lower(current_emp.employee_email) = public.current_user_email()
      WHERE c.id = claim_status_audit.claim_id
        AND (
          -- Owner can read
          lower(owner_emp.employee_email) = public.current_user_email()
          -- Approvers at any level can read
          OR lower(COALESCE(owner_emp.approval_email_level_1, '')) = public.current_user_email()
          OR lower(COALESCE(owner_emp.approval_email_level_2, '')) = public.current_user_email()
          OR lower(COALESCE(owner_emp.approval_email_level_3, '')) = public.current_user_email()
          -- Finance or Admin (role-based)
          OR EXISTS (
            SELECT 1
            FROM public.employee_roles er
            JOIN public.roles r ON r.id = er.role_id
            WHERE er.employee_id = current_emp.id
              AND er.is_active = true
              AND r.role_code IN ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR', 'ADMIN')
          )
        )
    )
  );

-- =============================================================================
-- 4. expense_claim_items — "finance can read claim items"
-- =============================================================================
DROP POLICY IF EXISTS "finance can read claim items" ON public.expense_claim_items;

CREATE POLICY "finance can read claim items"
  ON public.expense_claim_items
  FOR SELECT
  TO public
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
    (EXISTS (
      SELECT 1
      FROM public.expense_claims c
      WHERE c.id = expense_claim_items.claim_id
        AND c.status IN ('finance_review', 'issued', 'finance_rejected')
    ))
  );
