BEGIN;

-- Rollback for 20260403110000_seed_test_flow_auth_accounts.sql
-- Removes only the seeded test-flow accounts and their dependent records.
DO $$
DECLARE
  v_now timestamptz := now();
  v_target_emails text[] := ARRAY[
    'sro@nxtwave.co.in',
    'sbh@nxtwave.co.in',
    'hod@nxtwave.co.in',
    'finance1@nxtwave.co.in'
  ];
  v_target_employee_codes text[] := ARRAY[
    'TSTSRO001',
    'TSTSBH001',
    'TSTPM001',
    'TSTFIN001'
  ];
BEGIN
  CREATE TEMP TABLE _rollback_target_employees ON COMMIT DROP AS
  SELECT e.id, e.employee_id, lower(e.employee_email) AS employee_email
  FROM public.employees e
  WHERE e.employee_id = ANY(v_target_employee_codes)
     OR lower(e.employee_email) = ANY(v_target_emails);

  -- Remove approver references from all employees before deleting target employees.
  UPDATE public.employees e
  SET
    approval_employee_id_level_1 = CASE
      WHEN e.approval_employee_id_level_1 IN (SELECT id FROM _rollback_target_employees)
        THEN NULL
      ELSE e.approval_employee_id_level_1
    END,
    approval_employee_id_level_2 = CASE
      WHEN e.approval_employee_id_level_2 IN (SELECT id FROM _rollback_target_employees)
        THEN NULL
      ELSE e.approval_employee_id_level_2
    END,
    approval_employee_id_level_3 = CASE
      WHEN e.approval_employee_id_level_3 IN (SELECT id FROM _rollback_target_employees)
        THEN NULL
      ELSE e.approval_employee_id_level_3
    END,
    updated_at = v_now
  WHERE e.approval_employee_id_level_1 IN (SELECT id FROM _rollback_target_employees)
     OR e.approval_employee_id_level_2 IN (SELECT id FROM _rollback_target_employees)
     OR e.approval_employee_id_level_3 IN (SELECT id FROM _rollback_target_employees);

  -- Remove employee-referenced records that would block deletes.
  DELETE FROM public.admin_logs
  WHERE admin_id IN (SELECT id FROM _rollback_target_employees);

  DELETE FROM public.employee_replacements
  WHERE old_employee_id IN (SELECT id FROM _rollback_target_employees)
     OR new_employee_id IN (SELECT id FROM _rollback_target_employees)
     OR replaced_by_admin_id IN (SELECT id FROM _rollback_target_employees);

  DELETE FROM public.approval_history
  WHERE approver_employee_id IN (SELECT id FROM _rollback_target_employees);

  DELETE FROM public.finance_actions
  WHERE actor_employee_id IN (SELECT id FROM _rollback_target_employees);

  UPDATE public.employee_roles
  SET assigned_by = NULL
  WHERE assigned_by IN (SELECT id FROM _rollback_target_employees);

  UPDATE public.expense_claims
  SET
    last_rejected_by_employee_id = NULL,
    updated_at = v_now
  WHERE last_rejected_by_employee_id IN (SELECT id FROM _rollback_target_employees);

  -- Remove claims owned by target users (claim child rows cascade by FK).
  DELETE FROM public.expense_claims
  WHERE employee_id IN (SELECT id FROM _rollback_target_employees);

  DELETE FROM public.employee_roles
  WHERE employee_id IN (SELECT id FROM _rollback_target_employees);

  -- Remove seeded employees.
  DELETE FROM public.employees
  WHERE id IN (SELECT id FROM _rollback_target_employees);

  -- Remove auth identities/users for the seeded emails.
  DELETE FROM auth.identities
  WHERE lower(provider) = 'email'
    AND lower(provider_id) = ANY(v_target_emails);

  DELETE FROM auth.users
  WHERE lower(email) = ANY(v_target_emails);
END;
$$;

COMMIT;