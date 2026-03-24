BEGIN;

-- Migration 118: Create system_settings table
-- Global system configuration — REPLACES HARDCODED CONSTANTS

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  setting_description TEXT,
  data_type VARCHAR(50) NOT NULL, -- 'string', 'number', 'boolean', 'json'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ss_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_ss_active ON system_settings(is_active);

-- RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_read_all" ON system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ss_write_service" ON system_settings FOR ALL TO service_role USING (true);

-- Seed data
INSERT INTO system_settings (setting_key, setting_value, setting_description, data_type)
VALUES
  ('COMPANY_NAME', '{"value": "NxtWave"}', 'Company name', 'string'),
  ('CURRENCY_CODE', '{"value": "INR"}', 'Currency code', 'string'),
  ('CURRENCY_SYMBOL', '{"value": "₹"}', 'Currency symbol', 'string'),
  ('DATE_FORMAT', '{"value": "DD/MM/YYYY"}', 'Date display format', 'string'),
  ('FISCAL_YEAR_START_MONTH', '{"value": 4}', 'Fiscal year starts in April', 'number');


COMMIT;
