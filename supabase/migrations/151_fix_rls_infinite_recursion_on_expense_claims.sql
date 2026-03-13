BEGIN;

-- =============================================================================
-- Migration 151: Fix infinite RLS recursion introduced by migration 150
--
-- Root cause:
--   Migration 150 Part B added a SELECT policy on expense_claims that queries
--   approval_history. But approval_history already had two policies that query
--   back expense_claims ("employee reads own claim history" and "finance can
--   read claim history"). This creates a cycle:
--     expense_claims policy → approval_history → expense_claims → ...
--
-- Fix:
--   Replace the two direct-subquery policies from migration 150 (Parts B & C)
--   with a single SECURITY DEFINER helper function that reads approval_history
--   without triggering its own RLS. The expense_claims / expense_claim_items
--   policies then call this function, breaking the cycle entirely.
-- =============================================================================

-- ── Helper: returns claim IDs the current user has acted on as an approver ──
-- SECURITY DEFINER means it runs as the function owner (bypasses RLS on
-- approval_history) so no cycle is possible.
CREATE OR REPLACE FUNCTION public.get_my_approver_acted_claim_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT ah.claim_id
  FROM   public.approval_history ah
  JOIN   public.employees         e  ON e.id = ah.approver_employee_id
  WHERE  lower(e.employee_email) = current_user_email();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_approver_acted_claim_ids() TO authenticated;

-- ── Drop and re-create Part B policy (expense_claims) ───────────────────────
DROP POLICY IF EXISTS "approver reads historically actioned claims" ON expense_claims;

CREATE POLICY "approver reads historically actioned claims"
  ON expense_claims
  FOR SELECT
  USING (id IN (SELECT public.get_my_approver_acted_claim_ids()));

-- ── Drop and re-create Part C policy (expense_claim_items) ──────────────────
DROP POLICY IF EXISTS "approver reads claim items for historically actioned claims" ON expense_claim_items;

CREATE POLICY "approver reads claim items for historically actioned claims"
  ON expense_claim_items
  FOR SELECT
  USING (claim_id IN (SELECT public.get_my_approver_acted_claim_ids()));

COMMIT;
