BEGIN;

-- Migration 116: Create expense_rates table (ID-based)
-- Replaces magic numbers and supplements expense_reimbursement_rates
-- Uses designation_id and location_id FKs instead of text enums
-- Supports effective_from/effective_to for historical rate tracking

CREATE OR REPLACE FUNCTION get_work_location_id(p_code VARCHAR) RETURNS UUID AS $$
  SELECT id FROM work_locations WHERE location_code = p_code;
$$ LANGUAGE sql STABLE;

CREATE TABLE IF NOT EXISTS expense_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designation_id UUID REFERENCES designations(id), -- NULL means applies to all designations
  location_id UUID REFERENCES work_locations(id),
  expense_type VARCHAR(50) NOT NULL, -- 'FOOD_BASE', 'FOOD_OUTSTATION', 'ACCOMMODATION', etc.
  rate_amount DECIMAL(10,2) NOT NULL,
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE, -- NULL means currently active
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_er_designation ON expense_rates(designation_id);
CREATE INDEX IF NOT EXISTS idx_er_location ON expense_rates(location_id);
CREATE INDEX IF NOT EXISTS idx_er_type ON expense_rates(expense_type);
CREATE INDEX IF NOT EXISTS idx_er_active ON expense_rates(is_active);
CREATE INDEX IF NOT EXISTS idx_er_effective ON expense_rates(effective_from, effective_to);

-- RLS
ALTER TABLE expense_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "er_read_all" ON expense_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "er_write_service" ON expense_rates FOR ALL TO service_role USING (true);

-- Seed data from expense_rules.json
INSERT INTO expense_rates (designation_id, location_id, expense_type, rate_amount)
VALUES
  -- Food base location (all designations): ₹120/day
  (NULL, get_work_location_id('FIELD_BASE'), 'FOOD_BASE', 120.00),

  -- Food outstation (all designations): ₹350/day
  (NULL, get_work_location_id('FIELD_OUTSTATION'), 'FOOD_OUTSTATION', 350.00),

  -- Accommodation: SRO/BOA/ABH → ₹1,000/night
  (get_designation_id('SRO'), get_work_location_id('FIELD_OUTSTATION'), 'ACCOMMODATION', 1000.00),
  (get_designation_id('BOA'), get_work_location_id('FIELD_OUTSTATION'), 'ACCOMMODATION', 1000.00),
  (get_designation_id('ABH'), get_work_location_id('FIELD_OUTSTATION'), 'ACCOMMODATION', 1000.00),

  -- Accommodation: SBH/ZBH/PM → ₹2,000/night
  (get_designation_id('SBH'), get_work_location_id('FIELD_OUTSTATION'), 'ACCOMMODATION', 2000.00),
  (get_designation_id('ZBH'), get_work_location_id('FIELD_OUTSTATION'), 'ACCOMMODATION', 2000.00),
  (get_designation_id('PM'),  get_work_location_id('FIELD_OUTSTATION'), 'ACCOMMODATION', 2000.00);


COMMIT;
