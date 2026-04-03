BEGIN;

-- Deprecated on 2026-04-03.
-- This migration originally inserted directly into auth.users/auth.identities,
-- which caused production auth runtime failures.
--
-- Safe replacement:
-- 1) 20260403121000_rollback_seed_test_flow_auth_accounts.sql
-- 2) 20260403123000_seed_test_flow_employee_records_only.sql
-- 3) scripts/dev/provision-test-flow-auth-users.mjs (Auth Admin API)

COMMIT;