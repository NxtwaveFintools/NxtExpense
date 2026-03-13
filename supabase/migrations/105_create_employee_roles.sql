-- Migration 105: Create employee_roles junction table
-- Purpose: Many-to-many relationship between employees and system roles
-- Part of: Phase 1 - Master Tables (ID-Based Architecture Migration)
-- CRITICAL: This replaces email-based permission checks with role-based RBAC

BEGIN;

-- =============================================================================
-- 1. Create employee_roles junction table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employee_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES public.employees(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(employee_id, role_id)
);

COMMENT ON TABLE public.employee_roles IS 'Junction: employees to system roles (RBAC). One employee can have multiple roles.';

-- =============================================================================
-- 2. Assign roles based on current designation logic
-- =============================================================================

-- All employees get EMPLOYEE role
INSERT INTO public.employee_roles (employee_id, role_id)
SELECT e.id, r.id
FROM public.employees e
CROSS JOIN public.roles r
WHERE r.role_code = 'EMPLOYEE'
ON CONFLICT (employee_id, role_id) DO NOTHING;

-- SBH employees get APPROVER_L1 role (they approve SRO/BOA/ABH claims)
INSERT INTO public.employee_roles (employee_id, role_id)
SELECT e.id, r.id
FROM public.employees e
JOIN public.designations d ON d.id = e.designation_id
CROSS JOIN public.roles r
WHERE d.designation_code = 'SBH'
  AND r.role_code = 'APPROVER_L1'
ON CONFLICT (employee_id, role_id) DO NOTHING;

-- ZBH employees get APPROVER_L1 role (they also approve SRO/BOA/ABH claims in their zone)
INSERT INTO public.employee_roles (employee_id, role_id)
SELECT e.id, r.id
FROM public.employees e
JOIN public.designations d ON d.id = e.designation_id
CROSS JOIN public.roles r
WHERE d.designation_code = 'ZBH'
  AND r.role_code = 'APPROVER_L1'
ON CONFLICT (employee_id, role_id) DO NOTHING;

-- PM (Mansoor) gets APPROVER_L2 + ADMIN roles
INSERT INTO public.employee_roles (employee_id, role_id)
SELECT e.id, r.id
FROM public.employees e
JOIN public.designations d ON d.id = e.designation_id
CROSS JOIN public.roles r
WHERE d.designation_code = 'PM'
  AND r.role_code IN ('APPROVER_L2', 'ADMIN')
ON CONFLICT (employee_id, role_id) DO NOTHING;

-- ZBH also gets APPROVER_L2 role (e.g. Hari Santhosh approves Karnataka/Maharashtra SBH claims)
INSERT INTO public.employee_roles (employee_id, role_id)
SELECT e.id, r.id
FROM public.employees e
JOIN public.designations d ON d.id = e.designation_id
CROSS JOIN public.roles r
WHERE d.designation_code = 'ZBH'
  AND r.role_code = 'APPROVER_L2'
ON CONFLICT (employee_id, role_id) DO NOTHING;

-- Finance employees get FINANCE_REVIEWER + FINANCE_PROCESSOR roles
INSERT INTO public.employee_roles (employee_id, role_id)
SELECT e.id, r.id
FROM public.employees e
JOIN public.designations d ON d.id = e.designation_id
CROSS JOIN public.roles r
WHERE d.designation_code = 'FIN'
  AND r.role_code IN ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
ON CONFLICT (employee_id, role_id) DO NOTHING;

-- Admin employees get ADMIN role
INSERT INTO public.employee_roles (employee_id, role_id)
SELECT e.id, r.id
FROM public.employees e
JOIN public.designations d ON d.id = e.designation_id
CROSS JOIN public.roles r
WHERE d.designation_code = 'ADM'
  AND r.role_code = 'ADMIN'
ON CONFLICT (employee_id, role_id) DO NOTHING;

-- =============================================================================
-- 3. Create indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_employee_roles_employee ON public.employee_roles(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_roles_role ON public.employee_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_employee_roles_active ON public.employee_roles(is_active);

-- =============================================================================
-- 4. Enable RLS
-- =============================================================================
ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;

-- Users can see their own roles
CREATE POLICY "employee_roles_read_own"
    ON public.employee_roles
    FOR SELECT
    TO authenticated
    USING (
        employee_id IN (
            SELECT id FROM public.employees
            WHERE employee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );

-- Approvers and admins can see all roles (needed for approval routing)
CREATE POLICY "employee_roles_read_for_approvers"
    ON public.employee_roles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.employee_roles er
            JOIN public.employees e ON e.id = er.employee_id
            JOIN public.roles r ON r.id = er.role_id
            WHERE e.employee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
              AND r.role_code IN ('APPROVER_L1', 'APPROVER_L2', 'FINANCE_REVIEWER', 'FINANCE_PROCESSOR', 'ADMIN')
              AND er.is_active = true
        )
    );

CREATE POLICY "employee_roles_admin_write"
    ON public.employee_roles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;
