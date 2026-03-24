-- Migration 107: Create claim_statuses table
-- New L1/L2/L3/L4 claim status hierarchy (ID-based, replaces text-based statuses)
-- This table coexists with claim_status_catalog (old) during migration

CREATE TABLE IF NOT EXISTS claim_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_code VARCHAR(50) UNIQUE NOT NULL,
  status_name VARCHAR(100) UNIQUE NOT NULL,
  status_description TEXT,
  approval_level INTEGER, -- 1, 2, 3, 4, or NULL for non-approval statuses
  is_approval BOOLEAN DEFAULT false,
  is_rejection BOOLEAN DEFAULT false,
  is_terminal BOOLEAN DEFAULT false,
  is_payment_issued BOOLEAN DEFAULT false,
  requires_comment BOOLEAN DEFAULT false,
  display_color VARCHAR(20),
  display_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_claim_statuses_code ON claim_statuses(status_code);
CREATE INDEX IF NOT EXISTS idx_claim_statuses_level ON claim_statuses(approval_level);
CREATE INDEX IF NOT EXISTS idx_claim_statuses_active ON claim_statuses(is_active);

-- RLS
ALTER TABLE claim_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claim_statuses_read_all" ON claim_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "claim_statuses_write_service" ON claim_statuses FOR ALL TO service_role USING (true);

-- Seed data: 16 statuses covering Draft → L1 → L2 → L3 → L4 → Issued workflow
INSERT INTO claim_statuses (status_code, status_name, status_description, approval_level, is_approval, is_rejection, is_terminal, is_payment_issued, requires_comment, display_color, display_order)
VALUES
  -- Draft & Submission stages (level NULL)
  ('DRAFT', 'Draft', 'Employee is creating/editing the claim', NULL, false, false, false, false, false, 'gray', 1),
  ('SUBMITTED', 'Submitted', 'Claim submitted by employee, awaiting review', NULL, false, false, false, false, false, 'blue', 2),

  -- Level 1: State Business Head approval
  ('L1_PENDING', 'L1 - Pending Review', 'Awaiting State Business Head approval', 1, false, false, false, false, false, 'yellow', 3),
  ('L1_APPROVED', 'L1 - Approved', 'Approved by State Business Head, moving to L2', 1, true, false, false, false, false, 'green', 4),
  ('L1_REJECTED', 'L1 - Rejected', 'Rejected by State Business Head', 1, false, true, true, false, true, 'red', 5),

  -- Level 2: Program Manager / HOD approval
  ('L2_PENDING', 'L2 - Pending Review', 'Awaiting Program Manager approval', 2, false, false, false, false, false, 'yellow', 6),
  ('L2_APPROVED', 'L2 - Approved', 'Approved by Program Manager, moving to Finance Review', 2, true, false, false, false, false, 'green', 7),
  ('L2_REJECTED', 'L2 - Rejected', 'Rejected by Program Manager', 2, false, true, true, false, true, 'red', 8),

  -- Level 3: Finance Review
  ('L3_PENDING_FINANCE_REVIEW', 'L3 - Finance Review', 'Awaiting Finance team review and verification', 3, false, false, false, false, false, 'yellow', 9),
  ('L3_APPROVED_FINANCE', 'L3 - Finance Approved', 'Approved by Finance team, ready for payment', 3, true, false, false, false, false, 'green', 10),
  ('L3_REJECTED_FINANCE', 'L3 - Finance Rejected', 'Rejected by Finance team', 3, false, true, true, false, true, 'red', 11),

  -- Level 4: Payment Processing
  ('L4_PENDING_PAYMENT_PROCESSING', 'L4 - Payment Processing', 'Finance team processing payment', 4, false, false, false, false, false, 'yellow', 12),
  ('L4_ISSUED', 'L4 - Payment Issued', 'Payment has been issued to employee', 4, true, false, true, true, false, 'green', 13),
  ('L4_PAYMENT_FAILED', 'L4 - Payment Failed', 'Payment processing failed, requires investigation', 4, false, false, false, false, true, 'red', 14),

  -- Cross-level status
  ('RETURNED_FOR_MODIFICATION', 'Returned for Modification', 'Claim returned to employee for corrections', NULL, false, false, false, false, true, 'orange', 15);
