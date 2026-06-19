-- Phase 3a: keyset ID-page RPC for the Approved History feed.
-- Returns the keyset-ordered page of finance_actions ids (<= limit + 1) scoped to
-- matching claims, filtered by feed action codes + action-date window. Filtering +
-- pagination happen in Postgres; the app enriches only this bounded page.
-- See docs/superpowers/plans/2026-06-18-finance-db-side-filtering-phase3.md
create or replace function public.get_finance_history_page(
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
  p_feed_to            timestamptz default null,
  p_cursor_acted_at    timestamptz default null,
  p_cursor_id          uuid        default null,
  p_limit              integer     default 10
)
returns table(id uuid, claim_id uuid, acted_at timestamptz)
language sql stable security invoker set search_path = public
as $$
  -- `base` = feed-action/date/cursor-bounded finance_actions rows. Resolver applied
  -- as a JOIN (clearer plans than IN (SELECT ...)), guarded by p_has_filters.
  with base as (
    select fa.id, fa.claim_id, fa.acted_at
    from finance_actions fa
    where (p_feed_action_codes is null or fa.action = any(p_feed_action_codes))
      and (p_feed_from is null or fa.acted_at >= p_feed_from)
      and (p_feed_to   is null or fa.acted_at <= p_feed_to)
      and (
        p_cursor_acted_at is null
        or fa.acted_at < p_cursor_acted_at
        or (fa.acted_at = p_cursor_acted_at and fa.id < p_cursor_id)
      )
  )
  select b.id, b.claim_id, b.acted_at
  from base b
  join public.finance_filtered_claim_ids(
    null, p_employee_id, p_employee_name, p_claim_number, p_owner_designation,
    p_hod_approver_emp, p_claim_status, p_work_location, p_action_filter,
    p_date_field, p_date_from, p_date_to
  ) f on f.id = b.claim_id
  where p_has_filters
  union all
  select b.id, b.claim_id, b.acted_at
  from base b
  where not p_has_filters
  -- DETERMINISTIC keyset order: id is the REQUIRED secondary sort key — never remove it.
  order by acted_at desc, id desc
  limit p_limit + 1;
$$;

grant execute on function public.get_finance_history_page(
  boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz,
  text[],timestamptz,timestamptz,timestamptz,uuid,integer
) to authenticated, service_role;
