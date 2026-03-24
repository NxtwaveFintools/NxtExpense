-- ============================================================
-- Migration 125: Create claim_expenses table (replaces expense_claim_items)
-- Adds transport_type_id FK, bill tracking fields
-- ============================================================

CREATE TABLE claim_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES expense_claims(id) ON DELETE CASCADE,
  expense_type VARCHAR(50) NOT NULL, -- FOOD, FUEL, TAXI, ACCOMMODATION, INTERCITY_TRAVEL, OTHER
  transport_type_id UUID REFERENCES transport_types(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  bill_number VARCHAR(100),
  bill_date DATE,
  bill_attachment_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claim_expenses_claim ON claim_expenses(claim_id);
CREATE INDEX idx_claim_expenses_type ON claim_expenses(expense_type);

-- Migrate data from expense_claim_items
INSERT INTO claim_expenses (claim_id, expense_type, transport_type_id, amount, description, created_at)
SELECT 
  eci.claim_id,
  CASE eci.item_type::text
    WHEN 'food' THEN 'FOOD'
    WHEN 'fuel' THEN 'FUEL'
    WHEN 'taxi_bill' THEN 'TAXI'
    WHEN 'intercity_travel' THEN 'INTERCITY_TRAVEL'
    WHEN 'accommodation' THEN 'ACCOMMODATION'
    ELSE UPPER(eci.item_type::text)
  END,
  CASE eci.item_type::text
    WHEN 'taxi_bill' THEN (SELECT id FROM transport_types WHERE transport_code = 'TAXI')
    ELSE NULL
  END,
  eci.amount,
  eci.description,
  eci.created_at
FROM expense_claim_items eci;

-- Enable RLS
ALTER TABLE claim_expenses ENABLE ROW LEVEL SECURITY;

-- RLS: Claim owner can read their expenses
CREATE POLICY "owner can read claim expenses"
ON claim_expenses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM expense_claims ec
    JOIN employees e ON e.id = ec.employee_id
    WHERE ec.id = claim_expenses.claim_id
      AND lower(e.employee_email) = current_user_email()
  )
);

-- RLS: Claim owner can insert expenses on their own claims
CREATE POLICY "owner can insert claim expenses"
ON claim_expenses FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM expense_claims ec
    JOIN employees e ON e.id = ec.employee_id
    WHERE ec.id = claim_expenses.claim_id
      AND lower(e.employee_email) = current_user_email()
  )
);

-- RLS: Approvers can read expenses of claims they can see
CREATE POLICY "approvers can read claim expenses"
ON claim_expenses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM expense_claims ec
    JOIN employees owner_emp ON owner_emp.id = ec.employee_id
    WHERE ec.id = claim_expenses.claim_id
      AND (
        lower(COALESCE(owner_emp.approval_email_level_1, '')) = current_user_email()
        OR lower(COALESCE(owner_emp.approval_email_level_2, '')) = current_user_email()
        OR lower(COALESCE(owner_emp.approval_email_level_3, '')) = current_user_email()
      )
  )
);

-- RLS: Finance team can read expenses on finance-stage claims
CREATE POLICY "finance can read claim expenses"
ON claim_expenses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employees current_emp
    WHERE lower(current_emp.employee_email) = current_user_email()
      AND current_emp.designation::text = 'Finance'
  )
  AND EXISTS (
    SELECT 1 FROM expense_claims ec
    WHERE ec.id = claim_expenses.claim_id
      AND ec.status::text IN ('finance_review', 'issued', 'finance_rejected')
  )
);
