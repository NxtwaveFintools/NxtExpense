-- Fix: get_finance_history_metrics always ran finance_filtered_claim_ids() even when
-- no filters were active, causing its allow_resubmit exclusion to apply on the default
-- page. Result: summary cards showed 2,677 while the list (get_finance_history_count /
-- get_finance_history_page) showed 2,694 — a 17-record gap caused by the 17 finance
-- action rows on allow_resubmit=true claims.
--
-- Root cause: unlike get_finance_history_page and get_finance_history_count (which both
-- gate the resolver join on p_has_filters), the metrics RPC had no such gate and joined
-- finance_filtered_claim_ids() unconditionally. The resolver's else branch always fired:
--   "else c.allow_resubmit is not true"
-- excluding allow_resubmit=true claims even when the caller sent zero filter params.
--
-- Fix: add p_has_filters boolean (default false) matching the other two RPCs.  When
-- false the `filtered` CTE is filled with every distinct claim that has a finance
-- action (no resolver, no allow_resubmit gate) — identical to the no-filter path in
-- get_finance_history_count.  When true the resolver runs as before.
--
-- The old function (different signature) must be dropped first; CREATE OR REPLACE only
-- replaces exact-signature matches.

drop function if exists public.get_finance_history_metrics(
  text, text, text, uuid, uuid, text, uuid, text, text, timestamptz, timestamptz
);

create or replace function public.get_finance_history_metrics(
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
returns table(
  total_count integer, total_amount numeric,
  approved_count integer, approved_amount numeric,
  rejected_count integer, rejected_amount numeric,
  rejected_without_reclaim_count integer, rejected_without_reclaim_amount numeric,
  rejected_allow_reclaim_count integer, rejected_allow_reclaim_amount numeric,
  other_count integer, other_amount numeric
)
language sql stable security invoker set search_path = public
as $$
  with
  -- action classification (single source of truth)
  b as (select * from public.finance_action_buckets()),
  -- claim scope: resolver when filters active, all finance-action claims otherwise.
  -- Mirrors the p_has_filters gate in get_finance_history_page and get_finance_history_count.
  filtered as (
    select id from public.finance_filtered_claim_ids(
      null, p_employee_id, p_employee_name, p_claim_number, p_owner_designation,
      p_hod_approver_emp, p_claim_status, p_work_location, p_action_filter,
      p_date_field, p_date_from, p_date_to
    )
    where p_has_filters
    union all
    select distinct fa.claim_id as id
    from public.finance_actions fa
    where not p_has_filters
  ),
  -- Action-date scoping (payment_released_date / finance_approved_date). Mirrors the
  -- TS `filterByFinanceActionDate`: applies ONLY when the date field is an action-date
  -- field AND a bound is present. Without the bound gate, a bare action-date field
  -- (no range) would wrongly restrict the action set.
  date_scoped as (
    select action from b
    where (p_date_from is not null or p_date_to is not null)
      and (
        (p_date_field = 'payment_released_date' and is_payment_released)
        or (p_date_field = 'finance_approved_date' and is_finance_approved)
      )
  ),
  -- Action-filter scoping (used only when not action-date scoped). Mirrors
  -- getFinanceActionCodesForFilter(): 'rejected_allow_reclaim' expands to the rejected
  -- bucket (the resolver already narrows the claims to allow_resubmit = true); any
  -- other value is a literal action code.
  action_scope as (
    select action from b
    where p_action_filter = 'rejected_allow_reclaim' and is_rejected
    union
    select p_action_filter
    where p_action_filter is not null and p_action_filter <> 'rejected_allow_reclaim'
  ),
  approved as (select action from b where is_approved),
  rejected as (select action from b where is_rejected),
  scoped_actions as (
    select fa.action,
           c.total_amount,
           coalesce(c.allow_resubmit, false) as allow_resubmit
    from public.finance_actions fa
    join filtered f on f.id = fa.claim_id
    join public.expense_claims c on c.id = fa.claim_id
    where
      -- acted_at bounds apply only for action-date fields. claim_date / submitted_at /
      -- hod_approved_date are date-filtered inside the resolver, never on acted_at.
      (
        p_date_field not in ('payment_released_date', 'finance_approved_date')
        or (
          (p_date_from is null or fa.acted_at >= p_date_from)
          and (p_date_to is null or fa.acted_at <= p_date_to)
        )
      )
      and (
        (exists (select 1 from date_scoped)
          and fa.action in (select action from date_scoped))
        or (not exists (select 1 from date_scoped)
          and exists (select 1 from action_scope)
          and fa.action in (select action from action_scope))
        or (not exists (select 1 from date_scoped)
          and not exists (select 1 from action_scope))
      )
  )
  select
    count(*)::int,
    coalesce(sum(total_amount), 0)::numeric,
    count(*) filter (where action in (select action from approved))::int,
    coalesce(sum(total_amount) filter (where action in (select action from approved)), 0)::numeric,
    count(*) filter (where action in (select action from rejected))::int,
    coalesce(sum(total_amount) filter (where action in (select action from rejected)), 0)::numeric,
    count(*) filter (where action in (select action from rejected) and allow_resubmit = false)::int,
    coalesce(sum(total_amount) filter (where action in (select action from rejected) and allow_resubmit = false), 0)::numeric,
    count(*) filter (where action in (select action from rejected) and allow_resubmit = true)::int,
    coalesce(sum(total_amount) filter (where action in (select action from rejected) and allow_resubmit = true), 0)::numeric,
    count(*) filter (where action not in (select action from approved)
                       and action not in (select action from rejected))::int,
    coalesce(sum(total_amount) filter (where action not in (select action from approved)
                                         and action not in (select action from rejected)), 0)::numeric
  from scoped_actions;
$$;

grant execute on function public.get_finance_history_metrics(
  boolean, text, text, text, uuid, uuid, text, uuid, text, text, timestamptz, timestamptz
) to authenticated, service_role;
