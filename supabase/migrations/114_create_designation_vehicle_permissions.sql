BEGIN;

-- Migration 114: Create designation_vehicle_permissions table
-- Defines which designations can use which vehicle types
-- Replaces hardcoded arrays in application code

CREATE TABLE IF NOT EXISTS designation_vehicle_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designation_id UUID NOT NULL REFERENCES designations(id),
  vehicle_type_id UUID NOT NULL REFERENCES vehicle_types(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(designation_id, vehicle_type_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dvp_designation ON designation_vehicle_permissions(designation_id);
CREATE INDEX IF NOT EXISTS idx_dvp_vehicle ON designation_vehicle_permissions(vehicle_type_id);

-- RLS
ALTER TABLE designation_vehicle_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dvp_read_all" ON designation_vehicle_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "dvp_write_service" ON designation_vehicle_permissions FOR ALL TO service_role USING (true);

-- Helper function for vehicle type lookup
CREATE OR REPLACE FUNCTION get_vehicle_type_id(p_code VARCHAR) RETURNS UUID AS $$
  SELECT id FROM vehicle_types WHERE vehicle_code = p_code;
$$ LANGUAGE sql STABLE;

-- Seed data based on expense_rules.json:
-- SRO/BOA: Two Wheeler only
-- ABH: Two Wheeler only
-- SBH/ZBH/PM: Both Two Wheeler and Four Wheeler
INSERT INTO designation_vehicle_permissions (designation_id, vehicle_type_id)
VALUES
  -- SRO → Two Wheeler only
  (get_designation_id('SRO'), get_vehicle_type_id('TWO_WHEELER')),
  -- BOA → Two Wheeler only
  (get_designation_id('BOA'), get_vehicle_type_id('TWO_WHEELER')),
  -- ABH → Two Wheeler only
  (get_designation_id('ABH'), get_vehicle_type_id('TWO_WHEELER')),
  -- SBH → Both
  (get_designation_id('SBH'), get_vehicle_type_id('TWO_WHEELER')),
  (get_designation_id('SBH'), get_vehicle_type_id('FOUR_WHEELER')),
  -- ZBH → Both
  (get_designation_id('ZBH'), get_vehicle_type_id('TWO_WHEELER')),
  (get_designation_id('ZBH'), get_vehicle_type_id('FOUR_WHEELER')),
  -- PM → Both
  (get_designation_id('PM'), get_vehicle_type_id('TWO_WHEELER')),
  (get_designation_id('PM'), get_vehicle_type_id('FOUR_WHEELER'));


COMMIT;
