BEGIN;

-- Migration 147: Add missing RLS policies for employees, approvers, and admins
-- ROOT CAUSE: Only INSERT policy existed for employees on expense_claims.
-- PostgREST requires SELECT policy to return inserted rows (.select().single()).
-- Employees also couldn't read their own claims, approvers couldn't see pending claims.

-- ============================================================
-- EXPENSE_CLAIMS — Employee policies
-- ============================================================

-- 1. Employee can SELECT their own claims
CREATE POLICY "employee reads own claims"
  ON expense_claims
  FOR SELECT
  USING (
    employee_id = (
      SELECT e.id FROM employees e
      WHERE lower(e.employee_email) = current_user_email()
    )
  );

-- 2. Employee can UPDATE their own claims ONLY when status is DRAFT or RETURNED_FOR_MODIFICATION
CREATE POLICY "employee updates own draft or returned claims"
  ON expense_claims
  FOR UPDATE
  USING (
    employee_id = (
      SELECT e.id FROM employees e
      WHERE lower(e.employee_email) = current_user_email()
    )
    AND status_id IN (
      SELECT cs.id FROM claim_statuses cs
      WHERE cs.status_code IN ('DRAFT', 'RETURNED_FOR_MODIFICATION')
    )
  )
  WITH CHECK (
    employee_id = (
      SELECT e.id FROM employees e
      WHERE lower(e.employee_email) = current_user_email()
    )
  );

-- ============================================================
-- EXPENSE_CLAIMS — Approver policies
-- ============================================================

-- 3. Approvers can SELECT claims pending at their approval level
-- L1 approvers: see claims at current_approval_level=1 for employees they approve
-- L2 approvers: see claims at current_approval_level=2 for employees they approve
CREATE POLICY "approver reads pending claims"
  ON expense_claims
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM employees approver
      WHERE lower(approver.employee_email) = current_user_email()
        AND (
          -- L1: approver is the level-1 approver for the claim owner
          (
            current_approval_level = 1
            AND EXISTS (
              SELECT 1 FROM employees owner
              WHERE owner.id = expense_claims.employee_id
                AND owner.approval_employee_id_level_1 = approver.id
            )
          )
          OR
          -- L2: approver is the level-3 approver (final approver) for the claim owner
          (
            current_approval_level = 2
            AND EXISTS (
              SELECT 1 FROM employees owner
              WHERE owner.id = expense_claims.employee_id
                AND owner.approval_employee_id_level_3 = approver.id
            )
          )
        )
    )
  );

-- ============================================================
-- EXPENSE_CLAIMS — Admin policies
-- ============================================================

-- 4. Admin can SELECT all claims
CREATE POLICY "admin reads all claims"
  ON expense_claims
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM employees cur
        JOIN employee_roles er ON er.employee_id = cur.id AND er.is_active = true
        JOIN roles r ON r.id = er.role_id
      WHERE lower(cur.employee_email) = current_user_email()
        AND r.role_code = 'ADMIN'
    )
  );

-- ============================================================
-- EXPENSE_CLAIM_ITEMS — Employee & Approver policies
-- ============================================================

-- 5. Employee can SELECT their own claim items
CREATE POLICY "employee reads own claim items"
  ON expense_claim_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM expense_claims c
        JOIN employees e ON e.id = c.employee_id
      WHERE c.id = expense_claim_items.claim_id
        AND lower(e.employee_email) = current_user_email()
    )
  );

-- 6. Employee can UPDATE their own claim items (for draft/returned claims)
CREATE POLICY "employee updates own claim items"
  ON expense_claim_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM expense_claims c
        JOIN employees e ON e.id = c.employee_id
        JOIN claim_statuses cs ON cs.id = c.status_id
      WHERE c.id = expense_claim_items.claim_id
        AND lower(e.employee_email) = current_user_email()
        AND cs.status_code IN ('DRAFT', 'RETURNED_FOR_MODIFICATION')
    )
  );

-- 7. Employee can DELETE their own claim items (for draft/returned claims)
CREATE POLICY "employee deletes own claim items"
  ON expense_claim_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM expense_claims c
        JOIN employees e ON e.id = c.employee_id
        JOIN claim_statuses cs ON cs.id = c.status_id
      WHERE c.id = expense_claim_items.claim_id
        AND lower(e.employee_email) = current_user_email()
        AND cs.status_code IN ('DRAFT', 'RETURNED_FOR_MODIFICATION')
    )
  );

-- 8. Approver can SELECT claim items for claims pending at their level
CREATE POLICY "approver reads pending claim items"
  ON expense_claim_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM expense_claims c
        JOIN employees approver ON lower(approver.employee_email) = current_user_email()
      WHERE c.id = expense_claim_items.claim_id
        AND (
          (
            c.current_approval_level = 1
            AND EXISTS (
              SELECT 1 FROM employees owner
              WHERE owner.id = c.employee_id
                AND owner.approval_employee_id_level_1 = approver.id
            )
          )
          OR
          (
            c.current_approval_level = 2
            AND EXISTS (
              SELECT 1 FROM employees owner
              WHERE owner.id = c.employee_id
                AND owner.approval_employee_id_level_3 = approver.id
            )
          )
        )
    )
  );

-- ============================================================
-- APPROVAL_HISTORY — Employee & Approver policies
-- ============================================================

-- 9. Employee can SELECT approval history for their own claims
CREATE POLICY "employee reads own claim history"
  ON approval_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM expense_claims c
        JOIN employees e ON e.id = c.employee_id
      WHERE c.id = approval_history.claim_id
        AND lower(e.employee_email) = current_user_email()
    )
  );

-- 10. Approver can SELECT approval history for claims they're reviewing
CREATE POLICY "approver reads approval history"
  ON approval_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM employees cur
      WHERE lower(cur.employee_email) = current_user_email()
        AND cur.id = approval_history.approver_employee_id
    )
  );

-- 11. Admin can SELECT all approval history
CREATE POLICY "admin reads all approval history"
  ON approval_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM employees cur
        JOIN employee_roles er ON er.employee_id = cur.id AND er.is_active = true
        JOIN roles r ON r.id = er.role_id
      WHERE lower(cur.employee_email) = current_user_email()
        AND r.role_code = 'ADMIN'
    )
  );

-- 12. Admin can SELECT all claim items
CREATE POLICY "admin reads all claim items"
  ON expense_claim_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM employees cur
        JOIN employee_roles er ON er.employee_id = cur.id AND er.is_active = true
        JOIN roles r ON r.id = er.role_id
      WHERE lower(cur.employee_email) = current_user_email()
        AND r.role_code = 'ADMIN'
    )
  );

COMMIT;
