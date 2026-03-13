-- Migration 110: Create designation_approval_flow table
-- Maps which designations require which approval levels
-- SRO/BOA/ABH need all 4 levels; SBH/ZBH/PM skip L1

CREATE TABLE IF NOT EXISTS designation_approval_flow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designation_id UUID NOT NULL REFERENCES designations(id) UNIQUE,
  required_approval_levels INTEGER[] NOT NULL, -- e.g., {1,2,3,4} or {2,3,4}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE designation_approval_flow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daf_read_all" ON designation_approval_flow FOR SELECT TO authenticated USING (true);
CREATE POLICY "daf_write_service" ON designation_approval_flow FOR ALL TO service_role USING (true);

-- Seed data: approval levels per designation
INSERT INTO designation_approval_flow (designation_id, required_approval_levels)
VALUES
  -- Junior designations need all 4 levels (L1 → L2 → L3 → L4)
  (get_designation_id('SRO'), ARRAY[1,2,3,4]),
  (get_designation_id('BOA'), ARRAY[1,2,3,4]),
  (get_designation_id('ABH'), ARRAY[1,2,3,4]),
  -- Senior designations skip L1 (L2 → L3 → L4)
  (get_designation_id('SBH'), ARRAY[2,3,4]),
  (get_designation_id('ZBH'), ARRAY[2,3,4]),
  (get_designation_id('PM'),  ARRAY[2,3,4]);
