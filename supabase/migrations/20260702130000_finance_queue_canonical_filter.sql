-- Consistency pass (docs/superpowers/specs/2026-07-02-filter-count-metrics-consistency-design.md):
-- no bug exists on this page (2026-07-01 audit checked 8 filter combinations,
-- found exact agreement). This closes the one real duplication — the same
-- base-CTE + has_filters branching logic was independently written in both
-- get_finance_queue_page and get_finance_queue_count.
--
-- get_finance_queue_metrics is intentionally NOT touched: it scopes across
-- ALL claims regardless of status (p_required_status_id passed as null to
-- finance_filtered_claim_ids — see 20260618091100_get_finance_queue_metrics.sql:73-77),
-- bucketing into pending/approved/rejected via status-ID arrays, for its
-- whole-lifecycle KPI cards. That is a different, both-correct scope from
-- page/count's single-status scope, not drift — collapsing it into this
-- canonical function would be incorrect, not more consistent.
--
-- Parity with the pre-migration functions was verified live (rolled-back
-- transaction) for both a filtered and an unfiltered case before this was
-- written — see docs/superpowers/plans/2026-07-02-finance-queue-canonical-filter-plan.md
-- "Verified platform behavior".
--
-- No DROP needed for either RPC below: parameter lists and return types are
-- byte-identical to the live versions, only the body changes.

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

-- Not granted to anon/authenticated: internal helper, called only by the two
-- RPCs below.

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
  -- DETERMINISTIC keyset order: id is the REQUIRED secondary sort key — never remove it.
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

-- Grants unchanged from the live functions — re-issued for idempotency (a
-- fresh CREATE FUNCTION with the same signature keeps existing grants in
-- Postgres, but stating them explicitly makes this migration correct even if
-- run against an environment where that weren't true).
grant execute on function public.get_finance_queue_page(
  uuid,boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz,
  timestamptz,uuid,integer
) to authenticated, service_role;

grant execute on function public.get_finance_queue_count(
  uuid,boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz
) to authenticated, service_role;
