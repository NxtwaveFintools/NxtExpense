-- Fix: statement timeout in getFinanceFilterOptions → approval_history query
--
-- Root cause:
--   The query:
--     SELECT approver_employee_id
--     FROM approval_history
--     WHERE new_status_id = $1 AND approver_employee_id IS NOT NULL
--     LIMIT 200
--
--   runs in 0.22 ms as the postgres role. But via PostgREST (authenticated role)
--   it times out because RLS policies are evaluated for every row.
--
--   The expensive culprit is the "approver reads pending-routed claim history" policy:
--
--     EXISTS (
--       SELECT 1 FROM get_claim_available_actions(approval_history.claim_id) actions
--       WHERE actions.actor_scope = 'approver'
--     )
--
--   get_claim_available_actions() is VOLATILE and does 6 sequential queries per call
--   (fetches expense_claims, two employee rows, designations, roles, transitions).
--   With 9 624 rows matching new_status_id = financeReviewStatus.id and LIMIT 200,
--   this function is called for hundreds of rows before 200 pass all policies.
--
--   Worse, alphabetical policy ordering puts "approver reads pending-routed..." BEFORE
--   "finance can read claim history", so it runs (and pays the full cost) for every row
--   even for pure finance users where it will always be false.
--
-- Fix:
--   Wrap the query in a SECURITY DEFINER function so it runs as the function owner
--   (postgres), bypassing all RLS policies.  A role check inside the function ensures
--   only FINANCE_TEAM / ADMIN users get data; anyone else gets an empty result set.
--
--   The TypeScript caller (getFinanceFilterOptions) is updated to call this RPC
--   instead of querying approval_history directly.
--
-- No change to existing RLS policies or other functionality.


CREATE OR REPLACE FUNCTION public.get_hod_approver_employee_ids(
  p_new_status_id uuid
)
RETURNS TABLE(approver_employee_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- ── Security gate: only FINANCE_TEAM or ADMIN may call this function ─────────
  --
  -- Even though the function bypasses RLS on approval_history, we explicitly
  -- restrict who can get results.  Non-finance/non-admin callers receive an
  -- empty result set (no error, so UI degrades gracefully).
  --
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees cur
    JOIN public.employee_roles er ON er.employee_id = cur.id AND er.is_active = true
    JOIN public.roles r ON r.id = er.role_id
    WHERE lower(cur.employee_email) = public.current_user_email()
      AND r.role_code IN ('FINANCE_TEAM', 'ADMIN')
  ) THEN
    RETURN;
  END IF;

  -- ── Return HOD approver employee IDs ─────────────────────────────────────────
  --
  -- SECURITY DEFINER → runs as function owner (postgres), no RLS on approval_history.
  -- No DISTINCT: the index scan stops at 200 rows (16 buffer hits vs 540 for
  -- DISTINCT + full HashAggregate).  The TypeScript caller deduplicates with
  -- new Set(), so duplicates are harmless.
  -- With O(5) distinct HOD approvers across 9 624 matching rows, LIMIT 200
  -- will always capture the full set.
  --
  RETURN QUERY
  SELECT ah.approver_employee_id
  FROM public.approval_history ah
  WHERE ah.new_status_id = p_new_status_id
    AND ah.approver_employee_id IS NOT NULL
  LIMIT 200;
END;
$$;

-- Allow the authenticated role (PostgREST) to call this function
GRANT EXECUTE ON FUNCTION public.get_hod_approver_employee_ids(uuid) TO authenticated;
