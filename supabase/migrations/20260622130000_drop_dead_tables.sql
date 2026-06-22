-- Drop six zero-row, zero-dependency tables that exist only as schema noise.
-- Dependency audit (2026-06-22): 0 FK refs in/out, 0 function refs, 0 view refs,
-- 0 triggers, 0 RLS policies, 0 application code references.
-- IF EXISTS makes this idempotent across environments.

-- _backup_* tables: denormalised manual backups created before a past migration,
-- never populated on this database.
DROP TABLE IF EXISTS public._backup_approval_history;
DROP TABLE IF EXISTS public._backup_expense_claim_items;
DROP TABLE IF EXISTS public._backup_expense_claims;
DROP TABLE IF EXISTS public._backup_finance_actions;

-- archive_* tables: legacy design predating expense_claim_items and
-- approval_history; never populated, and have no FK constraints despite
-- carrying claim_id columns.
DROP TABLE IF EXISTS public.archive_claim_expenses;
DROP TABLE IF EXISTS public.archive_claim_status_audit;
