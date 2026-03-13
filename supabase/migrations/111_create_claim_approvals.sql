-- Migration 111: Create claim_approvals table
-- Tracks approval history for each claim with employee_id FK (not email)
-- Replaces email-based approval_history table

CREATE TABLE IF NOT EXISTS claim_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES expense_claims(id) ON DELETE CASCADE,
  approval_level INTEGER NOT NULL, -- 1, 2, 3, 4
  approver_employee_id UUID NOT NULL REFERENCES employees(id),
  approver_role_id UUID NOT NULL REFERENCES roles(id),
  old_status_id UUID NOT NULL REFERENCES claim_statuses(id),
  new_status_id UUID NOT NULL REFERENCES claim_statuses(id),
  action_type VARCHAR(20) NOT NULL, -- 'APPROVED', 'REJECTED', 'RETURNED'
  comments TEXT,
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ca_claim ON claim_approvals(claim_id);
CREATE INDEX IF NOT EXISTS idx_ca_approver ON claim_approvals(approver_employee_id);
CREATE INDEX IF NOT EXISTS idx_ca_level ON claim_approvals(approval_level);
CREATE INDEX IF NOT EXISTS idx_ca_action ON claim_approvals(action_type);
CREATE INDEX IF NOT EXISTS idx_ca_approved_at ON claim_approvals(approved_at);

-- RLS
ALTER TABLE claim_approvals ENABLE ROW LEVEL SECURITY;

-- Employees can read approvals for their own claims
CREATE POLICY "ca_read_own_claims" ON claim_approvals FOR SELECT TO authenticated
  USING (
    claim_id IN (
      SELECT ec.id FROM expense_claims ec WHERE ec.employee_id = auth.uid()
    )
  );

-- Approvers can read approvals for claims they've acted on
CREATE POLICY "ca_read_as_approver" ON claim_approvals FOR SELECT TO authenticated
  USING (approver_employee_id = auth.uid());

-- Service role has full access for server actions
CREATE POLICY "ca_write_service" ON claim_approvals FOR ALL TO service_role USING (true);

-- Check constraint for valid action types
ALTER TABLE claim_approvals ADD CONSTRAINT chk_action_type 
  CHECK (action_type IN ('APPROVED', 'REJECTED', 'RETURNED'));
