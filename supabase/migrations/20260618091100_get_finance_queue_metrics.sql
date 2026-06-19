-- Phase 2a — Finance Queue analytics RPC.
-- Ports getFinanceQueueAnalytics() so NO claim-ID array is built in Node. Mirrors
-- get_claim_bucket_metrics:
--   Path A (no active filters) reuses the maintained expense_claims_status_summary
--           (~10-20 rows, 1 buffer page) — unchanged fast path.
--   Path B (filters active) scopes via the Phase 1 resolver finance_filtered_claim_ids().
-- The TS action-filter intersection (getActionFilteredClaimIds) becomes an EXISTS on
-- finance_actions. p_action_intersect is supplied only for single-action filters that
-- go through that path today; 'rejected_allow_reclaim' is handled entirely by the
-- resolver (allow_resubmit = true), so it has no p_action_intersect.
create or replace function public.get_finance_queue_metrics(
  p_pending_status_ids  uuid[]      default null,
  p_approved_status_ids uuid[]      default null,
  p_rejected_status_ids uuid[]      default null,
  p_has_filters         boolean     default false,
  p_employee_id         text        default null,
  p_employee_name       text        default null,
  p_claim_number        text        default null,
  p_owner_designation   uuid        default null,
  p_hod_approver_emp    uuid        default null,
  p_claim_status        text        default null,
  p_work_location       uuid        default null,
  p_action_filter       text        default null,
  p_date_field          text        default 'claim_date',
  p_date_from           timestamptz default null,
  p_date_to             timestamptz default null,
  -- action-filter intersection window (IST), only when action filter active & not an action-date field
  p_action_intersect    text        default null,
  p_action_from         timestamptz default null,
  p_action_to           timestamptz default null
)
returns table(
  total_count integer, total_amount numeric,
  pending_count integer, pending_amount numeric,
  approved_count integer, approved_amount numeric,
  rejected_count integer, rejected_amount numeric
)
language plpgsql stable security invoker set search_path = public
as $$
declare
  v_has_pending  boolean := coalesce(array_length(p_pending_status_ids, 1), 0) > 0;
  v_has_approved boolean := coalesce(array_length(p_approved_status_ids, 1), 0) > 0;
  v_has_rejected boolean := coalesce(array_length(p_rejected_status_ids, 1), 0) > 0;
begin
  if not p_has_filters then
    -- Path A: fast summary table (unchanged from get_claim_bucket_metrics Path A)
    select
      coalesce(sum(s.claim_count), 0)::int,
      coalesce(sum(s.total_amount), 0)::numeric,
      coalesce(sum(s.claim_count)  filter (where v_has_pending  and s.status_id = any(p_pending_status_ids)), 0)::int,
      coalesce(sum(s.total_amount) filter (where v_has_pending  and s.status_id = any(p_pending_status_ids)), 0)::numeric,
      coalesce(sum(s.claim_count)  filter (where v_has_approved and s.status_id = any(p_approved_status_ids)), 0)::int,
      coalesce(sum(s.total_amount) filter (where v_has_approved and s.status_id = any(p_approved_status_ids)), 0)::numeric,
      coalesce(sum(s.claim_count)  filter (where v_has_rejected and s.status_id = any(p_rejected_status_ids)), 0)::int,
      coalesce(sum(s.total_amount) filter (where v_has_rejected and s.status_id = any(p_rejected_status_ids)), 0)::numeric
    into total_count, total_amount, pending_count, pending_amount,
         approved_count, approved_amount, rejected_count, rejected_amount
    from public.expense_claims_status_summary s;
  else
    -- Path B: resolver scope + optional action-filter intersection
    select
      count(*)::int,
      coalesce(sum(ec.total_amount), 0)::numeric,
      count(*) filter (where v_has_pending  and ec.status_id = any(p_pending_status_ids))::int,
      coalesce(sum(ec.total_amount) filter (where v_has_pending  and ec.status_id = any(p_pending_status_ids)), 0)::numeric,
      count(*) filter (where v_has_approved and ec.status_id = any(p_approved_status_ids))::int,
      coalesce(sum(ec.total_amount) filter (where v_has_approved and ec.status_id = any(p_approved_status_ids)), 0)::numeric,
      count(*) filter (where v_has_rejected and ec.status_id = any(p_rejected_status_ids))::int,
      coalesce(sum(ec.total_amount) filter (where v_has_rejected and ec.status_id = any(p_rejected_status_ids)), 0)::numeric
    into total_count, total_amount, pending_count, pending_amount,
         approved_count, approved_amount, rejected_count, rejected_amount
    from public.expense_claims ec
    join public.finance_filtered_claim_ids(
      null, p_employee_id, p_employee_name, p_claim_number, p_owner_designation,
      p_hod_approver_emp, p_claim_status, p_work_location, p_action_filter,
      p_date_field, p_date_from, p_date_to
    ) f on f.id = ec.id
    where (
      p_action_intersect is null
      or exists (
        select 1 from public.finance_actions fa
        where fa.claim_id = ec.id
          and fa.action = p_action_intersect
          and (p_action_from is null or fa.acted_at >= p_action_from)
          and (p_action_to   is null or fa.acted_at <= p_action_to)
      )
    );
  end if;

  total_count    := coalesce(total_count, 0);    total_amount    := coalesce(total_amount, 0);
  pending_count  := coalesce(pending_count, 0);  pending_amount  := coalesce(pending_amount, 0);
  approved_count := coalesce(approved_count, 0); approved_amount := coalesce(approved_amount, 0);
  rejected_count := coalesce(rejected_count, 0); rejected_amount := coalesce(rejected_amount, 0);
  return next;
end;
$$;

grant execute on function public.get_finance_queue_metrics(
  uuid[], uuid[], uuid[], boolean, text, text, text, uuid, uuid, text, uuid, text, text,
  timestamptz, timestamptz, text, timestamptz, timestamptz
) to authenticated, service_role;
