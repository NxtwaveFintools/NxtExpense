BEGIN;

-- Extend approver history visibility so a successor approver can view
-- historical claims previously acted on by the approver they replaced.
--
-- This keeps audit attribution unchanged in approval_history while widening
-- claim-level visibility through the existing helper used by approval-history
-- RPCs and RLS policies.
CREATE OR REPLACE FUNCTION public.get_my_approver_acted_claim_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH RECURSIVE me AS (
    SELECT
      e.id AS employee_id,
      d.designation_code
    FROM public.employees e
    LEFT JOIN public.designations d
      ON d.id = e.designation_id
    WHERE lower(e.employee_email) = current_user_email()
    LIMIT 1
  ),
  inherited_approver_scope AS (
    SELECT me.employee_id AS approver_employee_id
    FROM me
    WHERE me.employee_id IS NOT NULL

    UNION

    SELECT er.old_employee_id AS approver_employee_id
    FROM public.employee_replacements er
    JOIN inherited_approver_scope scope
      ON er.new_employee_id = scope.approver_employee_id
    WHERE er.completed_at IS NOT NULL
  ),
  acted_claim_ids AS (
    SELECT DISTINCT ah.claim_id
    FROM public.approval_history ah
    JOIN inherited_approver_scope scope
      ON scope.approver_employee_id = ah.approver_employee_id
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