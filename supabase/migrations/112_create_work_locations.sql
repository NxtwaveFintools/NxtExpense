BEGIN;

-- Migration 112: Create work_locations table
-- Replaces PostgreSQL work_location_type enum with ID-based lookup table

CREATE TABLE IF NOT EXISTS work_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_code VARCHAR(50) UNIQUE NOT NULL,
  location_name VARCHAR(100) UNIQUE NOT NULL,
  requires_vehicle_selection BOOLEAN DEFAULT false,
  requires_outstation_details BOOLEAN DEFAULT false,
  display_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wl_code ON work_locations(location_code);
CREATE INDEX IF NOT EXISTS idx_wl_active ON work_locations(is_active);

-- RLS
ALTER TABLE work_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wl_read_all" ON work_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "wl_write_service" ON work_locations FOR ALL TO service_role USING (true);

-- Seed data: 5 work location types
INSERT INTO work_locations (location_code, location_name, requires_vehicle_selection, requires_outstation_details, display_order)
VALUES
  ('OFFICE_WFH',       'Office / WFH',            false, false, 1),
  ('FIELD_BASE',       'Field – Base Location',    true,  false, 2),
  ('FIELD_OUTSTATION', 'Field – Outstation',       false, true,  3),
  ('LEAVE',            'Leave',                    false, false, 4),
  ('WEEK_OFF',         'Week-off',                 false, false, 5);


COMMIT;
