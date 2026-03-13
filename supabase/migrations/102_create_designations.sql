-- Migration 102: Create designations master table
-- Purpose: Replace PostgreSQL designation_type enum with lookup table
-- Part of: Phase 1 - Master Tables (ID-Based Architecture Migration)
-- CRITICAL: Business logic must reference designation_id, NEVER designation_name text

BEGIN;

-- =============================================================================
-- 1. Create designations table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designation_code VARCHAR(50) UNIQUE NOT NULL,
    designation_name VARCHAR(255) UNIQUE NOT NULL,
    designation_abbreviation VARCHAR(10),
    hierarchy_level INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.designations IS 'Master table for job designations. Business logic references id, not name.';
COMMENT ON COLUMN public.designations.hierarchy_level IS '1=Junior (SRO), 6=Senior (PM). Used for ordering.';
COMMENT ON COLUMN public.designations.designation_abbreviation IS 'Short form for display (SRO, BOA, ABH, SBH, ZBH, PM)';

-- =============================================================================
-- 2. Seed data (from expense_rules.json and employees.json)
-- =============================================================================
INSERT INTO public.designations (designation_code, designation_name, designation_abbreviation, hierarchy_level, is_active)
VALUES
    ('SRO', 'Student Relationship Officer', 'SRO', 1, true),
    ('BOA', 'Business Operation Associate', 'BOA', 2, true),
    ('ABH', 'Area Business Head', 'ABH', 3, true),
    ('SBH', 'State Business Head', 'SBH', 4, true),
    ('ZBH', 'Zonal Business Head', 'ZBH', 5, true),
    ('PM', 'Program Manager', 'PM', 6, true),
    ('FIN', 'Finance', 'FIN', 7, true),
    ('ADM', 'Admin', 'ADM', 8, true)
ON CONFLICT (designation_code) DO NOTHING;

-- =============================================================================
-- 3. Create indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_designations_code ON public.designations(designation_code);
CREATE INDEX IF NOT EXISTS idx_designations_hierarchy ON public.designations(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_designations_active ON public.designations(is_active);

-- =============================================================================
-- 4. Enable RLS
-- =============================================================================
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designations_read_all"
    ON public.designations
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "designations_admin_write"
    ON public.designations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;
