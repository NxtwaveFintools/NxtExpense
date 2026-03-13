-- =============================================================================
-- NxtExpense — Proposed Configuration Schema
-- =============================================================================
-- These are ADDITIVE migrations only. No existing tables are dropped or altered
-- destructively. All new tables are configuration/lookup tables.
-- =============================================================================


-- =============================================================================
-- Migration 022: designation_config
-- =============================================================================
-- Centralizes all designation-level business rules.
-- Replaces: FOUR_WHEELER_ALLOWED_DESIGNATIONS, abbreviation mapping,
--           actor_filter_code mapping, dashboard access checks
-- =============================================================================

CREATE TABLE public.designation_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designation designation_type UNIQUE NOT NULL,
  abbreviation text,                              -- 'SRO', 'BOA', 'ABH', etc.
  allowed_vehicle_types vehicle_type[] NOT NULL DEFAULT '{}',
  max_km_two_wheeler integer DEFAULT 150,
  max_km_four_wheeler integer DEFAULT 300,
  can_create_claims boolean NOT NULL DEFAULT true,
  can_view_finance_queue boolean NOT NULL DEFAULT false,
  can_view_admin_panel boolean NOT NULL DEFAULT false,
  actor_filter_code text,                         -- 'sbh', 'hod', 'finance', null
  approval_level_start integer NOT NULL DEFAULT 1,
  skip_approval_levels integer[] DEFAULT '{}',    -- e.g., '{2}' to skip L2
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: Read access for all authenticated users
ALTER TABLE public.designation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designation_config_select_authenticated"
  ON public.designation_config
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "designation_config_modify_admin"
  ON public.designation_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.email = auth.jwt()->>'email'
        AND employees.designation = 'Admin'
    )
  );

-- Indexes
CREATE INDEX idx_designation_config_designation 
  ON public.designation_config(designation);
CREATE INDEX idx_designation_config_active 
  ON public.designation_config(is_active) WHERE is_active = true;

-- Seed data
INSERT INTO public.designation_config 
  (designation, abbreviation, allowed_vehicle_types, can_create_claims, can_view_finance_queue, can_view_admin_panel, actor_filter_code, skip_approval_levels, sort_order)
VALUES
  ('Student Relationship Officer', 'SRO', '{"Two Wheeler"}',                   true,  false, false, null,      '{2}', 1),
  ('Business Operation Associate', 'BOA', '{"Two Wheeler"}',                   true,  false, false, null,      '{2}', 2),
  ('Area Business Head',           'ABH', '{"Two Wheeler"}',                   true,  false, false, null,      '{2}', 3),
  ('State Business Head',          'SBH', '{"Two Wheeler","Four Wheeler"}',    true,  false, false, 'sbh',     '{2}', 4),
  ('Zonal Business Head',          'ZBH', '{"Two Wheeler","Four Wheeler"}',    true,  false, false, 'hod',     '{2}', 5),
  ('Program Manager',              'PM',  '{"Two Wheeler","Four Wheeler"}',    true,  false, false, 'hod',     '{2}', 6),
  ('Finance',                      null,  '{}',                                false, true,  false, 'finance', '{}',  7),
  ('Admin',                        null,  '{}',                                false, false, true,  null,      '{}',  8);


-- =============================================================================
-- Migration 023: Add max_km to expense_reimbursement_rates
-- =============================================================================
-- Replaces: Hardcoded 150 / 300 KM limits in claims/validations/index.ts
-- =============================================================================

ALTER TABLE public.expense_reimbursement_rates
  ADD COLUMN max_km integer;

COMMENT ON COLUMN public.expense_reimbursement_rates.max_km IS
  'Maximum round-trip KM allowed for this vehicle type. Only applicable to intercity_per_km rate_type.';

UPDATE public.expense_reimbursement_rates
SET max_km = 150
WHERE vehicle_type = 'Two Wheeler' AND rate_type = 'intercity_per_km';

UPDATE public.expense_reimbursement_rates
SET max_km = 300
WHERE vehicle_type = 'Four Wheeler' AND rate_type = 'intercity_per_km';


-- =============================================================================
-- Migration 024: transport_types
-- =============================================================================
-- Replaces: TRANSPORT_TYPE_VALUES / TRANSPORT_TYPE_OPTIONS hardcoded arrays
-- =============================================================================

CREATE TABLE public.transport_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transport_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transport_types_select_authenticated"
  ON public.transport_types
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.transport_types (name, sort_order)
VALUES
  ('Rental Vehicle', 1),
  ('Rapido/Uber/Ola', 2);


-- =============================================================================
-- Migration 025: allowed_email_domains
-- =============================================================================
-- Replaces: ALLOWED_EMAIL_DOMAINS in lib/auth/allowed-email-domains.ts
-- =============================================================================

CREATE TABLE public.allowed_email_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.allowed_email_domains ENABLE ROW LEVEL SECURITY;

-- Only accessible via service role (server-side auth checks)
-- No client-facing SELECT policy — server actions use service role client
CREATE POLICY "allowed_email_domains_service_only"
  ON public.allowed_email_domains
  FOR SELECT
  TO service_role
  USING (true);

INSERT INTO public.allowed_email_domains (domain)
VALUES
  ('nxtwave.co.in'),
  ('nxtwave.tech'),
  ('nxtwave.in');


-- =============================================================================
-- Migration 026: system_settings
-- =============================================================================
-- Replaces: .max(500), 'Rs.', 'Asia/Kolkata', pagination limit 100
-- =============================================================================

CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  value_type text NOT NULL DEFAULT 'string'
    CHECK (value_type IN ('string', 'integer', 'boolean', 'json')),
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_settings_select_authenticated"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "system_settings_modify_admin"
  ON public.system_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.email = auth.jwt()->>'email'
        AND employees.designation = 'Admin'
    )
  );

INSERT INTO public.system_settings (key, value, value_type, description)
VALUES
  ('notes_max_length',          '500',          'integer', 'Maximum character length for notes/reason fields'),
  ('currency_symbol',           'Rs.',          'string',  'Currency symbol for display and CSV export'),
  ('timezone',                  'Asia/Kolkata', 'string',  'System timezone for date operations'),
  ('timezone_utc_offset',       '+05:30',       'string',  'UTC offset for date range queries'),
  ('pagination_max_limit',      '100',          'integer', 'Maximum items per page in list views'),
  ('max_claim_date_range_days', '7',            'integer', 'Maximum days in a single claim date range'),
  ('password_min_length',       '6',            'integer', 'Minimum password length for dev auth');
