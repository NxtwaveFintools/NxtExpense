-- Rollback for 20260622091000_get_pending_approvals.sql
DROP FUNCTION IF EXISTS public.get_pending_approvals(
  integer, date, uuid, text, uuid, boolean, text, text, numeric, text, date, date
);
