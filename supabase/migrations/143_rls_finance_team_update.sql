-- Migration 143: Update RLS policies — FINANCE_TEAM replaces FINANCE_REVIEWER + FINANCE_PROCESSOR
-- Rewrites 8 policies across 5 tables.
-- Also fixes the broken finance_actions INSERT policy that referenced actor_email
-- (which was dropped in migration 137).

BEGIN;

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
        AND r.role_code = 'FINANCE_TEAM'
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
        AND r.role_code = 'FINANCE_TEAM'
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
--    Finance role check: FINANCE_REVIEWER + FINANCE_PROCESSOR → FINANCE_TEAM
--    (approval_email_level columns still used here until migration 144 drops them)
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
          -- Claim owner can read
          lower(owner_emp.employee_email) = public.current_user_email()
          -- Assigned approvers can read (still using email columns until mig 144)
          OR lower(COALESCE(owner_emp.approval_email_level_1, '')) = public.current_user_email()
          OR lower(COALESCE(owner_emp.approval_email_level_2, '')) = public.current_user_email()
          OR lower(COALESCE(owner_emp.approval_email_level_3, '')) = public.current_user_email()
          -- Finance Team or Admin role holders can read
          OR EXISTS (
            SELECT 1
            FROM public.employee_roles er
            JOIN public.roles r ON r.id = er.role_id
            WHERE er.employee_id = current_emp.id
              AND er.is_active = true
              AND r.role_code IN ('FINANCE_TEAM', 'ADMIN')
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
        AND r.role_code = 'FINANCE_TEAM'
    ))
    AND
    (EXISTS (
      SELECT 1
      FROM public.expense_claims c
      WHERE c.id = expense_claim_items.claim_id
        AND c.status IN ('finance_review', 'issued', 'finance_rejected')
    ))
  );

-- =============================================================================
-- 5. expense_claims — "finance can read finance claims"
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
        AND r.role_code = 'FINANCE_TEAM'
    ))
    AND
    (status IN ('finance_review', 'issued', 'finance_rejected'))
  );

-- =============================================================================
-- 6. expense_claims — "finance can update finance review claims"
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
        AND r.role_code = 'FINANCE_TEAM'
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
        AND r.role_code = 'FINANCE_TEAM'
    ))
    AND
    (status IN ('issued', 'finance_rejected', 'returned_for_modification'))
    AND
    (current_approval_level IS NULL)
  );

-- =============================================================================
-- 7. finance_actions — "finance can insert finance actions"
--    Fixed: removed broken actor_email reference (column was dropped in mig 137)
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
        AND r.role_code = 'FINANCE_TEAM'
    )
  );

-- =============================================================================
-- 8. finance_actions — "finance or owner can read finance actions"
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
          -- Claim owner can read
          lower(owner_emp.employee_email) = public.current_user_email()
          -- Finance Team can read
          OR EXISTS (
            SELECT 1
            FROM public.employee_roles er
            JOIN public.roles r ON r.id = er.role_id
            WHERE er.employee_id = current_emp.id
              AND er.is_active = true
              AND r.role_code = 'FINANCE_TEAM'
          )
        )
    )
  );

COMMIT;
