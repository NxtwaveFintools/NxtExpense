-- Migration 109: Create approval_routing table
-- ID-based approval routing - REPLACES email-based state_mapping.json
-- Defines who approves what based on designation and state

CREATE TABLE IF NOT EXISTS approval_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_designation_id UUID NOT NULL REFERENCES designations(id),
  submitter_state_id UUID REFERENCES states(id), -- NULL means applies to all states
  approval_level INTEGER NOT NULL, -- 1, 2, 3, 4
  approver_role_id UUID NOT NULL REFERENCES roles(id),
  approver_designation_id UUID REFERENCES designations(id), -- Optional designation filter
  approver_state_id UUID REFERENCES states(id), -- Optional state filter for same-state routing
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ar_submitter_desg ON approval_routing(submitter_designation_id);
CREATE INDEX IF NOT EXISTS idx_ar_submitter_state ON approval_routing(submitter_state_id);
CREATE INDEX IF NOT EXISTS idx_ar_level ON approval_routing(approval_level);
CREATE INDEX IF NOT EXISTS idx_ar_approver_role ON approval_routing(approver_role_id);
CREATE INDEX IF NOT EXISTS idx_ar_active ON approval_routing(is_active);

-- RLS
ALTER TABLE approval_routing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ar_read_all" ON approval_routing FOR SELECT TO authenticated USING (true);
CREATE POLICY "ar_write_service" ON approval_routing FOR ALL TO service_role USING (true);

-- Helper functions for clean seed data
CREATE OR REPLACE FUNCTION get_designation_id(p_code VARCHAR) RETURNS UUID AS $$
  SELECT id FROM designations WHERE designation_code = p_code;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_state_id(p_code VARCHAR) RETURNS UUID AS $$
  SELECT id FROM states WHERE state_code = p_code;
$$ LANGUAGE sql STABLE;

-- =============================================
-- LEVEL 1 ROUTING: SRO/BOA/ABH → SBH (same state)
-- 3 designations × 11 states = 33 rows
-- =============================================

-- SRO → L1 → SBH per state
INSERT INTO approval_routing (submitter_designation_id, submitter_state_id, approval_level, approver_role_id, approver_designation_id, approver_state_id)
SELECT 
  get_designation_id('SRO'),
  s.id,
  1,
  get_role_id('APPROVER_L1'),
  get_designation_id('SBH'),
  s.id
FROM states s;

-- BOA → L1 → SBH per state
INSERT INTO approval_routing (submitter_designation_id, submitter_state_id, approval_level, approver_role_id, approver_designation_id, approver_state_id)
SELECT 
  get_designation_id('BOA'),
  s.id,
  1,
  get_role_id('APPROVER_L1'),
  get_designation_id('SBH'),
  s.id
FROM states s;

-- ABH → L1 → SBH per state
INSERT INTO approval_routing (submitter_designation_id, submitter_state_id, approval_level, approver_role_id, approver_designation_id, approver_state_id)
SELECT 
  get_designation_id('ABH'),
  s.id,
  1,
  get_role_id('APPROVER_L1'),
  get_designation_id('SBH'),
  s.id
FROM states s;

-- =============================================
-- LEVEL 2 ROUTING: ALL operational designations → PM (Mansoor)
-- No state filter needed (PM approves all states)
-- =============================================
INSERT INTO approval_routing (submitter_designation_id, submitter_state_id, approval_level, approver_role_id, approver_designation_id, approver_state_id)
VALUES
  -- SRO/BOA/ABH need L2 after L1
  (get_designation_id('SRO'), NULL, 2, get_role_id('APPROVER_L2'), get_designation_id('PM'), NULL),
  (get_designation_id('BOA'), NULL, 2, get_role_id('APPROVER_L2'), get_designation_id('PM'), NULL),
  (get_designation_id('ABH'), NULL, 2, get_role_id('APPROVER_L2'), get_designation_id('PM'), NULL),
  -- SBH/ZBH/PM start at L2 (skip L1)
  (get_designation_id('SBH'), NULL, 2, get_role_id('APPROVER_L2'), get_designation_id('PM'), NULL),
  (get_designation_id('ZBH'), NULL, 2, get_role_id('APPROVER_L2'), get_designation_id('PM'), NULL),
  (get_designation_id('PM'),  NULL, 2, get_role_id('APPROVER_L2'), get_designation_id('PM'), NULL);

-- =============================================
-- LEVEL 3 ROUTING: ALL → Finance Reviewer
-- =============================================
INSERT INTO approval_routing (submitter_designation_id, submitter_state_id, approval_level, approver_role_id, approver_designation_id, approver_state_id)
VALUES
  (get_designation_id('SRO'), NULL, 3, get_role_id('FINANCE_REVIEWER'), get_designation_id('FIN'), NULL),
  (get_designation_id('BOA'), NULL, 3, get_role_id('FINANCE_REVIEWER'), get_designation_id('FIN'), NULL),
  (get_designation_id('ABH'), NULL, 3, get_role_id('FINANCE_REVIEWER'), get_designation_id('FIN'), NULL),
  (get_designation_id('SBH'), NULL, 3, get_role_id('FINANCE_REVIEWER'), get_designation_id('FIN'), NULL),
  (get_designation_id('ZBH'), NULL, 3, get_role_id('FINANCE_REVIEWER'), get_designation_id('FIN'), NULL),
  (get_designation_id('PM'),  NULL, 3, get_role_id('FINANCE_REVIEWER'), get_designation_id('FIN'), NULL);

-- =============================================
-- LEVEL 4 ROUTING: ALL → Finance Processor (payment)
-- =============================================
INSERT INTO approval_routing (submitter_designation_id, submitter_state_id, approval_level, approver_role_id, approver_designation_id, approver_state_id)
VALUES
  (get_designation_id('SRO'), NULL, 4, get_role_id('FINANCE_PROCESSOR'), get_designation_id('FIN'), NULL),
  (get_designation_id('BOA'), NULL, 4, get_role_id('FINANCE_PROCESSOR'), get_designation_id('FIN'), NULL),
  (get_designation_id('ABH'), NULL, 4, get_role_id('FINANCE_PROCESSOR'), get_designation_id('FIN'), NULL),
  (get_designation_id('SBH'), NULL, 4, get_role_id('FINANCE_PROCESSOR'), get_designation_id('FIN'), NULL),
  (get_designation_id('ZBH'), NULL, 4, get_role_id('FINANCE_PROCESSOR'), get_designation_id('FIN'), NULL),
  (get_designation_id('PM'),  NULL, 4, get_role_id('FINANCE_PROCESSOR'), get_designation_id('FIN'), NULL);
