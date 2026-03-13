-- Migration 134: Drop old custom enum type definitions
-- Phase 9c — final cleanup: convert backup columns to text, then drop all 9 enums
--
-- Enum types dropped: claim_status, designation_type, work_location_type,
--   vehicle_type, approval_action_type, finance_action_type,
--   claim_actor_scope, claim_next_level_mode, expense_item_type

BEGIN;

-- =============================================================================
-- Step 1: Convert backup table columns from enum to text
-- =============================================================================
ALTER TABLE public._backup_approval_history ALTER COLUMN action TYPE text;
ALTER TABLE public._backup_expense_claim_items ALTER COLUMN item_type TYPE text;
ALTER TABLE public._backup_expense_claims ALTER COLUMN status TYPE text;
ALTER TABLE public._backup_expense_claims ALTER COLUMN vehicle_type TYPE text;
ALTER TABLE public._backup_expense_claims ALTER COLUMN work_location TYPE text;
ALTER TABLE public._backup_finance_actions ALTER COLUMN action TYPE text;

-- =============================================================================
-- Step 2: Drop all 9 custom enum types
-- =============================================================================
DROP TYPE IF EXISTS public.claim_status;
DROP TYPE IF EXISTS public.designation_type;
DROP TYPE IF EXISTS public.work_location_type;
DROP TYPE IF EXISTS public.vehicle_type;
DROP TYPE IF EXISTS public.approval_action_type;
DROP TYPE IF EXISTS public.finance_action_type;
DROP TYPE IF EXISTS public.claim_actor_scope;
DROP TYPE IF EXISTS public.claim_next_level_mode;
DROP TYPE IF EXISTS public.expense_item_type;

COMMIT;
