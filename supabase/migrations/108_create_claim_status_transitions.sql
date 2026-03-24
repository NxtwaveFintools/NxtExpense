-- Migration 108: Create claim_status_transitions table
-- Defines allowed status transitions and who can trigger them
-- Uses FK lookups by status_code and role_code for readability

CREATE TABLE IF NOT EXISTS claim_status_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_status_id UUID NOT NULL REFERENCES claim_statuses(id),
  to_status_id UUID NOT NULL REFERENCES claim_statuses(id),
  requires_role_id UUID REFERENCES roles(id), -- NULL means employee can do it
  requires_comment BOOLEAN DEFAULT false,
  is_auto_transition BOOLEAN DEFAULT false,
  validation_rules JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_status_id, to_status_id, requires_role_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cst_from ON claim_status_transitions(from_status_id);
CREATE INDEX IF NOT EXISTS idx_cst_to ON claim_status_transitions(to_status_id);
CREATE INDEX IF NOT EXISTS idx_cst_role ON claim_status_transitions(requires_role_id);
CREATE INDEX IF NOT EXISTS idx_cst_active ON claim_status_transitions(is_active);

-- RLS
ALTER TABLE claim_status_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cst_read_all" ON claim_status_transitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "cst_write_service" ON claim_status_transitions FOR ALL TO service_role USING (true);

-- Helper function for status ID lookup
CREATE OR REPLACE FUNCTION get_claim_status_id(p_code VARCHAR) RETURNS UUID AS $$
  SELECT id FROM claim_statuses WHERE status_code = p_code;
$$ LANGUAGE sql STABLE;

-- Helper function for role ID lookup
CREATE OR REPLACE FUNCTION get_role_id(p_code VARCHAR) RETURNS UUID AS $$
  SELECT id FROM roles WHERE role_code = p_code;
$$ LANGUAGE sql STABLE;

-- Seed transitions
INSERT INTO claim_status_transitions (from_status_id, to_status_id, requires_role_id, requires_comment, is_auto_transition)
VALUES
  -- 1. Employee submits draft
  (get_claim_status_id('DRAFT'), get_claim_status_id('SUBMITTED'), get_role_id('EMPLOYEE'), false, false),

  -- 2. Auto-route after submission: SUBMITTED → L1_PENDING (for SRO/BOA/ABH via designation_approval_flow)
  (get_claim_status_id('SUBMITTED'), get_claim_status_id('L1_PENDING'), NULL, false, true),

  -- 3. Auto-route after submission: SUBMITTED → L2_PENDING (for SBH/ZBH/PM who skip L1)
  (get_claim_status_id('SUBMITTED'), get_claim_status_id('L2_PENDING'), NULL, false, true),

  -- 4. L1 Approver approves
  (get_claim_status_id('L1_PENDING'), get_claim_status_id('L1_APPROVED'), get_role_id('APPROVER_L1'), false, false),

  -- 5. L1 Approver rejects (requires comment)
  (get_claim_status_id('L1_PENDING'), get_claim_status_id('L1_REJECTED'), get_role_id('APPROVER_L1'), true, false),

  -- 6. L1 Approver returns for modification (requires comment)
  (get_claim_status_id('L1_PENDING'), get_claim_status_id('RETURNED_FOR_MODIFICATION'), get_role_id('APPROVER_L1'), true, false),

  -- 7. Auto-progression: L1_APPROVED → L2_PENDING
  (get_claim_status_id('L1_APPROVED'), get_claim_status_id('L2_PENDING'), NULL, false, true),

  -- 8. L2 Approver approves
  (get_claim_status_id('L2_PENDING'), get_claim_status_id('L2_APPROVED'), get_role_id('APPROVER_L2'), false, false),

  -- 9. L2 Approver rejects (requires comment)
  (get_claim_status_id('L2_PENDING'), get_claim_status_id('L2_REJECTED'), get_role_id('APPROVER_L2'), true, false),

  -- 10. L2 Approver returns for modification (requires comment)
  (get_claim_status_id('L2_PENDING'), get_claim_status_id('RETURNED_FOR_MODIFICATION'), get_role_id('APPROVER_L2'), true, false),

  -- 11. Auto-progression: L2_APPROVED → L3_PENDING_FINANCE_REVIEW
  (get_claim_status_id('L2_APPROVED'), get_claim_status_id('L3_PENDING_FINANCE_REVIEW'), NULL, false, true),

  -- 12. Finance Reviewer approves
  (get_claim_status_id('L3_PENDING_FINANCE_REVIEW'), get_claim_status_id('L3_APPROVED_FINANCE'), get_role_id('FINANCE_REVIEWER'), false, false),

  -- 13. Finance Reviewer rejects (requires comment)
  (get_claim_status_id('L3_PENDING_FINANCE_REVIEW'), get_claim_status_id('L3_REJECTED_FINANCE'), get_role_id('FINANCE_REVIEWER'), true, false),

  -- 14. Finance Reviewer returns for modification (requires comment)
  (get_claim_status_id('L3_PENDING_FINANCE_REVIEW'), get_claim_status_id('RETURNED_FOR_MODIFICATION'), get_role_id('FINANCE_REVIEWER'), true, false),

  -- 15. Auto-progression: L3_APPROVED_FINANCE → L4_PENDING_PAYMENT_PROCESSING
  (get_claim_status_id('L3_APPROVED_FINANCE'), get_claim_status_id('L4_PENDING_PAYMENT_PROCESSING'), NULL, false, true),

  -- 16. Finance Processor issues payment
  (get_claim_status_id('L4_PENDING_PAYMENT_PROCESSING'), get_claim_status_id('L4_ISSUED'), get_role_id('FINANCE_PROCESSOR'), false, false),

  -- 17. Finance Processor marks payment failed (requires comment)
  (get_claim_status_id('L4_PENDING_PAYMENT_PROCESSING'), get_claim_status_id('L4_PAYMENT_FAILED'), get_role_id('FINANCE_PROCESSOR'), true, false),

  -- 18. Retry failed payment
  (get_claim_status_id('L4_PAYMENT_FAILED'), get_claim_status_id('L4_PENDING_PAYMENT_PROCESSING'), get_role_id('FINANCE_PROCESSOR'), false, false),

  -- 19. Escalate failed payment back to finance rejection
  (get_claim_status_id('L4_PAYMENT_FAILED'), get_claim_status_id('L3_REJECTED_FINANCE'), get_role_id('FINANCE_PROCESSOR'), true, false),

  -- 20. Employee edits returned claim (back to draft)
  (get_claim_status_id('RETURNED_FOR_MODIFICATION'), get_claim_status_id('DRAFT'), get_role_id('EMPLOYEE'), false, false),

  -- 21. Employee resubmits returned claim
  (get_claim_status_id('RETURNED_FOR_MODIFICATION'), get_claim_status_id('SUBMITTED'), get_role_id('EMPLOYEE'), false, false);
