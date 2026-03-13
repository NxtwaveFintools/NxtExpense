-- Migration 100: Create employee_statuses lookup table
-- Purpose: Replace hardcoded employee status checks with ID-based lookups
-- Part of: Phase 1 - Master Tables (ID-Based Architecture Migration)

BEGIN;

-- =============================================================================
-- 1. Create employee_statuses table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employee_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_code VARCHAR(50) UNIQUE NOT NULL,
    status_name VARCHAR(100) UNIQUE NOT NULL,
    is_active_status BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add table comment
COMMENT ON TABLE public.employee_statuses IS 'Lookup table for employee statuses (Active, Inactive, etc.)';
COMMENT ON COLUMN public.employee_statuses.is_active_status IS 'True if this status means the employee is currently working';

-- =============================================================================
-- 2. Seed data
-- =============================================================================
INSERT INTO public.employee_statuses (status_code, status_name, is_active_status, display_order)
VALUES
    ('ACTIVE', 'Active', true, 1),
    ('INACTIVE', 'Inactive', false, 2),
    ('ON_LEAVE', 'On Leave', true, 3),
    ('TERMINATED', 'Terminated', false, 4),
    ('RESIGNED', 'Resigned', false, 5)
ON CONFLICT (status_code) DO NOTHING;

-- =============================================================================
-- 3. Create indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_employee_statuses_code ON public.employee_statuses(status_code);
CREATE INDEX IF NOT EXISTS idx_employee_statuses_active ON public.employee_statuses(is_active_status);

-- =============================================================================
-- 4. Enable RLS
-- =============================================================================
ALTER TABLE public.employee_statuses ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read employee statuses (lookup table)
CREATE POLICY "employee_statuses_read_all"
    ON public.employee_statuses
    FOR SELECT
    TO authenticated
    USING (true);

-- Only service role can modify (admin operations)
CREATE POLICY "employee_statuses_admin_write"
    ON public.employee_statuses
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;
