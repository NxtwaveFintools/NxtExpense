BEGIN;

-- Centralize finance-visible statuses using semantic status flags instead of
-- hardcoded legacy status-code lists.
CREATE OR REPLACE FUNCTION public.get_finance_visible_status_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT cs.id
  FROM public.claim_statuses cs
  WHERE cs.is_active = true
    AND (
      coalesce(cs.approval_level, 0) = 3
      OR coalesce(cs.is_payment_issued, false) = true
      OR (coalesce(cs.is_approval, false) = true AND cs.approval_level IS NULL)
      OR (coalesce(cs.is_rejection, false) = true AND cs.approval_level IS NULL)
    );
$function$;

REVOKE ALL ON FUNCTION public.get_finance_visible_status_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_finance_visible_status_ids() TO authenticated;

-- Finance users must be able to read claims in all finance-relevant states,
-- including Payment Released records.
DROP POLICY IF EXISTS "finance can read finance claims" ON public.expense_claims;
CREATE POLICY "finance can read finance claims"
ON public.expense_claims
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.employees cur
    JOIN public.employee_roles er
      ON er.employee_id = cur.id
     AND er.is_active = true
    JOIN public.roles r
      ON r.id = er.role_id
    WHERE lower(cur.employee_email) = public.current_user_email()
      AND r.role_code = 'FINANCE_TEAM'
  )
  AND status_id IN (
    SELECT public.get_finance_visible_status_ids()
  )
);

-- Finance claim-history visibility must align with claim visibility.
DROP POLICY IF EXISTS "finance can read claim history" ON public.approval_history;
CREATE POLICY "finance can read claim history"
ON public.approval_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.employees cur
    JOIN public.employee_roles er
      ON er.employee_id = cur.id
     AND er.is_active = true
    JOIN public.roles r
      ON r.id = er.role_id
    WHERE lower(cur.employee_email) = public.current_user_email()
      AND r.role_code = 'FINANCE_TEAM'
  )
  AND EXISTS (
    SELECT 1
    FROM public.expense_claims c
    WHERE c.id = approval_history.claim_id
      AND c.status_id IN (
        SELECT public.get_finance_visible_status_ids()
      )
  )
);

-- Approvers should see full history for claims they acted on,
-- not only rows where they were the direct actor.
DROP POLICY IF EXISTS "approver reads approval history" ON public.approval_history;
CREATE POLICY "approver reads approval history"
ON public.approval_history
FOR SELECT
TO authenticated
USING (
  claim_id IN (
    SELECT public.get_my_approver_acted_claim_ids()
  )
);

COMMIT;