-- Migration 130: Convert ALL custom PostgreSQL enum columns to text
-- Phase 9a of ID-based architecture migration
--
-- This converts 14+ enum columns across 7+ tables from rigid PostgreSQL enum
-- types to flexible text columns. All data is preserved — PostgreSQL casts
-- enum values to their string representation automatically.
--
-- Must temporarily DROP 5 RLS policies that reference expense_claims.status
-- with enum casts, then RECREATE them with plain text comparisons.

BEGIN;

-- =============================================================================
-- STEP 0: Drop RLS policies that block ALTER COLUMN TYPE
-- =============================================================================

-- These 5 policies reference expense_claims.status with ::claim_status casts
DROP POLICY IF EXISTS "finance can read claim history" ON public.approval_history;
DROP POLICY IF EXISTS "finance can read claim expenses" ON public.claim_expenses;
DROP POLICY IF EXISTS "finance can read claim items" ON public.expense_claim_items;
DROP POLICY IF EXISTS "finance can read finance claims" ON public.expense_claims;
DROP POLICY IF EXISTS "finance can update finance review claims" ON public.expense_claims;

-- =============================================================================
-- STEP 1: Convert all enum columns to text
-- =============================================================================

-- expense_claims: status (has DEFAULT)
ALTER TABLE public.expense_claims ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.expense_claims ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.expense_claims ALTER COLUMN status SET DEFAULT 'draft';

-- expense_claims: work_location, vehicle_type
ALTER TABLE public.expense_claims ALTER COLUMN work_location TYPE text USING work_location::text;
ALTER TABLE public.expense_claims ALTER COLUMN vehicle_type TYPE text USING vehicle_type::text;

-- employees: designation
ALTER TABLE public.employees ALTER COLUMN designation TYPE text USING designation::text;

-- claim_transition_graph: from_status, to_status, to_status_when_no_next
ALTER TABLE public.claim_transition_graph ALTER COLUMN from_status TYPE text USING from_status::text;
ALTER TABLE public.claim_transition_graph ALTER COLUMN to_status TYPE text USING to_status::text;
ALTER TABLE public.claim_transition_graph ALTER COLUMN to_status_when_no_next TYPE text USING to_status_when_no_next::text;

-- claim_transition_graph: actor_scope
ALTER TABLE public.claim_transition_graph ALTER COLUMN actor_scope TYPE text USING actor_scope::text;

-- claim_transition_graph: next_level_mode (has DEFAULT)
ALTER TABLE public.claim_transition_graph ALTER COLUMN next_level_mode DROP DEFAULT;
ALTER TABLE public.claim_transition_graph ALTER COLUMN next_level_mode TYPE text USING next_level_mode::text;
ALTER TABLE public.claim_transition_graph ALTER COLUMN next_level_mode SET DEFAULT 'retain';

-- claim_status_audit: from_status, to_status, actor_scope
ALTER TABLE public.claim_status_audit ALTER COLUMN from_status TYPE text USING from_status::text;
ALTER TABLE public.claim_status_audit ALTER COLUMN to_status TYPE text USING to_status::text;
ALTER TABLE public.claim_status_audit ALTER COLUMN actor_scope TYPE text USING actor_scope::text;

-- claim_status_catalog: status (PK)
ALTER TABLE public.claim_status_catalog ALTER COLUMN status TYPE text USING status::text;

-- approval_history: action
ALTER TABLE public.approval_history ALTER COLUMN action TYPE text USING action::text;

-- finance_actions: action
ALTER TABLE public.finance_actions ALTER COLUMN action TYPE text USING action::text;

-- expense_claim_items: item_type
ALTER TABLE public.expense_claim_items ALTER COLUMN item_type TYPE text USING item_type::text;

-- expense_reimbursement_rates: designation, vehicle_type
ALTER TABLE public.expense_reimbursement_rates ALTER COLUMN designation TYPE text USING designation::text;
ALTER TABLE public.expense_reimbursement_rates ALTER COLUMN vehicle_type TYPE text USING vehicle_type::text;

-- =============================================================================
-- STEP 2: Recreate 5 RLS policies with plain text comparisons
-- =============================================================================

-- 1. approval_history — "finance can read claim history"
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

-- 2. claim_expenses — "finance can read claim expenses"
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

-- 3. expense_claim_items — "finance can read claim items"
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

-- 4. expense_claims — "finance can read finance claims"
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

-- 5. expense_claims — "finance can update finance review claims"
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

COMMIT;
