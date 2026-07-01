-- Rewrite get_finance_history_page to return fully-hydrated flat rows (Option C).
--
-- WHY:
--   getFinanceHistoryPaginated enriched each keyset page via two follow-up PostgREST
--   `.in('id', [...ids])` reads (finance_actions, expense_claims). Those build a REST
--   URL whose length scales with page size; past ~350-400 ids (~15KB) the Supabase
--   gateway rejects the request with a bare 400. At export chunk sizes (500-1000) this
--   made "All CSV" / "BC Expense" silently truncate to header-only. See
--   docs/superpowers/plans/2026-07-01-finance-history-single-rpc-hydration.md and its
--   companion review doc for the full analysis (Option A/B/C/D evaluation, why C was
--   chosen, and the design fixes folded in after adversarial review).
--
--   This migration collapses the two follow-up reads into the SAME keyset RPC: the
--   `page` CTE is byte-for-byte the current function's body (unchanged filtering,
--   ordering, cursor, limit), and the enrichment joins run only against the already
--   keyset-limited `page` rows (<= p_limit + 1), never the full filtered set.
--
-- RETURN TYPE CHANGE — DROP required:
--   Postgres refuses `CREATE OR REPLACE FUNCTION` when the return-table shape changes
--   (42P13: cannot change return type of existing function). The old 3-column version
--   must be dropped first, in this same migration, so there is never a window with
--   zero or two versions of the function. This is the same class of hazard as
--   20260622090000_drop_stale_approval_history_overload.sql (a stale overload once
--   caused a live PGRST203 outage) — different failure mode (hard migration error vs.
--   silent ambiguity), same underlying lesson: never let two shapes of the same
--   function name coexist.
--
-- JOIN-TYPE AUDIT (do not "simplify" these without re-checking the source embed):
--   expense_claims        INNER  -- finance_actions.claim_id is NOT NULL; claim always exists
--   employees (owner)     INNER  -- matches today's `employees!employee_id!inner(...)` embed
--   designations          LEFT   -- matches `designations!designation_id(...)` (no !inner)
--   work_locations        LEFT   -- matches `work_locations(...)` (no !inner)
--   expense_locations     LEFT   -- matches `expense_locations(...)` (no !inner)
--   vehicle_types         LEFT   -- matches `vehicle_types(...)` (no !inner)
--   claim_statuses        LEFT   -- matches `claim_statuses!status_id(...)` (no !inner)
--   employees (actor)     LEFT   -- matches `actor:employees!actor_employee_id(...)` (no !inner)
--   Every join above is a to-one lookup by primary key (verified against
--   information_schema): none can multiply a page row. Combined with the `page` CTE's
--   ORDER BY + LIMIT executing BEFORE these joins, page-row-count and the keyset
--   hasNextPage/id-tiebreaker math are provably unaffected by this change. A future
--   one-to-many addition (e.g. an array of attachments) needs json_agg + GROUP BY and
--   a fresh review of this invariant — do not add one casually.

drop function if exists public.get_finance_history_page(
  boolean, text, text, text, uuid, uuid, text, uuid, text, text,
  timestamptz, timestamptz, text[], timestamptz, timestamptz, timestamptz, uuid, integer
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
  -- `page` = the EXACT current function body (unchanged filtering/ordering/cursor/limit),
  -- widened only to carry the finance_actions columns the enrichment step below needs
  -- (action, notes, actor_employee_id) so no redundant self-join back to finance_actions
  -- is required.
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
    -- DETERMINISTIC keyset order: id is the REQUIRED secondary sort key — never remove it.
    order by acted_at desc, id desc
    limit p_limit + 1
  )
  -- Enrichment joins run only against `page` (<= p_limit + 1 rows) — never the full
  -- filtered set. Every join is a to-one primary-key lookup (see audit above).
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
  -- Re-assert the keyset order: joins are to-one so row count/order can't drift, but
  -- ORDER BY is cheap insurance and keeps the contract explicit at the final SELECT too.
  order by p.acted_at desc, p.id desc;
$$;

grant execute on function public.get_finance_history_page(
  boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz,
  text[],timestamptz,timestamptz,timestamptz,uuid,integer
) to authenticated, service_role;
