-- Rollback for 20260701110000_get_expense_claim_items_by_claim_ids.sql
drop function if exists public.get_expense_claim_items_by_claim_ids(uuid[], text[]);
