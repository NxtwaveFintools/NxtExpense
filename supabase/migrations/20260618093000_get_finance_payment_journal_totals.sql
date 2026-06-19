-- Phase 4: per-employee payment-journal totals as a single streamed GROUP BY.
-- Replaces the export's "page the whole history feed + sum in a Map/Set" loop with one
-- DB-side aggregate. Result is bounded by employee count, not claim count.
--
-- Semantics reproduced from accumulatePaymentJournalsEmployeeTotals (the legacy TS):
--   * Feed scope = the SAME claims the Approved History feed shows for these filters:
--     finance_actions bounded by p_feed_action_codes + the action-date window, with the
--     Phase-1 resolver applied as a JOIN guarded by p_has_filters (mirrors
--     get_finance_history_page exactly so the export matches the on-screen feed).
--   * Dedup = one contribution per DISTINCT claim (legacy seenClaimIds Set), regardless
--     of how many finance_actions rows that claim has. -> select distinct claim_id.
--   * Amount = expense_claims.total_amount, summed once per distinct claim.
--   * Key = employees.employee_id (the business code shown as "Account No." in the CSV),
--     NOT expense_claims.employee_id (the uuid FK). -> join employees, return text.
-- See docs/superpowers/plans/2026-06-18-finance-db-side-filtering-phase4.md
create or replace function public.get_finance_payment_journal_totals(
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
  p_date_to            timestamptz default null,
  p_feed_action_codes  text[]      default null,   -- bounded feed-row action filter
  p_feed_from          timestamptz default null,   -- action-date feed window (IST)
  p_feed_to            timestamptz default null
)
returns table(employee_id text, total_amount numeric)
language sql stable security invoker set search_path = public
as $$
  -- `base` = feed-action/date-bounded finance_actions rows (same predicate as the
  -- history page RPC, minus the keyset cursor since exports read the whole scope).
  with base as (
    select fa.claim_id
    from finance_actions fa
    where (p_feed_action_codes is null or fa.action = any(p_feed_action_codes))
      and (p_feed_from is null or fa.acted_at >= p_feed_from)
      and (p_feed_to   is null or fa.acted_at <= p_feed_to)
  ),
  -- Distinct claims in the feed (matches the legacy seenClaimIds dedup). Resolver join
  -- is guarded by p_has_filters via union all, exactly like get_finance_history_page:
  -- no-filter exports bypass the resolver (and its allow_resubmit exclusion).
  feed_claims as (
    select distinct b.claim_id
    from base b
    join public.finance_filtered_claim_ids(
      null, p_employee_id, p_employee_name, p_claim_number, p_owner_designation,
      p_hod_approver_emp, p_claim_status, p_work_location, p_action_filter,
      p_date_field, p_date_from, p_date_to
    ) f on f.id = b.claim_id
    where p_has_filters
    union all
    select distinct b.claim_id
    from base b
    where not p_has_filters
  )
  select e.employee_id, coalesce(sum(c.total_amount), 0)::numeric
  from feed_claims fc
  join expense_claims c on c.id = fc.claim_id
  join employees e on e.id = c.employee_id
  group by e.employee_id;
$$;

grant execute on function public.get_finance_payment_journal_totals(
  boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz,
  text[],timestamptz,timestamptz
) to authenticated, service_role;
