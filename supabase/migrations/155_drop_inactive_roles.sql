-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 155: Remove inactive legacy roles
--
-- FINANCE_PROCESSOR, FINANCE_REVIEWER, and HR_MANAGER were superseded by
-- FINANCE_TEAM. They have no active employee_roles assignments and are no
-- longer referenced in any RPC or policy logic. All approval_routing rows
-- referencing these roles are also inactive and are removed first.
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove inactive approval_routing rows that reference the legacy roles
DELETE FROM public.approval_routing
WHERE approver_role_id IN (
  SELECT id FROM public.roles
  WHERE role_code IN ('FINANCE_PROCESSOR', 'FINANCE_REVIEWER', 'HR_MANAGER')
);

-- Remove inactive claim_status_transitions that reference the legacy roles
DELETE FROM public.claim_status_transitions
WHERE requires_role_id IN (
  SELECT id FROM public.roles
  WHERE role_code IN ('FINANCE_PROCESSOR', 'FINANCE_REVIEWER', 'HR_MANAGER')
);

DELETE FROM public.roles
WHERE role_code IN ('FINANCE_PROCESSOR', 'FINANCE_REVIEWER', 'HR_MANAGER');
