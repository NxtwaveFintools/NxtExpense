BEGIN;

-- Reconcile schema drift so test follows prod's core public contract.
-- Safe to run multiple times.

-- Ensure prod-required tenancy column exists.
ALTER TABLE public.expense_claims
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'default';

-- Remove columns that exist only in test and are not part of prod contract.
ALTER TABLE public.employees
  DROP COLUMN IF EXISTS designation_code;

ALTER TABLE public.work_locations
  DROP COLUMN IF EXISTS allows_expenses;

-- Remove test-only trigger/function artifacts.
DROP TRIGGER IF EXISTS trg_expense_claims_initial_routing
  ON public.expense_claims;

-- Drop dependent event trigger before removing helper function.
DROP EVENT TRIGGER IF EXISTS ensure_rls;

DROP FUNCTION IF EXISTS public.normalize_initial_claim_routing_on_insert();
DROP FUNCTION IF EXISTS public.get_active_approver_with_delegation(uuid, integer, uuid, date);
DROP FUNCTION IF EXISTS public.get_expense_rate_for_date(uuid, character varying, uuid, date);
DROP FUNCTION IF EXISTS public.rls_auto_enable();

-- Remove legacy overload that does not exist in prod.
DROP FUNCTION IF EXISTS public.get_finance_pending_dashboard_analytics(
  date,
  date,
  uuid,
  uuid,
  uuid,
  text,
  text
);

COMMIT;
