-- Rollback for 20260702100000_finance_history_canonical_filter.sql
-- Restores the exact pre-migration state, verbatim from:
--   get_finance_history_count    <- 20260618092300_get_finance_history_count.sql
--   get_finance_history_metrics  <- 20260630090000_fix_finance_history_metrics_p_has_filters.sql
--   get_finance_history_page     <- 20260701100000_rewrite_get_finance_history_page_hydrated.sql
--
-- Order matters: get_finance_history_count and get_finance_history_metrics
-- are restored to bodies that do NOT reference finance_history_filtered()
-- before finance_history_filtered() itself is dropped at the end, so there is
-- never a moment where a live function references a dropped one.

-- ============================================================================
-- 1. Restore get_finance_history_count
-- ============================================================================

create or replace function public.get_finance_history_count(
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
      from public.finance_actions fa
      join public.finance_filtered_claim_ids(
        null, p_employee_id, p_employee_name, p_claim_number, p_owner_designation,
        p_hod_approver_emp, p_claim_status, p_work_location, p_action_filter,
        p_date_field, p_date_from, p_date_to
      ) f on f.id = fa.claim_id
    )
    else (
      select count(*) from public.finance_actions
    )
  end;
$$;

grant execute on function public.get_finance_history_count(
  boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz
) to authenticated, service_role;

-- ============================================================================
-- 2. Restore get_finance_history_metrics (signature unchanged; body-only revert)
-- ============================================================================

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
  b as (select * from public.finance_action_buckets()),
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
  date_scoped as (
    select action from b
    where (p_date_from is not null or p_date_to is not null)
      and (
        (p_date_field = 'payment_released_date' and is_payment_released)
        or (p_date_field = 'finance_approved_date' and is_finance_approved)
      )
  ),
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

-- ============================================================================
-- 3. Restore get_finance_history_page (18-arg hydrated version)
-- ============================================================================

drop function if exists public.get_finance_history_page(
  boolean, text, text, text, uuid, uuid, text, uuid, text, text,
  timestamptz, timestamptz, timestamptz, uuid, integer
);

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
  p_feed_action_codes  text[]      default null,
  p_feed_from          timestamptz default null,
  p_feed_to            timestamptz default null,
  p_cursor_acted_at    timestamptz default null,
  p_cursor_id          uuid        default null,
  p_limit              integer     default 10
)
returns table(
  id                            uuid,
  claim_id                      uuid,
  acted_at                      timestamptz,
  action_type                   text,
  action_notes                  text,
  actor_employee_email          text,
  actor_employee_name           text,

  claim_number                  text,
  claim_employee_id             uuid,
  claim_date                    date,
  work_location_id              uuid,
  work_location_name            text,
  expense_location_id           uuid,
  expense_location_name         text,
  expense_region_code           text,
  own_vehicle_used              boolean,
  vehicle_type_id               uuid,
  vehicle_type_name             text,
  outstation_state_id           uuid,
  outstation_city_id            uuid,
  from_city_id                  uuid,
  to_city_id                    uuid,
  outstation_state_name_snapshot text,
  outstation_city_name_snapshot text,
  from_city_name_snapshot       text,
  to_city_name_snapshot         text,
  km_travelled                  numeric,
  total_amount                  numeric,
  status_id                     uuid,
  status_code                   text,
  status_name                   text,
  status_display_color          text,
  allow_resubmit_status_name    text,
  allow_resubmit_display_color  text,
  status_is_terminal            boolean,
  status_is_rejection           boolean,
  allow_resubmit                boolean,
  is_superseded                  boolean,
  current_approval_level        integer,
  submitted_at                  timestamptz,
  claim_created_at              timestamptz,
  claim_updated_at              timestamptz,
  resubmission_count            integer,
  last_rejection_notes          text,
  last_rejected_at              timestamptz,
  accommodation_nights          integer,
  food_with_principals_amount   numeric,
  has_intercity_travel          boolean,
  has_intracity_travel          boolean,
  intercity_own_vehicle_used    boolean,
  intracity_own_vehicle_used    boolean,
  intracity_vehicle_mode        text,
  base_location_day_type_code   text,

  owner_uuid                    uuid,
  owner_employee_code           text,
  owner_employee_name           text,
  owner_employee_email          text,
  owner_designation_id          uuid,
  owner_designation_name        text
)
language sql stable security invoker set search_path = public
as $$
  with base as (
    select fa.id, fa.claim_id, fa.acted_at, fa.action, fa.notes, fa.actor_employee_id
    from finance_actions fa
    where (p_feed_action_codes is null or fa.action = any(p_feed_action_codes))
      and (p_feed_from is null or fa.acted_at >= p_feed_from)
      and (p_feed_to   is null or fa.acted_at <= p_feed_to)
      and (
        p_cursor_acted_at is null
        or fa.acted_at < p_cursor_acted_at
        or (fa.acted_at = p_cursor_acted_at and fa.id < p_cursor_id)
      )
  ),
  page as (
    select b.id, b.claim_id, b.acted_at, b.action, b.notes, b.actor_employee_id
    from base b
    join public.finance_filtered_claim_ids(
      null, p_employee_id, p_employee_name, p_claim_number, p_owner_designation,
      p_hod_approver_emp, p_claim_status, p_work_location, p_action_filter,
      p_date_field, p_date_from, p_date_to
    ) f on f.id = b.claim_id
    where p_has_filters
    union all
    select b.id, b.claim_id, b.acted_at, b.action, b.notes, b.actor_employee_id
    from base b
    where not p_has_filters
    order by acted_at desc, id desc
    limit p_limit + 1
  )
  select
    p.id, p.claim_id, p.acted_at,
    p.action as action_type,
    p.notes as action_notes,
    actor.employee_email as actor_employee_email,
    actor.employee_name as actor_employee_name,

    c.claim_number,
    c.employee_id as claim_employee_id,
    c.claim_date,
    c.work_location_id,
    wl.location_name as work_location_name,
    c.expense_location_id,
    el.location_name as expense_location_name,
    el.region_code as expense_region_code,
    c.own_vehicle_used,
    c.vehicle_type_id,
    vt.vehicle_name as vehicle_type_name,
    c.outstation_state_id,
    c.outstation_city_id,
    c.from_city_id,
    c.to_city_id,
    c.outstation_state_name_snapshot,
    c.outstation_city_name_snapshot,
    c.from_city_name_snapshot,
    c.to_city_name_snapshot,
    c.km_travelled,
    c.total_amount,
    c.status_id,
    cs.status_code,
    cs.status_name,
    cs.display_color as status_display_color,
    cs.allow_resubmit_status_name,
    cs.allow_resubmit_display_color,
    cs.is_terminal as status_is_terminal,
    cs.is_rejection as status_is_rejection,
    c.allow_resubmit,
    c.is_superseded,
    c.current_approval_level,
    c.submitted_at,
    c.created_at as claim_created_at,
    c.updated_at as claim_updated_at,
    c.resubmission_count,
    c.last_rejection_notes,
    c.last_rejected_at,
    c.accommodation_nights,
    c.food_with_principals_amount,
    c.has_intercity_travel,
    c.has_intracity_travel,
    c.intercity_own_vehicle_used,
    c.intracity_own_vehicle_used,
    c.intracity_vehicle_mode,
    c.base_location_day_type_code,

    e.id as owner_uuid,
    e.employee_id as owner_employee_code,
    e.employee_name as owner_employee_name,
    e.employee_email as owner_employee_email,
    e.designation_id as owner_designation_id,
    d.designation_name as owner_designation_name
  from page p
  join expense_claims c on c.id = p.claim_id
  join employees e on e.id = c.employee_id
  left join designations d on d.id = e.designation_id
  left join work_locations wl on wl.id = c.work_location_id
  left join expense_locations el on el.id = c.expense_location_id
  left join vehicle_types vt on vt.id = c.vehicle_type_id
  left join claim_statuses cs on cs.id = c.status_id
  left join employees actor on actor.id = p.actor_employee_id
  order by p.acted_at desc, p.id desc;
$$;

grant execute on function public.get_finance_history_page(
  boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz,
  text[],timestamptz,timestamptz,timestamptz,uuid,integer
) to authenticated, service_role;

-- ============================================================================
-- 4. Drop finance_history_filtered() — now unreferenced by the restored
--    get_finance_history_page/get_finance_history_metrics above.
-- ============================================================================

drop function if exists public.finance_history_filtered(
  boolean, text, text, text, uuid, uuid, text, uuid, text, text, timestamptz, timestamptz
);
