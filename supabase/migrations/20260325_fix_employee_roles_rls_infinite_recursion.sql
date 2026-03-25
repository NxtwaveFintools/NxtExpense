-- Fix: infinite recursion in employee_roles RLS policy
-- The "employee_roles_read_for_approvers" policy queried employee_roles
-- from within a policy on employee_roles, causing PostgreSQL to error with
-- "infinite recursion detected in policy for relation employee_roles".
-- Solution: use a SECURITY DEFINER function to bypass RLS for the role check.

BEGIN;

CREATE OR REPLACE FUNCTION public.auth_user_has_elevated_role()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.employees e ON e.id = er.employee_id
    JOIN public.roles r ON r.id = er.role_id
    WHERE e.employee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    AND r.role_code IN ('APPROVER_L1', 'APPROVER_L2', 'FINANCE_REVIEWER', 'FINANCE_PROCESSOR', 'ADMIN')
    AND er.is_active = true
  );
$$;

DROP POLICY IF EXISTS "employee_roles_read_for_approvers" ON public.employee_roles;

CREATE POLICY "employee_roles_read_for_approvers"
    ON public.employee_roles
    FOR SELECT
    TO authenticated
    USING (public.auth_user_has_elevated_role());

COMMIT;
