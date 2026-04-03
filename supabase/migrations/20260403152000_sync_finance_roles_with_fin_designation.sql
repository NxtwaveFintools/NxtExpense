BEGIN;

-- Ensure FINANCE_TEAM role exists with finance capability enabled.
INSERT INTO public.roles (
  role_code,
  role_name,
  is_admin_role,
  is_finance_role,
  is_active,
  updated_at
)
VALUES ('FINANCE_TEAM', 'Finance Team', false, true, true, now())
ON CONFLICT (role_code) DO UPDATE
SET
  role_name = EXCLUDED.role_name,
  is_admin_role = false,
  is_finance_role = true,
  is_active = true,
  updated_at = now();

-- Any employee with FIN designation must have active FINANCE_TEAM role.
INSERT INTO public.employee_roles (employee_id, role_id, is_active)
SELECT
  e.id,
  r.id,
  true
FROM public.employees e
JOIN public.designations d
  ON d.id = e.designation_id
JOIN public.roles r
  ON r.role_code = 'FINANCE_TEAM'
WHERE d.designation_code = 'FIN'
ON CONFLICT (employee_id, role_id) DO UPDATE
SET is_active = true;

COMMIT;