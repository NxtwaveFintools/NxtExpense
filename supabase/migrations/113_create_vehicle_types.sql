BEGIN;

-- Migration 113: Create vehicle_types table
-- Replaces PostgreSQL vehicle_type enum with ID-based lookup table
-- Includes rate and limit data per vehicle type

CREATE TABLE IF NOT EXISTS vehicle_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_code VARCHAR(50) UNIQUE NOT NULL,
  vehicle_name VARCHAR(100) UNIQUE NOT NULL,
  base_fuel_rate_per_day DECIMAL(10,2),
  intercity_rate_per_km DECIMAL(10,2),
  max_km_round_trip INTEGER,
  display_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vt_code ON vehicle_types(vehicle_code);
CREATE INDEX IF NOT EXISTS idx_vt_active ON vehicle_types(is_active);

-- RLS
ALTER TABLE vehicle_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vt_read_all" ON vehicle_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "vt_write_service" ON vehicle_types FOR ALL TO service_role USING (true);

-- Seed data: 2 vehicle types with rates from expense_rules.json
INSERT INTO vehicle_types (vehicle_code, vehicle_name, base_fuel_rate_per_day, intercity_rate_per_km, max_km_round_trip, display_order)
VALUES
  ('TWO_WHEELER',  'Two Wheeler',  180.00, 5.00, 150, 1),
  ('FOUR_WHEELER', 'Four Wheeler', 300.00, 8.00, 300, 2);


COMMIT;
