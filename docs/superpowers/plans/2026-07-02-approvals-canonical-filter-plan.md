# Approvals Pending Queue Canonical Filter (Finding 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Finding 4 (the `/approvals` Pending Approvals queue's employee-name search disagrees between the row list and the summary card/pagination total because `get_pending_approval_scope_summary` doesn't escape `%`/`_` wildcards the way `get_pending_approvals` does) by extracting one canonical `pending_approvals_filtered()` function that both a thin page RPC and a thin metrics RPC read from — the same pattern already applied to Finance History.

**Architecture:** Per `docs/superpowers/specs/2026-07-02-filter-count-metrics-consistency-design.md`. This phase surfaced more duplication than Finding 4's literal description: beyond the escaping mismatch, `get_pending_approval_scope_summary` also independently re-resolves the approver's subordinate scope (via TypeScript's `getPendingApprovalScopeByActor()`, producing employee-id arrays) and location-type filtering (via `getLocationIdsByApprovalLocationType()`) — both of which `get_pending_approvals` already resolves natively in SQL. The canonical function adopts `get_pending_approvals`'s SQL-side resolution for all three (scope, location, name-escaping), eliminating the TypeScript-side duplicates for this call path entirely, not just patching the escape.

**Tech Stack:** Next.js (App Router), Supabase Postgres (`language plpgsql`/`language sql stable`), Vitest, pgTAP.

**Performance-critical constraint — read before touching any SQL in this plan:** `get_pending_approvals` is `LANGUAGE plpgsql SECURITY DEFINER`, specifically rewritten (`20260622092000_fix_get_pending_approvals_plan_degradation.sql`) after a real production incident: resolving the approver's identity via a joined CTE caused Postgres's generic-plan optimizer to produce a catastrophic plan after ~5 executions (2,633ms / 89,281 buffers vs. 9.5ms / 515 buffers for the custom plan), tripping the 8-second `authenticated` role statement timeout. The fix hoists actor resolution into PL/pgSQL scalar variables (`DECLARE v_employee_id`) so the WHERE clause compares against a plain constant instead of a joined subquery. **This plan's canonical-function split was empirically load-tested against this exact regression before being written** — see "Verified platform behavior" below. Do not deviate from the `plan_cache_mode = force_custom_plan` mitigation without re-testing against a heavy-scope approver.

---

## Verified platform behavior (spike results, not assumptions)

Tested live against the dev DB (project `ibrvpangpuxiorspeffz`) using `mansoor@nxtwave.co.in`, the real approver with the largest scope (2,224 pending claims) — the closest available analog to the account that caused the original production incident. Spike objects (`_spike_pending_approvals_*`) were created, tested, and dropped within this session; no trace persisted.

| Test                                                                                                                                                                | Method                                                                                                                                                               | Result                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does splitting cursor/order/limit into an outer wrapper (calling a canonical `plpgsql` function) preserve fast single-call performance under mansoor's real scope?  | `EXPLAIN (ANALYZE, BUFFERS)` on a spiked `_spike_pending_approvals_page` / `_spike_pending_approvals_metrics`, JWT faked via `set_config('request.jwt.claims', ...)` | **Yes.** Page: 15ms / 2,404 buffers. Metrics: 14ms / 2,311 buffers. Both close to the documented "good" custom-plan baseline (9.5ms / 515 buffers), nowhere near the degraded case.                                                                                                          |
| Does the outer wrapper itself degrade after repeated calls (the same generic-plan mechanism that caused the original incident, now applied to the new outer layer)? | Ran the page wrapper 8 times in one session via a `DO` block, timing each call                                                                                       | **Yes, partially.** Calls 1–5: ~7–15ms (custom plan). Call 6 onward: ~35–37ms (generic plan). A real, measurable ~5x regression versus the pre-split single function — not present in the current code, introduced by this split. Still ~200x under the 8-second timeout, but not zero-cost. |
| Does `SET plan_cache_mode = force_custom_plan` on the wrapper function eliminate this regression?                                                                   | Same 8-call test against a wrapper with this `SET` clause added                                                                                                      | **Yes, completely.** All 8 calls: consistently ~7ms, no jump at call 6.                                                                                                                                                                                                                      |

**Conclusion — binding for this plan:** every new function in this migration (`pending_approvals_filtered`, `get_pending_approvals_page`, `get_pending_approvals_metrics`) includes `set plan_cache_mode = force_custom_plan`. This is not a stylistic choice — omitting it reintroduces a measured, real performance regression on the exact page that already caused one production incident.

---

## File Structure

| File                                                                               | Responsibility                                                                                                                            |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260702110000_pending_approvals_canonical_filter.sql`        | **Create** — canonical fn + page + metrics RPCs, drops the two old RPCs. One consolidated migration, idempotent.                          |
| `supabase/rollback/20260702110000_pending_approvals_canonical_filter.rollback.sql` | **Create** — restores prior state verbatim.                                                                                               |
| `supabase/tests/020_pending_approvals_filtered_parity.sql`                         | **Create** — pgTAP regression test pinning Finding 4 (wildcard escaping).                                                                 |
| `src/features/approvals/data/rpc/pending-summary.rpc.ts`                           | **Modify** — `getPendingApprovalScopeSummaryRpc` → `getPendingApprovalsMetricsRpc`, calling the new RPC name.                             |
| `src/features/approvals/data/queries/pending-summary.query.ts`                     | **Modify** — `getPendingApprovalsSummary` drastically simplified: no more actor/scope/location pre-resolution.                            |
| `src/features/approvals/data/repositories/approvals.repository.ts`                 | **Modify** — `getPendingApprovalsPaginated`'s RPC call renamed `get_pending_approvals` → `get_pending_approvals_page` (params unchanged). |
| `src/features/approvals/__tests__/approvals.repository.test.ts`                    | **Modify** — update RPC name assertion.                                                                                                   |
| `src/features/approvals/__tests__/pending-summary.test.ts`                         | **Create** — new test file for the simplified `getPendingApprovalsSummary` (none exists today per the pre-implementation survey).         |

**Not touched by this plan:** `page.tsx` needs no changes — unlike Finance History, Approvals already sources its pagination total from the same single metrics call that feeds the KPI card (`pendingTotalCount = approvalAnalytics.pendingApprovals.count`), so there is no redundant second count call to remove here. `getPendingApprovalScopeByActor()` (`pending-scope.repository.ts`) and `getLocationIdsByApprovalLocationType()` (`location-type.query.ts`) are left in place with their existing test coverage intact — they simply gain no new callers from this change; deleting them is a separate cleanup decision outside this plan's scope.

---

## Task 1: Consolidated SQL migration — canonical function + page/metrics RPCs

**Files:**

- Create: `supabase/migrations/20260702110000_pending_approvals_canonical_filter.sql`
- Create: `supabase/rollback/20260702110000_pending_approvals_canonical_filter.rollback.sql`

- [ ] **Step 1: Write the migration**

```sql
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
--      TypeScript (see finance-approvals-canonical-filter-plan.md's
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
```

- [ ] **Step 2: Write the rollback**

```sql
-- Rollback for 20260702110000_pending_approvals_canonical_filter.sql
-- Restores get_pending_approvals verbatim from
-- 20260622092000_fix_get_pending_approvals_plan_degradation.sql and
-- get_pending_approval_scope_summary verbatim from
-- 20260429080441_remote_schema.sql (lines 4025-4080).

-- ============================================================================
-- 1. Restore get_pending_approvals
-- ============================================================================

drop function if exists public.get_pending_approvals_page(
  integer, date, uuid, text, uuid, boolean, text, text, numeric, text, date, date
);

CREATE OR REPLACE FUNCTION public.get_pending_approvals(
  p_limit             integer DEFAULT 10,
  p_cursor_claim_date date    DEFAULT NULL,
  p_cursor_id         uuid    DEFAULT NULL,
  p_sort              text    DEFAULT 'desc',
  p_claim_status_id   uuid    DEFAULT NULL,
  p_allow_resubmit    boolean DEFAULT NULL,
  p_employee_name     text    DEFAULT NULL,
  p_amount_operator   text    DEFAULT 'lte',
  p_amount_value      numeric DEFAULT NULL,
  p_location_type     text    DEFAULT NULL,
  p_claim_date_from   date    DEFAULT NULL,
  p_claim_date_to     date    DEFAULT NULL
)
RETURNS TABLE(id uuid, claim_date date)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  SELECT c.id, c.claim_date
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
         owner.employee_name ILIKE '%' || replace(replace(p_employee_name, '%', '\%'), '_', '\_') || '%')
    AND (p_cursor_claim_date IS NULL OR p_cursor_id IS NULL OR (CASE
          WHEN p_sort = 'asc'
            THEN (c.claim_date > p_cursor_claim_date OR (c.claim_date = p_cursor_claim_date AND c.id > p_cursor_id))
            ELSE (c.claim_date < p_cursor_claim_date OR (c.claim_date = p_cursor_claim_date AND c.id < p_cursor_id))
        END))
  ORDER BY
    CASE WHEN p_sort = 'asc'  THEN c.claim_date END ASC,
    CASE WHEN p_sort <> 'asc' THEN c.claim_date END DESC,
    CASE WHEN p_sort = 'asc'  THEN c.id END ASC,
    CASE WHEN p_sort <> 'asc' THEN c.id END DESC
  LIMIT GREATEST(p_limit, 0) + 1;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_pending_approvals(
  integer, date, uuid, text, uuid, boolean, text, text, numeric, text, date, date
) TO authenticated, service_role;

-- ============================================================================
-- 2. Restore get_pending_approval_scope_summary
-- ============================================================================

drop function if exists public.get_pending_approvals_metrics(
  uuid, boolean, text, text, numeric, text, date, date
);

CREATE OR REPLACE FUNCTION public.get_pending_approval_scope_summary(
  p_level1_employee_ids uuid[] DEFAULT NULL,
  p_level2_employee_ids uuid[] DEFAULT NULL,
  p_pending_status_ids  uuid[] DEFAULT NULL,
  p_allow_resubmit      boolean DEFAULT NULL,
  p_employee_name       text DEFAULT NULL,
  p_claim_date_from     date DEFAULT NULL,
  p_claim_date_to       date DEFAULT NULL,
  p_amount_operator     text DEFAULT NULL,
  p_amount_value        numeric DEFAULT NULL,
  p_location_ids        uuid[] DEFAULT NULL
)
RETURNS TABLE(claim_count integer, total_amount numeric)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  WITH scoped_claims AS (
    SELECT c.total_amount
    FROM public.expense_claims c
    JOIN public.employees e ON e.id = c.employee_id
    WHERE (
      COALESCE(array_length(p_pending_status_ids, 1), 0) = 0
      OR c.status_id = ANY(p_pending_status_ids)
    )
      AND (
        (
          COALESCE(array_length(p_level1_employee_ids, 1), 0) > 0
          AND c.current_approval_level = 1
          AND c.employee_id = ANY(p_level1_employee_ids)
        )
        OR (
          COALESCE(array_length(p_level2_employee_ids, 1), 0) > 0
          AND c.current_approval_level = 2
          AND c.employee_id = ANY(p_level2_employee_ids)
        )
      )
      AND (p_allow_resubmit IS NULL OR c.allow_resubmit = p_allow_resubmit)
      AND (
        p_employee_name IS NULL
        OR e.employee_name ILIKE '%' || p_employee_name || '%'
      )
      AND (p_claim_date_from IS NULL OR c.claim_date >= p_claim_date_from)
      AND (p_claim_date_to IS NULL OR c.claim_date <= p_claim_date_to)
      AND (
        p_amount_value IS NULL
        OR (
          COALESCE(p_amount_operator, 'lte') = 'gte'
          AND c.total_amount >= p_amount_value
        )
        OR (
          COALESCE(p_amount_operator, 'lte') = 'eq'
          AND c.total_amount = p_amount_value
        )
        OR (
          COALESCE(p_amount_operator, 'lte') NOT IN ('gte', 'eq')
          AND c.total_amount <= p_amount_value
        )
      )
      AND (
        COALESCE(array_length(p_location_ids, 1), 0) = 0
        OR c.work_location_id = ANY(p_location_ids)
      )
  )
  SELECT
    COUNT(*)::int AS claim_count,
    COALESCE(SUM(sc.total_amount), 0)::numeric AS total_amount
  FROM scoped_claims sc;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_approval_scope_summary(
  uuid[], uuid[], uuid[], boolean, text, date, date, text, numeric, uuid[]
) TO authenticated, service_role;

-- ============================================================================
-- 3. Drop the canonical function — now unreferenced by the restored RPCs above
-- ============================================================================

drop function if exists public.pending_approvals_filtered(
  uuid, boolean, text, text, numeric, text, date, date
);
```

- [ ] **Step 3: Do NOT apply or commit** — per project convention, write these files only. Ask the user to apply the migration to their environment before proceeding to Task 3's verification.

---

## Task 2: pgTAP regression test pinning Finding 4

**Files:**

- Create: `supabase/tests/020_pending_approvals_filtered_parity.sql`

**Finding 4 recap:** searching Pending Approvals by an employee name containing a literal `_` used to show 0 rows in the list (correctly escaped) but a non-zero count on the summary card (unescaped `_` matched any single character). This test seeds an owner named with a literal underscore and asserts the list and metrics RPCs agree on both a name that should match and one that shouldn't.

- [ ] **Step 1: Write the test**

Fixture columns verified against live schema constraints during Finance History planning (same tables: `employees`, `designations`, `work_locations`, `expense_claims`) — reused here. Additionally verifies `employees.approval_employee_id_level_1` (nullable FK, no NOT NULL constraint) and `claim_statuses` approval_level semantics.

```sql
-- Regression test for Finding 4 (2026-07-01 filter/display consistency audit):
-- get_pending_approval_scope_summary did not escape %/_ wildcards in
-- p_employee_name, unlike get_pending_approvals. get_pending_approval_scope_summary
-- no longer exists; this test pins the replacement
-- (get_pending_approvals_metrics, sourced from pending_approvals_filtered())
-- to escape correctly, matching get_pending_approvals_page.
begin;
set local search_path = public, extensions;

select plan(3);

-- Fixture: an approver, and a claim owner whose name contains a LITERAL
-- underscore ("Ankur_Test", mirroring the audit's real "Ankur_Hemant_Akre"
-- search that exposed this bug), reporting to the approver at level 1.
insert into work_locations (id, location_code, location_name)
values ('66666666-6666-6666-6666-666666666661', 'PGTAP_WL2', 'PGTAP Test Location 2');

insert into designations (id, designation_code, designation_name, hierarchy_level)
values
  ('77777777-7777-7777-7777-777777777771', 'PGTAP_APPR', 'PGTAP Approver Designation', 2),
  ('77777777-7777-7777-7777-777777777772', 'PGTAP_OWNR', 'PGTAP Owner Designation', 1);

insert into employees (id, employee_id, employee_name, employee_email, designation_id, employee_status_id)
values (
  '88888888-8888-8888-8888-888888888881', 'PGTAP0002', 'PGTAP Approver',
  'pgtap-approver@nxtwave.co.in', '77777777-7777-7777-7777-777777777771',
  (select id from employee_statuses limit 1)
);

insert into employees (id, employee_id, employee_name, employee_email, designation_id, employee_status_id, approval_employee_id_level_1)
values (
  '88888888-8888-8888-8888-888888888882', 'PGTAP0003', 'Ankur_Test Owner',
  'pgtap-owner@nxtwave.co.in', '77777777-7777-7777-7777-777777777772',
  (select id from employee_statuses limit 1),
  '88888888-8888-8888-8888-888888888881'
);

insert into expense_claims (id, employee_id, claim_number, claim_date, work_location_id, designation_id, status_id, total_amount, current_approval_level)
values (
  '99999999-9999-9999-9999-999999999991',
  '88888888-8888-8888-8888-888888888882',
  'PGTAP-CLAIM-0002',
  current_date,
  '66666666-6666-6666-6666-666666666661',
  '77777777-7777-7777-7777-777777777772',
  (select id from claim_statuses where approval_level = 1 and not is_rejection and not is_terminal and is_active limit 1),
  750.00,
  1
);

-- Simulate being logged in as the approver (current_user_email() reads this).
select set_config('request.jwt.claims', json_build_object('email', 'pgtap-approver@nxtwave.co.in')::text, true);

-- Assertion 1: searching the LITERAL name "Ankur_Test" (with the real
-- underscore) matches via the page RPC.
select is(
  (select count(*)::int from get_pending_approvals_page(
    10, null, null, 'desc', null, null, 'Ankur_Test', 'lte', null, null, null, null
  )),
  1,
  'get_pending_approvals_page matches the literal underscore in the search term'
);

-- Assertion 2: the metrics RPC agrees exactly (this is the bug: the old
-- unescaped summary RPC would over-match here via the wildcard-underscore).
select is(
  (select claim_count from get_pending_approvals_metrics(
    null, null, 'Ankur_Test', 'lte', null, null, null, null
  )),
  1,
  'get_pending_approvals_metrics matches exactly the same one row as the page RPC'
);

-- Assertion 3: replacing the underscore with an unrelated single character
-- ("AnkurXTest") must NOT match under a correctly-escaped search — proves the
-- escaping is real, not incidentally passing.
select is(
  (select claim_count from get_pending_approvals_metrics(
    null, null, 'AnkurXTest', 'lte', null, null, null, null
  )),
  0,
  'get_pending_approvals_metrics does not match when the underscore is replaced with a different literal character'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Do not run locally** (no local Supabase stack available per this session's experience) — the user will run `npm run test:db` after applying Task 1's migration, or this can be verified via the same rolled-back-transaction technique used for Finance History's pgTAP test (Task 3 below does this).

---

## Task 3: Simplify `getPendingApprovalsSummary` and rename the page RPC call

**Files:**

- Modify: `src/features/approvals/data/rpc/pending-summary.rpc.ts`
- Modify: `src/features/approvals/data/queries/pending-summary.query.ts`
- Modify: `src/features/approvals/data/repositories/approvals.repository.ts:92-108`
- Modify: `src/features/approvals/__tests__/approvals.repository.test.ts`
- Create: `src/features/approvals/__tests__/pending-summary.test.ts`

- [ ] **Step 1: Write the failing test for the simplified summary function**

Create `src/features/approvals/__tests__/pending-summary.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveClaimAllowResubmitFilterValue: vi.fn(),
}))

vi.mock('@/features/claims/data/queries', () => ({
  resolveClaimAllowResubmitFilterValue:
    mocks.resolveClaimAllowResubmitFilterValue,
}))

import { getPendingApprovalsSummary } from '@/features/approvals/data/queries/pending-summary.query'
import type { SupabaseClient } from '@supabase/supabase-js'

function buildSupabaseStub(
  metricsResult: { claim_count: number; total_amount: number } | null
) {
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === 'get_pending_approvals_metrics') {
      return Promise.resolve({
        data: metricsResult ? [metricsResult] : [],
        error: null,
      })
    }
    throw new Error(`Unexpected rpc: ${name}`)
  })
  return { rpc } as unknown as SupabaseClient
}

describe('getPendingApprovalsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveClaimAllowResubmitFilterValue.mockResolvedValue(null)
  })

  it('returns zero immediately when approverEmail is empty, without calling the RPC', async () => {
    const supabase = buildSupabaseStub(null)

    const result = await getPendingApprovalsSummary(supabase, '', {
      employeeName: null,
      claimStatus: null,
      claimDateFrom: null,
      claimDateTo: null,
      amountOperator: 'lte',
      amountValue: null,
      locationType: null,
      claimDateSort: 'desc',
    })

    expect(result).toEqual({ count: 0, amount: 0 })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('calls get_pending_approvals_metrics directly with raw filter params — no scope/location pre-resolution', async () => {
    const supabase = buildSupabaseStub({ claim_count: 5, total_amount: 12500 })

    const result = await getPendingApprovalsSummary(
      supabase,
      'pgtap-approver@nxtwave.co.in',
      {
        employeeName: 'Ankur_Test',
        claimStatus: null,
        claimDateFrom: null,
        claimDateTo: null,
        amountOperator: 'lte',
        amountValue: null,
        locationType: null,
        claimDateSort: 'desc',
      }
    )

    expect(result).toEqual({ count: 5, amount: 12500 })
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_pending_approvals_metrics',
      expect.objectContaining({ p_employee_name: 'Ankur_Test' })
    )
    // The old implementation resolved p_level1_employee_ids/p_level2_employee_ids/
    // p_location_ids in TypeScript before calling the RPC. Assert those are gone.
    const callArgs = (supabase.rpc as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as Record<string, unknown>
    expect(callArgs).not.toHaveProperty('p_level1_employee_ids')
    expect(callArgs).not.toHaveProperty('p_level2_employee_ids')
    expect(callArgs).not.toHaveProperty('p_location_ids')
    expect(callArgs).not.toHaveProperty('p_pending_status_ids')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/approvals/__tests__/pending-summary.test.ts`
Expected: FAIL — `getPendingApprovalsSummary` doesn't exist yet with this signature/behavior in its current form (it currently calls `getApproverActorByEmail`/`getPendingApprovalScopeByActor`/`getLocationIdsByApprovalLocationType`, none of which this stub mocks), so it will error on an unmocked dependency.

- [ ] **Step 3: Update the RPC wrapper**

Replace the full contents of `src/features/approvals/data/rpc/pending-summary.rpc.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

type PendingApprovalsMetricsRow = {
  claim_count: number | string | null
  total_amount: number | string | null
}

export async function getPendingApprovalsMetricsRpc(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<PendingApprovalsMetricsRow | null> {
  const { data, error } = await supabase.rpc(
    'get_pending_approvals_metrics',
    args
  )

  if (error) {
    throw new Error(error.message)
  }

  return (
    Array.isArray(data) ? data[0] : data
  ) as PendingApprovalsMetricsRow | null
}
```

- [ ] **Step 4: Simplify `getPendingApprovalsSummary`**

Replace the full contents of `src/features/approvals/data/queries/pending-summary.query.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

import type { PendingApprovalsFilters } from '@/features/approvals/types'
import { getPendingApprovalsMetricsRpc } from '@/features/approvals/data/rpc/pending-summary.rpc'
import { resolveClaimAllowResubmitFilterValue } from '@/features/claims/data/queries'
import { parseClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'

type PendingApprovalsSummary = {
  count: number
  amount: number
}

const DEFAULT_PENDING_FILTERS: PendingApprovalsFilters = {
  employeeName: null,
  claimStatus: null,
  claimDateFrom: null,
  claimDateTo: null,
  amountOperator: 'lte',
  amountValue: null,
  locationType: null,
  claimDateSort: 'desc',
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

// pending_approvals_filtered() resolves the approver's scope, status set, and
// location-type matching entirely in SQL — this function only translates the
// UI's filter shape into RPC params. It intentionally does NOT resolve
// approverEmail into an id, subordinate-employee-id arrays, or location-id
// arrays: that was get_pending_approval_scope_summary's duplicated
// re-implementation of what get_pending_approvals already did in SQL (see
// docs/superpowers/plans/2026-07-02-approvals-canonical-filter-plan.md).
export async function getPendingApprovalsSummary(
  supabase: SupabaseClient,
  approverEmail: string,
  filters: PendingApprovalsFilters = DEFAULT_PENDING_FILTERS
): Promise<PendingApprovalsSummary> {
  if (!approverEmail) {
    return { count: 0, amount: 0 }
  }

  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)
  const allowResubmitFilter = await resolveClaimAllowResubmitFilterValue(
    supabase,
    parsedStatusFilter
  )
  const normalizedName = filters.employeeName?.trim() ?? ''

  const summary = await getPendingApprovalsMetricsRpc(supabase, {
    p_claim_status_id: parsedStatusFilter?.statusId ?? null,
    p_allow_resubmit: allowResubmitFilter,
    p_employee_name: normalizedName || null,
    p_amount_operator: filters.amountOperator,
    p_amount_value: filters.amountValue,
    p_location_type: filters.locationType,
    p_claim_date_from: filters.claimDateFrom,
    p_claim_date_to: filters.claimDateTo,
  })

  return {
    count: toNumber(summary?.claim_count),
    amount: toNumber(summary?.total_amount),
  }
}
```

- [ ] **Step 5: Rename the page RPC call**

In `src/features/approvals/data/repositories/approvals.repository.ts`, change line 93 only:

```typescript
  const { data: pageRows, error: pageError } = await supabase.rpc(
    'get_pending_approvals_page',
    {
```

(Every argument below it — `p_limit` through `p_claim_date_to` — is unchanged; the new RPC has the identical 12-parameter shape.)

- [ ] **Step 6: Update the existing repository test's RPC name expectations**

`src/features/approvals/__tests__/approvals.repository.test.ts` mocks `supabase.rpc` generically (`vi.fn().mockResolvedValue(rpcResult)`, not asserting the RPC name) — no changes needed to make it pass, but add one assertion to lock in the new name. After the existing `expect(supabase.rpc).not.toHaveBeenCalled()` test (line 50), add a new test:

```typescript
it('calls get_pending_approvals_page (not the old get_pending_approvals)', async () => {
  const supabase = buildSupabaseMock({ data: [], error: null })

  await getPendingApprovalsPaginated(
    supabase as unknown as SupabaseClient,
    'someone@nxtwave.co.in',
    null,
    10
  )

  expect(supabase.rpc).toHaveBeenCalledWith(
    'get_pending_approvals_page',
    expect.anything()
  )
})
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/features/approvals`
Expected: PASS — all tests in this directory, including the two new/modified ones.

- [ ] **Step 8: Run the full test suite and typecheck**

Run: `npx vitest run`
Run: `npx tsc --noEmit`
Expected: both clean.

- [ ] **Step 9: Do not commit** — leave changes in the working tree per project convention.

---

## Task 4: Post-apply verification (after the user applies Task 1's migration)

**Files:** none — verification only, mirrors the Finance History plan's Task 9.

- [ ] **Step 1: Confirm functions exist with correct signatures**

```sql
select proname, pronargs from pg_proc
where proname in ('pending_approvals_filtered','get_pending_approvals_page','get_pending_approvals_metrics','get_pending_approvals','get_pending_approval_scope_summary');
```

Expected: the three new functions present with 8/12/8 args respectively; the two old ones absent.

- [ ] **Step 2: Re-run the heavy-scope timing test from this plan's "Verified platform behavior" section against the LIVE (non-spike) functions**, using `mansoor@nxtwave.co.in`'s real scope, to confirm the applied migration behaves identically to the spike:

```sql
select set_config('request.jwt.claims', '{"email":"mansoor@nxtwave.co.in"}', true);
create temporary table _verify_timings (call_num int, ms numeric, rows_out int);
do $$
declare i int; t0 timestamptz; t1 timestamptz; n int;
begin
  for i in 1..8 loop
    t0 := clock_timestamp();
    select count(*) into n from get_pending_approvals_page(20,null,null,'desc',null,null,null,'lte',null,null,null,null);
    t1 := clock_timestamp();
    insert into _verify_timings values (i, extract(milliseconds from (t1-t0)), n);
  end loop;
end $$;
select * from _verify_timings order by call_num;
```

Expected: all 8 calls in a similar, stable range (no jump at call 6) — confirms `plan_cache_mode = force_custom_plan` took effect as written, not just in the spike's throwaway copy.

- [ ] **Step 3: Run the pgTAP test from Task 2 against dev** (via the rolled-back-transaction technique, since no local Supabase stack is available) — insert the fixture, run the three assertions as plain `SELECT` comparisons instead of pgTAP `is()` calls, wrapped in `BEGIN; ... ROLLBACK;`, confirm all three pass, confirm the rollback leaves zero rows.

- [ ] **Step 4: `generate_typescript_types` check (INV-6)** — confirm `pending_approvals_filtered`, `get_pending_approvals_page`, `get_pending_approvals_metrics` all produce fully field-typed `Returns` shapes, and `get_pending_approvals`/`get_pending_approval_scope_summary` are absent from the generated types.

---

## Self-Review Notes

**Spec coverage:** Finding 4 ✓ (Task 1 canonical function escapes once; Task 2 pgTAP pins it). The two additional duplications discovered during planning (approver-scope resolution, location-type resolution) ✓ eliminated in the same pass (Task 3 removes `getPendingApprovalScopeByActor`/`getLocationIdsByApprovalLocationType` calls from the summary path). INV-6 ✓ (Task 4 Step 4). Performance regression risk ✓ empirically tested and mitigated (`plan_cache_mode = force_custom_plan`, validated against the real heaviest-scope approver in dev before being written into the plan, not assumed).

**Deliberately not touched:** `page.tsx` (no redundant count call exists here, unlike Finance History). `getPendingApprovalScopeByActor()`/`getLocationIdsByApprovalLocationType()` source files (left in place, now with zero callers from this path but their own test coverage intact — deleting them is a separate decision).

**Not yet planned:** Phase 3 (Claims, Finding 3) and Phase 4 (Finance Queue, consistency) — each gets its own plan document, written fresh, per the established phasing.
