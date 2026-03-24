BEGIN;

-- Migration 115: Create transport_types table
-- Master table for transport types (Taxi, Bus, Train, etc.)

CREATE TABLE IF NOT EXISTS transport_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_code VARCHAR(50) UNIQUE NOT NULL,
  transport_name VARCHAR(100) UNIQUE NOT NULL,
  display_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tt_code ON transport_types(transport_code);
CREATE INDEX IF NOT EXISTS idx_tt_active ON transport_types(is_active);

-- RLS
ALTER TABLE transport_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tt_read_all" ON transport_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "tt_write_service" ON transport_types FOR ALL TO service_role USING (true);

-- Seed data: transport types
INSERT INTO transport_types (transport_code, transport_name, display_order)
VALUES
  ('TAXI',       'Taxi',           1),
  ('AUTO',       'Auto Rickshaw',  2),
  ('BUS',        'Bus',            3),
  ('TRAIN',      'Train',          4),
  ('FLIGHT',     'Flight',         5),
  ('RENTAL_CAR', 'Rental Car',     6);


COMMIT;
