-- Phase 3a: bounded total-count RPC for the Finance Queue.
-- Replaces getFinanceQueueTotalCount()'s in-memory `filteredClaimIds.length`.
-- Mirrors today's semantics exactly:
--   filters active  -> count of finance_filtered_claim_ids(required_status, ...)
--   no filters      -> count of finance-review claims (status_id = required_status)
-- Returns a scalar count; no claim-ID array ever materializes in Node.
-- See docs/superpowers/plans/2026-06-18-finance-db-side-filtering-phase3.md
create or replace function public.get_finance_queue_count(
  p_required_status_id uuid,
  p_has_filters        boolean     default false,
  p_employee_id        text        default null,
  p_employee_name      text        default null,
  p_claim_number       text        default null,
  p_owner_designation  uuid        default null,
  p_hod_approver_emp   uuid        default null,
  p_claim_status       text        default null,
  p_work_location      uuid        default null,
  p_action_filter      text        default null,
  p_date_field         text        default 'claim_date',
  p_date_from          timestamptz default null,
  p_date_to            timestamptz default null
)
returns bigint
language sql stable security invoker set search_path = public
as $$
  select case
    when p_has_filters then (
      select count(*)
      from public.finance_filtered_claim_ids(
        p_required_status_id, p_employee_id, p_employee_name, p_claim_number,
        p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
        p_action_filter, p_date_field, p_date_from, p_date_to
      )
    )
    else (
      select count(*)
      from public.expense_claims ec
      where ec.status_id = p_required_status_id
    )
  end;
$$;

grant execute on function public.get_finance_queue_count(
  uuid,boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz
) to authenticated, service_role;
