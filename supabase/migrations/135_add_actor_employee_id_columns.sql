-- Migration 135: Add actor_employee_id to claim_status_audit, last_rejected_by_employee_id to expense_claims
-- Phase 10 prep — provide ID counterparts for all remaining email columns

BEGIN;

-- =============================================================================
-- 1. claim_status_audit: add actor_employee_id
-- =============================================================================
ALTER TABLE public.claim_status_audit
  ADD COLUMN actor_employee_id uuid REFERENCES public.employees(id);

UPDATE public.claim_status_audit a
SET actor_employee_id = e.id
FROM public.employees e
WHERE lower(a.actor_email) = lower(e.employee_email);

-- =============================================================================
-- 2. expense_claims: add last_rejected_by_employee_id
-- =============================================================================
ALTER TABLE public.expense_claims
  ADD COLUMN last_rejected_by_employee_id uuid REFERENCES public.employees(id);

UPDATE public.expense_claims c
SET last_rejected_by_employee_id = e.id
FROM public.employees e
WHERE lower(c.last_rejected_by_email) = lower(e.employee_email);

COMMIT;
