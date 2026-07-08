-- Finding 4 (2026-07-01 filter/display consistency audit) + canonical-filter
-- architecture (docs/superpowers/specs/2026-07-02-filter-count-metrics-consistency-design.md).
--
-- Consolidates:
--   1. pending_approvals_filtered() — the ONLY place approver-scope resolution,
--      status/allow_resubmit/amount/location/date filtering, and employee-name
--      matching (WITH wildcard escaping) are applied for the Pending Approvals
--      queue. LANGUAGE plpgsql SECURITY DEFINER, ported verbatim from
--      get_pending_approvals's proven-fast actor-resolution mechanism
--      (20260622092000_fix_get_pending_approvals_plan_degradation.sql) — never
--      revert to resolving the actor via a joined CTE; that is the exact shape
--      of the incident that migration fixed.
--   2. get_pending_approvals_page — thin: adds cursor/sort/limit over the
--      canonical function. Same 12 params get_pending_approvals had.
--   3. get_pending_approvals_metrics — thin: aggregates (count, sum) over the
--      canonical function. Takes the SAME raw filter params as the page RPC —
--      no more pre-resolved employee-id arrays or location-id arrays from
--      TypeScript (see docs/superpowers/plans/2026-07-02-approvals-canonical-filter-plan.md
--      "Verified platform behavior" section — this fully replaces
--      get_pending_approval_scope_summary, which took TS-precomputed
--      p_level1_employee_ids/p_level2_employee_ids/p_location_ids and did NOT
--      escape p_employee_name).
--   4. get_pending_approvals and get_pending_approval_scope_summary — DROPPED.
--
-- plan_cache_mode = force_custom_plan on every function here: empirically
-- required (see plan doc "Verified platform behavior") to avoid reintroducing
-- the generic-plan degradation the plpgsql rewrite fixed. Without it, splitting
-- cursor/limit into an outer wrapper causes a measured ~5x slowdown after the
-- 5th call in a session (still safe, but not free — and easy to avoid).
--
-- Idempotent: every statement is CREATE OR REPLACE or DROP ... IF EXISTS.

-- ============================================================================
-- 1. Canonical filtered dataset
-- ============================================================================

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
  -- Resolve the calling approver ONCE into scalar variables — this is the
  -- load-bearing fix from 20260622092000; keeping the actor id out of the main
  -- join/WHERE as anything other than a plain scalar reintroduces the generic-
  -- plan degradation that caused a production statement-timeout incident.
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

-- Not granted to anon/authenticated: internal helper, called only by the two
-- RPCs below.

-- ============================================================================
-- 2. get_pending_approvals_page — replaces get_pending_approvals
-- ============================================================================

drop function if exists public.get_pending_approvals(
  integer, date, uuid, text, uuid, boolean, text, text, numeric, text, date, date
);

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

-- ============================================================================
-- 3. get_pending_approvals_metrics — replaces get_pending_approval_scope_summary
-- ============================================================================

drop function if exists public.get_pending_approval_scope_summary(
  uuid[], uuid[], uuid[], boolean, text, date, date, text, numeric, uuid[]
);

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
