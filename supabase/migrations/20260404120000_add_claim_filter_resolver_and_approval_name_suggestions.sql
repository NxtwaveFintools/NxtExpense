BEGIN;

-- Ensure reclaim-aware filtering has a stable claim-level flag in every environment.
ALTER TABLE public.expense_claims
ADD COLUMN IF NOT EXISTS allow_resubmit boolean NOT NULL DEFAULT false;

-- Backfill allow_resubmit from the latest workflow action that explicitly set it.
WITH latest_history AS (
  SELECT DISTINCT ON (ah.claim_id)
    ah.claim_id,
    COALESCE(ah.allow_resubmit, false) AS allow_resubmit
  FROM public.approval_history ah
  WHERE ah.allow_resubmit IS NOT NULL
  ORDER BY ah.claim_id, ah.acted_at DESC, ah.id DESC
)
UPDATE public.expense_claims ec
SET allow_resubmit = latest_history.allow_resubmit
FROM latest_history
WHERE ec.id = latest_history.claim_id
  AND ec.allow_resubmit IS DISTINCT FROM latest_history.allow_resubmit;

-- Non-rejection statuses must never remain reclaimable.
UPDATE public.expense_claims ec
SET allow_resubmit = false
FROM public.claim_statuses cs
WHERE ec.status_id = cs.id
  AND COALESCE(cs.is_rejection, false) = false
  AND ec.allow_resubmit IS DISTINCT FROM false;

CREATE INDEX IF NOT EXISTS idx_expense_claims_status_allow_resubmit
ON public.expense_claims(status_id, allow_resubmit);

-- DB-level resolver for status-filter tokens:
-- 1) explicit allow_resubmit value wins
-- 2) if status has a reclaim-specific display label, default filter means allow_resubmit = false
-- 3) otherwise allow_resubmit filter is not applied
CREATE OR REPLACE FUNCTION public.resolve_claim_allow_resubmit_filter(
  p_claim_status_id uuid,
  p_claim_allow_resubmit boolean DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_claim_allow_resubmit IS NOT NULL THEN p_claim_allow_resubmit
    WHEN p_claim_status_id IS NULL THEN NULL
    WHEN EXISTS (
      SELECT 1
      FROM public.claim_statuses cs
      WHERE cs.id = p_claim_status_id
        AND NULLIF(BTRIM(COALESCE(cs.allow_resubmit_status_name, '')), '') IS NOT NULL
    ) THEN false
    ELSE NULL
  END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_claim_allow_resubmit_filter(uuid, boolean) TO authenticated;

-- DB-backed employee-name suggestions for /approvals filter UX.
CREATE OR REPLACE FUNCTION public.get_approval_employee_name_suggestions(
  p_name_search text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(employee_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT e.id AS employee_id
    FROM public.employees e
    WHERE lower(e.employee_email) = public.current_user_email()
    LIMIT 1
  ),
  scoped_claims AS (
    SELECT c.id, c.employee_id
    FROM public.expense_claims c
    WHERE
      c.employee_id IN (SELECT employee_id FROM me)
      OR EXISTS (
        SELECT 1
        FROM public.approval_history ah_actor
        WHERE ah_actor.claim_id = c.id
          AND ah_actor.approver_employee_id IN (SELECT employee_id FROM me)
      )
      OR EXISTS (
        SELECT 1
        FROM public.employees adm
        JOIN public.employee_roles er
          ON er.employee_id = adm.id
         AND er.is_active = true
        JOIN public.roles r
          ON r.id = er.role_id
        WHERE lower(adm.employee_email) = public.current_user_email()
          AND r.is_admin_role = true
      )
  )
  SELECT DISTINCT owner.employee_name
  FROM scoped_claims sc
  JOIN public.employees owner ON owner.id = sc.employee_id
  WHERE
    owner.employee_name IS NOT NULL
    AND (
      p_name_search IS NULL
      OR BTRIM(p_name_search) = ''
      OR owner.employee_name ILIKE ('%' || BTRIM(p_name_search) || '%')
    )
  ORDER BY owner.employee_name
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$function$;

GRANT EXECUTE ON FUNCTION public.get_approval_employee_name_suggestions(text, integer) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
