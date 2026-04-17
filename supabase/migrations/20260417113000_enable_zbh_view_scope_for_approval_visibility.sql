BEGIN;

-- Extend approver visibility helper so ZBH users can view (read-only)
-- all claims of employees mapped under their L2 assignment scope.
--
-- This helper is reused by:
-- - approval history RLS policies
-- - expense_claims / expense_claim_items historical-read policies
-- - approvals history/count/name-suggestion RPC visibility filters
CREATE OR REPLACE FUNCTION public.get_my_approver_acted_claim_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT
      e.id AS employee_id,
      d.designation_code
    FROM public.employees e
    LEFT JOIN public.designations d
      ON d.id = e.designation_id
    WHERE lower(e.employee_email) = current_user_email()
    LIMIT 1
  ),
  acted_claim_ids AS (
    SELECT DISTINCT ah.claim_id
    FROM public.approval_history ah
    JOIN me
      ON me.employee_id = ah.approver_employee_id
  ),
  zbh_scoped_claim_ids AS (
    SELECT c.id AS claim_id
    FROM public.expense_claims c
    JOIN public.employees owner
      ON owner.id = c.employee_id
    JOIN me
      ON true
    WHERE me.designation_code = 'ZBH'
      AND owner.approval_employee_id_level_2 = me.employee_id
  )
  SELECT claim_id
  FROM acted_claim_ids

  UNION

  SELECT claim_id
  FROM zbh_scoped_claim_ids;
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_approver_acted_claim_ids() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
