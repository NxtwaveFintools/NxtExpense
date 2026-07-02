-- Finding 3 (2026-07-01 filter/display consistency audit) + canonical-filter
-- architecture (docs/superpowers/specs/2026-07-02-filter-count-metrics-consistency-design.md).
--
-- Purely additive: no existing function is touched. get_employee_claim_metrics
-- stays exactly as-is — it serves getDashboardClaimStats/getProfileClaimStats,
-- which correctly want UNFILTERED all-time stats (no filter bar on those
-- pages). This migration is only for the /claims page's own filtered path.
--
--   1. my_claims_filtered() — the ONLY place employee_id scoping,
--      status/allow_resubmit/work_location/date filtering are applied for
--      the My Claims page. Mirrors applyMyClaimsFilters
--      (claims.repository.ts:125-149) predicate-for-predicate.
--   2. get_my_claims_page — thin: cursor/limit over the canonical function,
--      flat hydrated columns (work_location_name, status_code, etc.) instead
--      of PostgREST embeds.
--   3. get_my_claims_metrics — thin: aggregates (total/pending/rejected/
--      rejected_allow_reclaim, count+amount) over the canonical function.
--      Bucketing logic ported verbatim from get_employee_claim_metrics
--      (20260429080441_remote_schema.sql:2695-2743), with filters added.

-- ============================================================================
-- 1. Canonical filtered dataset
-- ============================================================================

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

-- Not granted to anon/authenticated: internal helper, called only by the two
-- RPCs below.

-- ============================================================================
-- 2. get_my_claims_page
-- ============================================================================

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
-- NOTE: RETURNS TABLE(...) does not register a named composite type the way
-- CREATE TABLE does — "returns setof public.my_claims_filtered" fails with
-- 42704 ("type does not exist") because no such type exists, only a function
-- of that name. The column list below is repeated verbatim from
-- my_claims_filtered's own RETURNS TABLE(...) declaration above; keep the two
-- in sync by hand if either changes.
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
  -- DETERMINISTIC keyset order: id is the REQUIRED secondary sort key — never remove it.
  order by created_at desc, id desc
  limit greatest(p_limit, 0) + 1;
$$;

grant execute on function public.get_my_claims_page(
  uuid, uuid, boolean, uuid, date, date, timestamptz, uuid, integer
) to authenticated, service_role;

-- ============================================================================
-- 3. get_my_claims_metrics
-- ============================================================================

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
