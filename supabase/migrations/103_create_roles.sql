-- Migration 103: Create roles table for RBAC
-- Purpose: System roles separate from job designations
-- Part of: Phase 1 - Master Tables (ID-Based Architecture Migration)
-- CRITICAL: Roles are system permissions, NOT job titles

BEGIN;

-- =============================================================================
-- 1. Create roles table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_code VARCHAR(50) UNIQUE NOT NULL,
    role_name VARCHAR(255) UNIQUE NOT NULL,
    role_description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.roles IS 'System roles for RBAC. Separate from job designations.';
COMMENT ON COLUMN public.roles.role_code IS 'Machine-readable code. Used in backend logic.';

-- =============================================================================
-- 2. Seed data
-- =============================================================================
INSERT INTO public.roles (role_code, role_name, role_description)
VALUES
    ('EMPLOYEE', 'Employee', 'Standard employee who can submit expense claims'),
    ('APPROVER_L1', 'Level 1 Approver', 'State Business Head level approval (L1)'),
    ('APPROVER_L2', 'Level 2 Approver', 'Program Manager / HOD level approval (L2)'),
    ('FINANCE_REVIEWER', 'Finance Reviewer', 'Finance team review and verification (L3)'),
    ('FINANCE_PROCESSOR', 'Finance Processor', 'Finance team payment processing (L4)'),
    ('ADMIN', 'System Administrator', 'Full system access and configuration'),
    ('HR_MANAGER', 'HR Manager', 'Manage employee data and designations')
ON CONFLICT (role_code) DO NOTHING;

-- =============================================================================
-- 3. Create indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_roles_code ON public.roles(role_code);
CREATE INDEX IF NOT EXISTS idx_roles_active ON public.roles(is_active);

-- =============================================================================
-- 4. Enable RLS
-- =============================================================================
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_read_all"
    ON public.roles
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "roles_admin_write"
    ON public.roles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;
