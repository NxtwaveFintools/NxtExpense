-- Migration 152: Add role type boolean flags
-- Purpose: Replace hardcoded role_code string comparisons in TypeScript with
--          DB-sourced boolean flags. Code uses r.is_finance_role / r.is_admin_role
--          instead of comparing against magic strings like 'FINANCE_TEAM' / 'ADMIN'.

BEGIN;

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS is_finance_role BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_admin_role   BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.roles.is_finance_role IS
  'True for roles that grant access to the finance processing queue.';
COMMENT ON COLUMN public.roles.is_admin_role IS
  'True for roles that grant full administrative access.';

-- Seed flags based on existing role_code values
UPDATE public.roles SET is_finance_role = true WHERE role_code = 'FINANCE_TEAM';
UPDATE public.roles SET is_admin_role   = true WHERE role_code = 'ADMIN';

-- Index for fast flag-based lookups
CREATE INDEX IF NOT EXISTS idx_roles_finance ON public.roles (is_finance_role) WHERE is_finance_role = true;
CREATE INDEX IF NOT EXISTS idx_roles_admin   ON public.roles (is_admin_role)   WHERE is_admin_role   = true;

COMMIT;
