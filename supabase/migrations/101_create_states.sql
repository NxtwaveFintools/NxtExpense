-- Migration 101: Create states master table
-- Purpose: Replace text-based state references with ID-based lookups
-- Part of: Phase 1 - Master Tables (ID-Based Architecture Migration)

BEGIN;

-- =============================================================================
-- 1. Create states table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_code VARCHAR(10) UNIQUE NOT NULL,
    state_name VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.states IS 'Master table for geographical states';

-- =============================================================================
-- 2. Seed data (from state_mapping.json)
-- =============================================================================
INSERT INTO public.states (state_code, state_name, is_active, display_order)
VALUES
    ('AP', 'Andhra Pradesh', true, 1),
    ('TG', 'Telangana', true, 2),
    ('TN', 'Tamil Nadu', true, 3),
    ('KL', 'Kerala', true, 4),
    ('KA', 'Karnataka', true, 5),
    ('MH', 'Maharashtra', true, 6),
    ('RJ', 'Rajasthan', true, 7),
    ('DL', 'Delhi NCR', true, 8),
    ('UP', 'Uttar Pradesh', true, 9),
    ('WB', 'West Bengal', true, 10),
    ('OD', 'Odisha', true, 11)
ON CONFLICT (state_code) DO NOTHING;

-- =============================================================================
-- 3. Create indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_states_code ON public.states(state_code);
CREATE INDEX IF NOT EXISTS idx_states_active ON public.states(is_active);

-- =============================================================================
-- 4. Enable RLS
-- =============================================================================
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "states_read_all"
    ON public.states
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "states_admin_write"
    ON public.states
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;
