-- Phase 3a: keyset ID-page RPC for the Finance Queue list.
-- Returns the keyset-ordered page of expense_claims ids (<= limit + 1) for the
-- finance-review queue. Filtering + pagination happen in Postgres; the app
-- enriches only this bounded page of ids via the existing PostgREST projection.
-- See docs/superpowers/plans/2026-06-18-finance-db-side-filtering-phase3.md
create or replace function public.get_finance_queue_page(
  p_required_status_id uuid,                        -- finance-review status (required scope)
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
  p_cursor_created_at  timestamptz default null,
  p_cursor_id          uuid        default null,
  p_limit              integer     default 10
)
returns table(id uuid, created_at timestamptz)
language sql stable security invoker set search_path = public
as $$
  -- `base` is the status-scoped, cursor-bounded candidate set. The resolver is
  -- applied as a JOIN (clearer plans / easier to EXPLAIN than IN (SELECT ...)),
  -- guarded by p_has_filters so the no-filter fast path skips the resolver entirely.
  with base as (
    select ec.id, ec.created_at
    from expense_claims ec
    where ec.status_id = p_required_status_id
      and (
        p_cursor_created_at is null
        or ec.created_at < p_cursor_created_at
        or (ec.created_at = p_cursor_created_at and ec.id < p_cursor_id)
      )
  )
  select b.id, b.created_at
  from base b
  join public.finance_filtered_claim_ids(
    p_required_status_id, p_employee_id, p_employee_name, p_claim_number,
    p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
    p_action_filter, p_date_field, p_date_from, p_date_to
  ) f on f.id = b.id
  where p_has_filters
  union all
  select b.id, b.created_at
  from base b
  where not p_has_filters
  -- DETERMINISTIC keyset order: id is the REQUIRED secondary sort key — never remove it.
  order by created_at desc, id desc
  limit p_limit + 1;
$$;

grant execute on function public.get_finance_queue_page(
  uuid,boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz,
  timestamptz,uuid,integer
) to authenticated, service_role;
