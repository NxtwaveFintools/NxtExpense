-- Rollback for 20260703140000_canonical_filter_early_stop_pagination.sql
-- Restores the exact pre-migration bodies (verbatim from
-- 20260702100000_finance_history_canonical_filter.sql,
-- 20260702110000_pending_approvals_canonical_filter.sql,
-- 20260702120000_my_claims_canonical_filter.sql,
-- 20260702130000_finance_queue_canonical_filter.sql).

-- ============================================================================
-- 1. Approved History
-- ============================================================================

drop function if exists public.finance_history_filtered(
  boolean, text, text, text, uuid, uuid, text, uuid, text, text, timestamptz, timestamptz,
  timestamptz, uuid, integer
);

create or replace function public.finance_history_filtered(
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
  id                uuid,
  claim_id          uuid,
  acted_at          timestamptz,
  action            text,
  notes             text,
  actor_employee_id uuid,
  total_amount      numeric,
  allow_resubmit    boolean
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
  )
  select
    fa.id, fa.claim_id, fa.acted_at, fa.action, fa.notes, fa.actor_employee_id,
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
    );
$$;

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
  with page as (
    select id, claim_id, acted_at, action, notes, actor_employee_id
    from public.finance_history_filtered(
      p_has_filters, p_employee_id, p_employee_name, p_claim_number,
      p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
      p_action_filter, p_date_field, p_date_from, p_date_to
    )
    where
      p_cursor_acted_at is null
      or acted_at < p_cursor_acted_at
      or (acted_at = p_cursor_acted_at and id < p_cursor_id)
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
  timestamptz,uuid,integer
) to authenticated, service_role;

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
  scoped_actions as (
    select action, total_amount, allow_resubmit
    from public.finance_history_filtered(
      p_has_filters, p_employee_id, p_employee_name, p_claim_number,
      p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
      p_action_filter, p_date_field, p_date_from, p_date_to
    )
  ),
  approved as (select action from b where is_approved),
  rejected as (select action from b where is_rejected)
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
-- 2. Finance Queue
-- ============================================================================

drop function if exists public.finance_queue_filtered(
  uuid, boolean, text, text, text, uuid, uuid, text, uuid, text, text, timestamptz, timestamptz,
  timestamptz, uuid, integer
);

create or replace function public.finance_queue_filtered(
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
returns table(id uuid, created_at timestamptz)
language sql stable security invoker set search_path = public
as $$
  select ec.id, ec.created_at
  from expense_claims ec
  join public.finance_filtered_claim_ids(
    p_required_status_id, p_employee_id, p_employee_name, p_claim_number,
    p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
    p_action_filter, p_date_field, p_date_from, p_date_to
  ) f on f.id = ec.id
  where p_has_filters
  union all
  select ec.id, ec.created_at
  from expense_claims ec
  where ec.status_id = p_required_status_id and not p_has_filters;
$$;

create or replace function public.get_finance_queue_page(
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
  p_date_to            timestamptz default null,
  p_cursor_created_at  timestamptz default null,
  p_cursor_id          uuid        default null,
  p_limit              integer     default 10
)
returns table(id uuid, created_at timestamptz)
language sql stable security invoker set search_path = public
as $$
  select id, created_at
  from public.finance_queue_filtered(
    p_required_status_id, p_has_filters, p_employee_id, p_employee_name, p_claim_number,
    p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
    p_action_filter, p_date_field, p_date_from, p_date_to
  )
  where p_cursor_created_at is null
    or created_at < p_cursor_created_at
    or (created_at = p_cursor_created_at and id < p_cursor_id)
  order by created_at desc, id desc
  limit p_limit + 1;
$$;

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
  select count(*) from public.finance_queue_filtered(
    p_required_status_id, p_has_filters, p_employee_id, p_employee_name, p_claim_number,
    p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
    p_action_filter, p_date_field, p_date_from, p_date_to
  );
$$;

grant execute on function public.get_finance_queue_page(
  uuid,boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz,
  timestamptz,uuid,integer
) to authenticated, service_role;

grant execute on function public.get_finance_queue_count(
  uuid,boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz
) to authenticated, service_role;

-- ============================================================================
-- 3. My Claims
-- ============================================================================

drop function if exists public.my_claims_filtered(
  uuid, uuid, boolean, uuid, date, date, timestamptz, uuid, integer
);

create or replace function public.my_claims_filtered(
  p_employee_id      uuid,
  p_status_id        uuid    default null,
  p_allow_resubmit   boolean default null,
  p_work_location_id uuid    default null,
  p_claim_date_from  date    default null,
  p_claim_date_to    date    default null
)
returns table(
  id                            uuid,
  claim_number                  text,
  employee_id                   uuid,
  claim_date                    date,
  work_location_id              uuid,
  work_location_name            text,
  expense_location_id           uuid,
  expense_location_name         text,
  expense_region_code           text,
  own_vehicle_used              boolean,
  vehicle_type_id                uuid,
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
  status_is_payment_issued      boolean,
  allow_resubmit                boolean,
  is_superseded                  boolean,
  current_approval_level        integer,
  submitted_at                  timestamptz,
  created_at                    timestamptz,
  updated_at                    timestamptz,
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
  base_location_day_type_code   text
)
language sql stable security invoker set search_path = public
as $$
  select
    c.id, c.claim_number, c.employee_id, c.claim_date,
    c.work_location_id, wl.location_name as work_location_name,
    c.expense_location_id, el.location_name as expense_location_name, el.region_code as expense_region_code,
    c.own_vehicle_used, c.vehicle_type_id, vt.vehicle_name as vehicle_type_name,
    c.outstation_state_id, c.outstation_city_id, c.from_city_id, c.to_city_id,
    c.outstation_state_name_snapshot, c.outstation_city_name_snapshot,
    c.from_city_name_snapshot, c.to_city_name_snapshot,
    c.km_travelled, c.total_amount,
    c.status_id, cs.status_code, cs.status_name, cs.display_color as status_display_color,
    cs.allow_resubmit_status_name, cs.allow_resubmit_display_color,
    cs.is_terminal as status_is_terminal, cs.is_rejection as status_is_rejection,
    cs.is_payment_issued as status_is_payment_issued,
    c.allow_resubmit, c.is_superseded, c.current_approval_level,
    c.submitted_at, c.created_at, c.updated_at, c.resubmission_count,
    c.last_rejection_notes, c.last_rejected_at,
    c.accommodation_nights, c.food_with_principals_amount,
    c.has_intercity_travel, c.has_intracity_travel,
    c.intercity_own_vehicle_used, c.intracity_own_vehicle_used, c.intracity_vehicle_mode,
    c.base_location_day_type_code
  from expense_claims c
  join claim_statuses cs on cs.id = c.status_id
  left join work_locations wl on wl.id = c.work_location_id
  left join expense_locations el on el.id = c.expense_location_id
  left join vehicle_types vt on vt.id = c.vehicle_type_id
  where c.employee_id = p_employee_id
    and (p_status_id is null or c.status_id = p_status_id)
    and (p_allow_resubmit is null or c.allow_resubmit = p_allow_resubmit)
    and (p_work_location_id is null or c.work_location_id = p_work_location_id)
    and (p_claim_date_from is null or c.claim_date >= p_claim_date_from)
    and (p_claim_date_to is null or c.claim_date <= p_claim_date_to);
$$;

create or replace function public.get_my_claims_page(
  p_employee_id      uuid,
  p_status_id        uuid    default null,
  p_allow_resubmit   boolean default null,
  p_work_location_id uuid    default null,
  p_claim_date_from  date    default null,
  p_claim_date_to    date    default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id        uuid    default null,
  p_limit            integer default 10
)
returns table(
  id                            uuid,
  claim_number                  text,
  employee_id                   uuid,
  claim_date                    date,
  work_location_id              uuid,
  work_location_name            text,
  expense_location_id           uuid,
  expense_location_name         text,
  expense_region_code           text,
  own_vehicle_used              boolean,
  vehicle_type_id                uuid,
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
  status_is_payment_issued      boolean,
  allow_resubmit                boolean,
  is_superseded                  boolean,
  current_approval_level        integer,
  submitted_at                  timestamptz,
  created_at                    timestamptz,
  updated_at                    timestamptz,
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
  base_location_day_type_code   text
)
language sql stable security invoker set search_path = public
as $$
  select *
  from public.my_claims_filtered(
    p_employee_id, p_status_id, p_allow_resubmit, p_work_location_id,
    p_claim_date_from, p_claim_date_to
  )
  where p_cursor_created_at is null
    or created_at < p_cursor_created_at
    or (created_at = p_cursor_created_at and id < p_cursor_id)
  order by created_at desc, id desc
  limit greatest(p_limit, 0) + 1;
$$;

grant execute on function public.get_my_claims_page(
  uuid, uuid, boolean, uuid, date, date, timestamptz, uuid, integer
) to authenticated, service_role;

create or replace function public.get_my_claims_metrics(
  p_employee_id      uuid,
  p_status_id        uuid    default null,
  p_allow_resubmit   boolean default null,
  p_work_location_id uuid    default null,
  p_claim_date_from  date    default null,
  p_claim_date_to    date    default null
)
returns table(
  total_count integer, total_amount numeric,
  pending_count integer, pending_amount numeric,
  approved_count integer, approved_amount numeric,
  rejected_count integer, rejected_amount numeric,
  rejected_allow_reclaim_count integer, rejected_allow_reclaim_amount numeric
)
language sql stable security invoker set search_path = public
as $$
  with scoped as (
    select total_amount, allow_resubmit, status_is_rejection, status_is_payment_issued
    from public.my_claims_filtered(
      p_employee_id, p_status_id, p_allow_resubmit, p_work_location_id,
      p_claim_date_from, p_claim_date_to
    )
  )
  select
    count(*)::int,
    coalesce(sum(total_amount), 0)::numeric,
    count(*) filter (where not coalesce(status_is_rejection, false) and not coalesce(status_is_payment_issued, false))::int,
    coalesce(sum(total_amount) filter (where not coalesce(status_is_rejection, false) and not coalesce(status_is_payment_issued, false)), 0)::numeric,
    count(*) filter (where coalesce(status_is_payment_issued, false))::int,
    coalesce(sum(total_amount) filter (where coalesce(status_is_payment_issued, false)), 0)::numeric,
    count(*) filter (where coalesce(status_is_rejection, false) and not coalesce(allow_resubmit, false))::int,
    coalesce(sum(total_amount) filter (where coalesce(status_is_rejection, false) and not coalesce(allow_resubmit, false)), 0)::numeric,
    count(*) filter (where coalesce(status_is_rejection, false) and coalesce(allow_resubmit, false))::int,
    coalesce(sum(total_amount) filter (where coalesce(status_is_rejection, false) and coalesce(allow_resubmit, false)), 0)::numeric
  from scoped;
$$;

grant execute on function public.get_my_claims_metrics(
  uuid, uuid, boolean, uuid, date, date
) to authenticated, service_role;

-- ============================================================================
-- 4. Pending Approvals
-- ============================================================================

drop function if exists public.pending_approvals_filtered(
  uuid, boolean, text, text, numeric, text, date, date, date, uuid, text, integer
);

create or replace function public.pending_approvals_filtered(
  p_claim_status_id   uuid    default null,
  p_allow_resubmit    boolean default null,
  p_employee_name     text    default null,
  p_amount_operator   text    default 'lte',
  p_amount_value      numeric default null,
  p_location_type     text    default null,
  p_claim_date_from   date    default null,
  p_claim_date_to     date    default null
)
returns table(id uuid, claim_date date, total_amount numeric)
language plpgsql
stable security definer
set search_path to 'public'
set plan_cache_mode to force_custom_plan
as $function$
DECLARE
  v_employee_id uuid;
  v_is_zbh      boolean;
BEGIN
  SELECT e.id, (d.designation_code = 'ZBH')
    INTO v_employee_id, v_is_zbh
  FROM public.employees e
  LEFT JOIN public.designations d ON d.id = e.designation_id
  WHERE lower(e.employee_email) = current_user_email()
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, c.claim_date, c.total_amount
  FROM public.expense_claims c
  JOIN public.employees owner ON owner.id = c.employee_id
  WHERE c.status_id IN (
      SELECT s.id
      FROM public.claim_statuses s
      WHERE s.approval_level IN (1, 2)
        AND s.is_rejection = false
        AND s.is_terminal = false
        AND s.is_active = true
        AND (p_claim_status_id IS NULL OR s.id = p_claim_status_id)
    )
    AND (
      (c.current_approval_level = 1 AND (
         owner.approval_employee_id_level_1 = v_employee_id
         OR (v_is_zbh AND owner.approval_employee_id_level_2 = v_employee_id)
      ))
      OR (c.current_approval_level = 2 AND owner.approval_employee_id_level_3 = v_employee_id)
    )
    AND (p_allow_resubmit IS NULL OR c.allow_resubmit = p_allow_resubmit)
    AND (p_claim_date_from IS NULL OR c.claim_date >= p_claim_date_from)
    AND (p_claim_date_to   IS NULL OR c.claim_date <= p_claim_date_to)
    AND (p_amount_value IS NULL OR (CASE
          WHEN p_amount_operator = 'gte' THEN c.total_amount >= p_amount_value
          WHEN p_amount_operator = 'eq'  THEN c.total_amount =  p_amount_value
          ELSE c.total_amount <= p_amount_value
        END))
    AND (p_location_type IS NULL OR c.work_location_id IN (
          SELECT w.id
          FROM public.work_locations w
          WHERE (p_location_type = 'outstation' AND w.requires_outstation_details = true)
             OR (p_location_type <> 'outstation'
                 AND w.requires_outstation_details = false
                 AND w.requires_vehicle_selection = true)
        ))
    AND (p_employee_name IS NULL OR p_employee_name = '' OR
         owner.employee_name ILIKE '%' || replace(replace(p_employee_name, '%', '\%'), '_', '\_') || '%');
END;
$function$;

create or replace function public.get_pending_approvals_page(
  p_limit             integer default 10,
  p_cursor_claim_date date    default null,
  p_cursor_id         uuid    default null,
  p_sort              text    default 'desc',
  p_claim_status_id   uuid    default null,
  p_allow_resubmit    boolean default null,
  p_employee_name     text    default null,
  p_amount_operator   text    default 'lte',
  p_amount_value      numeric default null,
  p_location_type     text    default null,
  p_claim_date_from   date    default null,
  p_claim_date_to     date    default null
)
returns table(id uuid, claim_date date)
language sql stable security invoker
set search_path to 'public'
set plan_cache_mode to force_custom_plan
as $$
  select id, claim_date
  from public.pending_approvals_filtered(
    p_claim_status_id, p_allow_resubmit, p_employee_name, p_amount_operator,
    p_amount_value, p_location_type, p_claim_date_from, p_claim_date_to
  )
  where p_cursor_claim_date is null or p_cursor_id is null or (case
      when p_sort = 'asc'
        then (claim_date > p_cursor_claim_date or (claim_date = p_cursor_claim_date and id > p_cursor_id))
        else (claim_date < p_cursor_claim_date or (claim_date = p_cursor_claim_date and id < p_cursor_id))
    end)
  order by
    case when p_sort = 'asc'  then claim_date end asc,
    case when p_sort <> 'asc' then claim_date end desc,
    case when p_sort = 'asc'  then id end asc,
    case when p_sort <> 'asc' then id end desc
  limit greatest(p_limit, 0) + 1;
$$;

grant execute on function public.get_pending_approvals_page(
  integer, date, uuid, text, uuid, boolean, text, text, numeric, text, date, date
) to authenticated, service_role;

create or replace function public.get_pending_approvals_metrics(
  p_claim_status_id   uuid    default null,
  p_allow_resubmit    boolean default null,
  p_employee_name     text    default null,
  p_amount_operator   text    default 'lte',
  p_amount_value      numeric default null,
  p_location_type     text    default null,
  p_claim_date_from   date    default null,
  p_claim_date_to     date    default null
)
returns table(claim_count integer, total_amount numeric)
language sql stable security invoker
set search_path to 'public'
set plan_cache_mode to force_custom_plan
as $$
  select count(*)::int, coalesce(sum(total_amount), 0)::numeric
  from public.pending_approvals_filtered(
    p_claim_status_id, p_allow_resubmit, p_employee_name, p_amount_operator,
    p_amount_value, p_location_type, p_claim_date_from, p_claim_date_to
  );
$$;

grant execute on function public.get_pending_approvals_metrics(
  uuid, boolean, text, text, numeric, text, date, date
) to authenticated, service_role;
