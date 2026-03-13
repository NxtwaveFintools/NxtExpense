-- Migration 138: Role Consolidation
-- 1. Add FINANCE_TEAM role to replace FINANCE_REVIEWER + FINANCE_PROCESSOR
-- 2. Migrate all active finance employees to FINANCE_TEAM
-- 3. Deactivate FINANCE_REVIEWER, FINANCE_PROCESSOR, HR_MANAGER roles + assignments
-- 4. Remove Mansoor from ADMIN role (new admin will be expenseadmin@nxtwave.co.in)
-- 5. Remove Hari Santhosh and Satya Priya Dash from APPROVER_L2 role
--    (only Mansoor / Program Manager retains APPROVER_L2)

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Add FINANCE_TEAM role
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.roles (role_code, role_name, is_active)
VALUES ('FINANCE_TEAM', 'Finance Team', true)
ON CONFLICT (role_code) DO UPDATE SET is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Grant FINANCE_TEAM to all employees who currently have
--         FINANCE_REVIEWER or FINANCE_PROCESSOR (and whose assignment is active)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.employee_roles (employee_id, role_id, is_active)
SELECT DISTINCT
  er.employee_id,
  (SELECT id FROM public.roles WHERE role_code = 'FINANCE_TEAM'),
  true
FROM public.employee_roles er
JOIN public.roles r ON r.id = er.role_id
WHERE r.role_code IN ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
  AND er.is_active = true
ON CONFLICT (employee_id, role_id) DO UPDATE SET is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Deactivate FINANCE_REVIEWER, FINANCE_PROCESSOR, HR_MANAGER assignments
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.employee_roles er
SET is_active = false
FROM public.roles r
WHERE r.id = er.role_id
  AND r.role_code IN ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR', 'HR_MANAGER');

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Mark the legacy roles themselves as inactive
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.roles
SET is_active = false
WHERE role_code IN ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR', 'HR_MANAGER');

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Remove Mansoor from ADMIN role
--         New admin account (expenseadmin@nxtwave.co.in) will be seeded in 140
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.employee_roles er
SET is_active = false
FROM public.employees e
JOIN public.roles r ON r.role_code = 'ADMIN'
WHERE er.employee_id = e.id
  AND er.role_id = r.id
  AND lower(e.employee_email) = 'mansoor@nxtwave.co.in';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Remove APPROVER_L2 from Hari Santhosh and Satya Priya Dash
--         Only Mansoor (Program Manager) retains APPROVER_L2
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.employee_roles er
SET is_active = false
FROM public.employees e
JOIN public.roles r ON r.role_code = 'APPROVER_L2'
WHERE er.employee_id = e.id
  AND er.role_id = r.id
  AND lower(e.employee_email) IN (
    'harisanthosh.tibirisetty@nxtwave.co.in',
    'satyapriya.dash@nxtwave.co.in'
  );

COMMIT;
