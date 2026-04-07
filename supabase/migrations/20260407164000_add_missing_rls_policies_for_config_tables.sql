BEGIN;

ALTER TABLE public.approver_selection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approver_selection_rules_read_all
  ON public.approver_selection_rules;
CREATE POLICY approver_selection_rules_read_all
  ON public.approver_selection_rules
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS approver_selection_rules_admin_write
  ON public.approver_selection_rules;
CREATE POLICY approver_selection_rules_admin_write
  ON public.approver_selection_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees current_emp
      JOIN public.employee_roles er ON er.employee_id = current_emp.id
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(current_emp.employee_email) = public.current_user_email()
        AND er.is_active = true
        AND r.is_admin_role = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees current_emp
      JOIN public.employee_roles er ON er.employee_id = current_emp.id
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(current_emp.employee_email) = public.current_user_email()
        AND er.is_active = true
        AND r.is_admin_role = true
    )
  );

DROP POLICY IF EXISTS config_versions_read_all
  ON public.config_versions;
CREATE POLICY config_versions_read_all
  ON public.config_versions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS config_versions_admin_write
  ON public.config_versions;
CREATE POLICY config_versions_admin_write
  ON public.config_versions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees current_emp
      JOIN public.employee_roles er ON er.employee_id = current_emp.id
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(current_emp.employee_email) = public.current_user_email()
        AND er.is_active = true
        AND r.is_admin_role = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees current_emp
      JOIN public.employee_roles er ON er.employee_id = current_emp.id
      JOIN public.roles r ON r.id = er.role_id
      WHERE lower(current_emp.employee_email) = public.current_user_email()
        AND er.is_active = true
        AND r.is_admin_role = true
    )
  );

GRANT SELECT ON public.approver_selection_rules TO authenticated;
GRANT SELECT ON public.config_versions TO authenticated;

COMMIT;
