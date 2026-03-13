-- Migration 117: Create validation_rules table
-- Dynamic validation rules — REPLACES HARDCODED CONSTANTS
-- JSONB values allow flexible rule structures

CREATE TABLE IF NOT EXISTS validation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code VARCHAR(100) UNIQUE NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  rule_value JSONB NOT NULL,
  rule_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vr_code ON validation_rules(rule_code);
CREATE INDEX IF NOT EXISTS idx_vr_active ON validation_rules(is_active);

-- RLS
ALTER TABLE validation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vr_read_all" ON validation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "vr_write_service" ON validation_rules FOR ALL TO service_role USING (true);

-- Seed data from expense_rules.json
INSERT INTO validation_rules (rule_code, rule_name, rule_value, rule_description)
VALUES
  ('MAX_CLAIM_DAYS', 'Maximum days in single claim submission',
   '{"value": 7}', 'Maximum date range for claim submission'),

  ('FUTURE_DATES_ALLOWED', 'Allow future date claims',
   '{"value": false}', 'Whether employees can submit claims for future dates'),

  ('FUEL_TAXI_MUTUAL_EXCLUSION', 'Fuel and taxi mutually exclusive',
   '{"value": true}', 'Cannot claim both fuel and taxi for same day'),

  ('MAX_TAXI_BILLS_PER_DAY', 'Maximum taxi bills per day',
   '{"value": null, "unlimited": true}', 'Multiple taxi bills per day are allowed'),

  ('MAX_FUEL_ENTRIES_PER_DAY', 'Maximum fuel entries per day',
   '{"value": 1}', 'Only 1 fuel entry per day is allowed'),

  ('DUPLICATE_CLAIM_DATE_CHECK', 'Block duplicate employee-date claims',
   '{"value": true}', 'Reject duplicate claims for the same employee on the same date');
