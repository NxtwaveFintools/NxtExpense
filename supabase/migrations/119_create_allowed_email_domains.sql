-- Migration 119: Create allowed_email_domains table
-- Corporate email domain validation — REPLACES HARDCODED ARRAY

CREATE TABLE IF NOT EXISTS allowed_email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_name VARCHAR(255) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aed_domain ON allowed_email_domains(domain_name);
CREATE INDEX IF NOT EXISTS idx_aed_active ON allowed_email_domains(is_active);

-- RLS
ALTER TABLE allowed_email_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aed_read_all" ON allowed_email_domains FOR SELECT TO authenticated USING (true);
CREATE POLICY "aed_write_service" ON allowed_email_domains FOR ALL TO service_role USING (true);

-- Seed data
INSERT INTO allowed_email_domains (domain_name) VALUES ('nxtwave.co.in');
