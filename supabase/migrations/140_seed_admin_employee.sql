-- Migration 140: Seed admin employee record for expenseadmin@nxtwave.co.in
-- Creates the employee row and assigns the ADMIN role.
-- The Supabase Auth user must be created separately via the provisioning script.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Insert the admin employee record
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.employees (
  employee_id,
  employee_name,
  employee_email,
  state,
  designation,
  designation_id,
  employee_status_id
)
SELECT
  'ADMIN001',
  'Expense Admin',
  'expenseadmin@nxtwave.co.in',
  'All States',
  'Admin',
  (SELECT id FROM public.designations WHERE designation_code = 'ADM'),
  (SELECT id FROM public.employee_statuses WHERE status_code = 'ACTIVE')
WHERE NOT EXISTS (
  SELECT 1 FROM public.employees WHERE lower(employee_email) = 'expenseadmin@nxtwave.co.in'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Assign ADMIN role to the new admin employee
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.employee_roles (employee_id, role_id, is_active)
SELECT
  e.id,
  r.id,
  true
FROM public.employees e
CROSS JOIN public.roles r
WHERE lower(e.employee_email) = 'expenseadmin@nxtwave.co.in'
  AND r.role_code = 'ADMIN'
ON CONFLICT (employee_id, role_id) DO UPDATE SET is_active = true;

COMMIT;
