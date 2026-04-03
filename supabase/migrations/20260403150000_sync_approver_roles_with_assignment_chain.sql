BEGIN;

-- Ensure approver roles exist and are active before syncing assignments.
INSERT INTO public.roles (
  role_code,
  role_name,
  is_admin_role,
  is_finance_role,
  is_active,
  updated_at
)
VALUES
  ('APPROVER_L1', 'Approver L1', false, false, true, now()),
  ('APPROVER_L2', 'Approver L2', false, false, true, now())
ON CONFLICT (role_code) DO UPDATE
SET
  is_admin_role = EXCLUDED.is_admin_role,
  is_finance_role = EXCLUDED.is_finance_role,
  is_active = true,
  updated_at = now();

-- Level-1 approvers are employees referenced by approval_employee_id_level_1.
INSERT INTO public.employee_roles (employee_id, role_id, is_active)
SELECT DISTINCT
  e.approval_employee_id_level_1 AS employee_id,
  r.id AS role_id,
  true AS is_active
FROM public.employees e
JOIN public.roles r ON r.role_code = 'APPROVER_L1'
WHERE e.approval_employee_id_level_1 IS NOT NULL
ON CONFLICT (employee_id, role_id) DO UPDATE
SET is_active = true;

-- Level-2 approvers are employees referenced by approval_employee_id_level_3
-- in the current workflow model.
INSERT INTO public.employee_roles (employee_id, role_id, is_active)
SELECT DISTINCT
  e.approval_employee_id_level_3 AS employee_id,
  r.id AS role_id,
  true AS is_active
FROM public.employees e
JOIN public.roles r ON r.role_code = 'APPROVER_L2'
WHERE e.approval_employee_id_level_3 IS NOT NULL
ON CONFLICT (employee_id, role_id) DO UPDATE
SET is_active = true;

COMMIT;