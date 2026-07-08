-- Bulk-by-id RPC for BC Expense export claim-item lookups (Task 5 follow-on to the
-- Approved History single-RPC hydration work — see
-- docs/superpowers/plans/2026-07-01-finance-history-single-rpc-hydration.md).
--
-- WHY: bc-expense-export/route.ts calls getMappedClaimItemsByClaimId, which did
-- `.from('expense_claim_items').select(...).in('claim_id', claimIds)` — a THIRD
-- .in()-based REST call the Option C rewrite didn't originally cover (it only fixed
-- getFinanceHistoryPaginated's two internal calls). This call is fed the same
-- HISTORY_CHUNK_SIZE-sized claim id list, so it was still exposed to the same
-- URL-length ceiling (~350-400 ids / ~15KB) that caused the original bug. Moving the
-- id list into an RPC's POST body (mirroring the existing
-- get_claim_available_actions_bulk pattern) removes that exposure, the same way it
-- did for the two calls already fixed.
--
-- SECURITY INVOKER (deliberate, not an oversight): expense_claim_items has RLS
-- enabled with ZERO policies defined — verified live 2026-07-01 that the
-- `authenticated` role sees 0 of 59,955 rows. This is a PRE-EXISTING, SEPARATE bug
-- (tracked independently — see the RLS-gap doc referenced in the Phase-6 plan) that
-- predates this migration and is NOT this migration's job to fix. SECURITY INVOKER
-- preserves EXACT current behavior (returns empty under the same RLS gap the old
-- `.in()` call was already subject to) — this migration's scope is the URL-length
-- exposure only, not the separate RLS gap.
create or replace function public.get_expense_claim_items_by_claim_ids(
  p_claim_ids uuid[],
  p_item_types text[]
)
returns table(claim_id uuid, item_type text, amount numeric)
language sql stable security invoker set search_path = public
as $$
  select eci.claim_id, eci.item_type, eci.amount
  from expense_claim_items eci
  where eci.claim_id = any(p_claim_ids)
    and eci.item_type = any(p_item_types);
$$;

grant execute on function public.get_expense_claim_items_by_claim_ids(uuid[], text[])
  to authenticated, service_role;
