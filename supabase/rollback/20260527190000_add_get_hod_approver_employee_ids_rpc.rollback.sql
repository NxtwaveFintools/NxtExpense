-- Rollback for: 20260527190000_add_get_hod_approver_employee_ids_rpc.sql
--
-- Drops the SECURITY DEFINER RPC.  After rollback, getFinanceFilterOptions must
-- be reverted to query approval_history directly (and will hit the RLS timeout again).

REVOKE EXECUTE ON FUNCTION public.get_hod_approver_employee_ids(uuid) FROM authenticated;
DROP FUNCTION IF EXISTS public.get_hod_approver_employee_ids(uuid);
