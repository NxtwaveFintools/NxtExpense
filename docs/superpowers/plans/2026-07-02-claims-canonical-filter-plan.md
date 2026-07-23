# My Claims Canonical Filter (Finding 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Finding 3 (the `/claims` page's KPI cards — "Total Claims", "Pending", "Rejected", "Rejected - Allow Reclaim" — never change when filters are applied, because `get_employee_claim_metrics(p_employee_id)` takes no filter parameters at all) by introducing a canonical `my_claims_filtered()` SQL function that a new `get_my_claims_page` and `get_my_claims_metrics` both read from — the same pattern already applied to Finance History and Approvals.

**Architecture:** Per `docs/superpowers/specs/2026-07-02-filter-count-metrics-consistency-design.md`. Unlike the prior two phases, Claims' list/count path is **not currently buggy** — `getMyClaimsPaginated` and `getMyClaimsTotalCount` already share one TypeScript helper, `applyMyClaimsFilters`, so they already agree with each other. The bug is narrower: only the metrics/KPI-card path bypasses that shared filter logic entirely. But `applyMyClaimsFilters` is a PostgREST query-builder helper — it cannot express the bucketed conditional aggregation (`COUNT(*) FILTER (WHERE ...)` per status bucket) the KPI cards need, so metrics has always required its own SQL. Migrating list+count onto the same canonical SQL function the metrics RPC uses (rather than leaving list/count on PostgREST and only adding filter params to metrics) is deliberately chosen over the smaller patch: it puts the filter predicate in exactly one place going forward, matching the standard applied everywhere else in this initiative, rather than leaving two independent definitions (TS `applyMyClaimsFilters` and SQL `WHERE`) that can drift apart the same way Finding 1 and Finding 4 already did.

**Critical scope boundary — read before touching any SQL:** `get_employee_claim_metrics(p_employee_id)` is used by **two independent consumers**: the `/claims` page (via `getMyClaimsStats`, the one that's buggy) and a dashboard widget + profile page (via `getDashboardClaimStats`/`getProfileClaimStats` in `employee-claim-summary.query.ts`, which correctly want **unfiltered, all-time** stats — those pages have no filter bar and are not part of Finding 3). `get_employee_claim_metrics` is **not modified or dropped** by this plan — it continues to serve the dashboard/profile use case exactly as today. Only `getMyClaimsStats` (the `/claims`-page-specific caller) is changed to use a new, separate, filtered RPC.

**Tech Stack:** Next.js (App Router), Supabase Postgres (`language sql stable`), Vitest, pgTAP.

---

## File Structure

| File                                                                       | Responsibility                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260702120000_my_claims_canonical_filter.sql`        | **Create** — canonical fn + page + metrics RPCs. Purely additive — no existing function is dropped or altered.                                                                                                                                                    |
| `supabase/rollback/20260702120000_my_claims_canonical_filter.rollback.sql` | **Create** — drops the three new functions.                                                                                                                                                                                                                       |
| `supabase/tests/030_my_claims_filtered_parity.sql`                         | **Create** — pgTAP regression test pinning Finding 3.                                                                                                                                                                                                             |
| `src/features/claims/data/queries/claim-columns.ts`                        | **Modify** — add `mapHydratedClaimRow()`, a new mapper for the flat RPC row shape, alongside the existing `mapClaimRow()` (kept, still used by `getClaimById`/`getRecentClaimsForEmployee`, out of scope).                                                        |
| `src/features/claims/data/repositories/claims.repository.ts`               | **Modify** — `getMyClaimsPaginated` sourced from `get_my_claims_page`; `getMyClaimsTotalCount` sourced from `get_my_claims_metrics`. `applyMyClaimsFilters`/`resolveMyClaimsStatusFilter` removed (superseded by the SQL canonical function) — used nowhere else. |
| `src/features/claims/data/rpc/claim-metrics.rpc.ts`                        | **Modify** — add `getMyClaimsFilteredMetricsRpc`; `getMyClaimsStats` now takes a `filters` param and calls it. `getEmployeeClaimMetrics`/`get_employee_claim_metrics` call **untouched**.                                                                         |
| `src/app/(app)/claims/page.tsx`                                            | **Modify** — pass `normalizedFilters` to `getMyClaimsStats`; remove the redundant `getMyClaimsTotalCount` call once metrics carries the same total.                                                                                                               |
| `src/features/claims/__tests__/claims.repository.test.ts`                  | **Create** — no dedicated test exists today for `getMyClaimsPaginated`/`getMyClaimsTotalCount`.                                                                                                                                                                   |
| `src/features/claims/__tests__/claim-metrics.rpc.test.ts`                  | **Create** — covers the new `getMyClaimsFilteredMetricsRpc`/updated `getMyClaimsStats`.                                                                                                                                                                           |

**Not touched:** `get_employee_claim_metrics`, `getDashboardClaimStats`, `getProfileClaimStats`, `getRecentClaimsForEmployee`, `getClaimById`, `getClaimHistory`, `CLAIM_COLUMNS`/`mapClaimRow` (kept for the single-claim-lookup use case) — all serve purposes outside Finding 3's scope. `src/features/claims/server/claims-export-context.ts` needs **no changes**: it calls `getMyClaimsTotalCount`, whose exported signature is unchanged (same pattern as Finance History's `getFinanceHistoryTotalCount`).

---

## Task 1: Consolidated SQL migration — canonical function + page/metrics RPCs

**Files:**

- Create: `supabase/migrations/20260702120000_my_claims_canonical_filter.sql`
- Create: `supabase/rollback/20260702120000_my_claims_canonical_filter.rollback.sql`

- [ ] **Step 1: Write the migration**

The canonical function returns every column `CLAIM_COLUMNS`' PostgREST embeds currently provide (`src/features/claims/data/queries/claim-columns.ts:4-11`), flattened — following the same flat-column convention Finance History's hydration rewrite established (`20260701100000_rewrite_get_finance_history_page_hydrated.sql`), not nested jsonb mimicking PostgREST embeds.

```sql
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
returns setof public.my_claims_filtered
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
```

- [ ] **Step 2: Write the rollback**

```sql
-- Rollback for 20260702120000_my_claims_canonical_filter.sql
-- All three functions are purely additive (no prior version existed) —
-- rollback is a straight drop, in dependency order (dependents first).

drop function if exists public.get_my_claims_metrics(
  uuid, uuid, boolean, uuid, date, date
);

drop function if exists public.get_my_claims_page(
  uuid, uuid, boolean, uuid, date, date, timestamptz, uuid, integer
);

drop function if exists public.my_claims_filtered(
  uuid, uuid, boolean, uuid, date, date
);
```

- [ ] **Step 3: Do NOT apply or commit** — write only, per project convention. Ask the user to apply before Task 4's post-apply verification.

---

## Task 2: pgTAP regression test pinning Finding 3

**Files:**

- Create: `supabase/tests/030_my_claims_filtered_parity.sql`

**Finding 3 recap:** the KPI cards never move when a filter is applied, because the metrics RPC ignored every filter argument (it didn't even accept any). This test seeds an employee with two claims in different statuses and asserts filtering by status changes the metrics — the literal symptom from the audit ("Selecting any claim-status... filter changes the table and the pagination total correctly, but... cards never move").

- [ ] **Step 1: Write the test**

```sql
-- Regression test for Finding 3 (2026-07-01 filter/display consistency audit):
-- get_employee_claim_metrics(p_employee_id) took no filter params at all, so
-- the /claims page's KPI cards never reflected the active filter while the
-- list and pagination total (both already correctly filtered) did. This test
-- pins get_my_claims_metrics to actually respond to a status filter.
begin;
set local search_path = public, extensions;

select plan(3);

insert into work_locations (id, location_code, location_name)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'PGTAP_WL3', 'PGTAP Test Location 3');

insert into designations (id, designation_code, designation_name, hierarchy_level)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'PGTAP_CLMOWN', 'PGTAP Claim Owner Designation', 1);

insert into employees (id, employee_id, employee_name, employee_email, designation_id, employee_status_id)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'PGTAP0004', 'PGTAP Claims Employee',
  'pgtap-claims@nxtwave.co.in', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  (select id from employee_statuses limit 1)
);

-- Two claims for the SAME employee, DIFFERENT statuses: one pending
-- (approval_level not null, not rejection/payment-issued), one rejected.
insert into expense_claims (id, employee_id, claim_number, claim_date, work_location_id, designation_id, status_id, total_amount)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  'PGTAP-CLAIM-0003',
  current_date,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  (select id from claim_statuses where approval_level = 1 and not is_rejection and not is_terminal and is_active limit 1),
  200.00
);

insert into expense_claims (id, employee_id, claim_number, claim_date, work_location_id, designation_id, status_id, total_amount)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  'PGTAP-CLAIM-0004',
  current_date,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  (select id from claim_statuses where is_rejection and is_active limit 1),
  300.00
);

-- Assertion 1: unfiltered metrics count both claims.
select is(
  (select total_count from get_my_claims_metrics('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', null, null, null, null, null)),
  2,
  'unfiltered get_my_claims_metrics counts both claims'
);

-- Assertion 2: filtering to the pending claim's exact status_id narrows
-- metrics to 1 — the exact symptom Finding 3 describes (cards must move).
select is(
  (select total_count from get_my_claims_metrics(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    (select status_id from expense_claims where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'),
    null, null, null, null
  )),
  1,
  'get_my_claims_metrics narrows to 1 when filtered to the pending claim''s status — cards now respond to the filter'
);

-- Assertion 3: page row count for the identical filter matches metrics
-- total_count (INV-1) — asserted directly, not just trusted from architecture.
select is(
  (select count(*)::int from get_my_claims_page(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    (select status_id from expense_claims where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'),
    null, null, null, null, null, null, 10
  )),
  (select total_count from get_my_claims_metrics(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    (select status_id from expense_claims where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'),
    null, null, null, null
  )),
  'page row count and metrics total_count agree for an identical filter'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Do not run locally** — no local Supabase stack available (per this session's prior experience with Finance History/Approvals); verify via the rolled-back-transaction technique against dev after the user applies Task 1's migration (Task 4).

---

## Task 3: TypeScript layer — hydrated row mapper, repository, metrics wrapper, page wiring

**Files:**

- Modify: `src/features/claims/data/queries/claim-columns.ts`
- Modify: `src/features/claims/data/repositories/claims.repository.ts`
- Modify: `src/features/claims/data/rpc/claim-metrics.rpc.ts`
- Modify: `src/app/(app)/claims/page.tsx`
- Create: `src/features/claims/__tests__/claims.repository.test.ts`
- Create: `src/features/claims/__tests__/claim-metrics.rpc.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/features/claims/__tests__/claim-metrics.rpc.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getMyClaimsStats } from '@/features/claims/data/rpc/claim-metrics.rpc'
import type { SupabaseClient } from '@supabase/supabase-js'

function buildSupabaseStub(metricsResult: Record<string, number> | null) {
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === 'get_my_claims_metrics') {
      return Promise.resolve({
        data: metricsResult ? [metricsResult] : [],
        error: null,
      })
    }
    throw new Error(`Unexpected rpc: ${name}`)
  })
  return { rpc } as unknown as SupabaseClient
}

describe('getMyClaimsStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls get_my_claims_metrics with the employee id and filter params (not the unfiltered get_employee_claim_metrics)', async () => {
    const supabase = buildSupabaseStub({
      total_count: 1,
      total_amount: 200,
      pending_count: 1,
      pending_amount: 200,
      approved_count: 0,
      approved_amount: 0,
      rejected_count: 0,
      rejected_amount: 0,
      rejected_allow_reclaim_count: 0,
      rejected_allow_reclaim_amount: 0,
    })

    const result = await getMyClaimsStats(supabase, 'employee-1', {
      claimStatus: 'status-1',
      workLocation: null,
      claimDateFrom: null,
      claimDateTo: null,
    })

    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_my_claims_metrics',
      expect.objectContaining({ p_employee_id: 'employee-1' })
    )
    expect(result.total).toEqual({ count: 1, amount: 200 })
    expect(result.pending).toEqual({ count: 1, amount: 200 })
  })
})
```

Create `src/features/claims/__tests__/claims.repository.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getMyClaimsPaginated,
  getMyClaimsTotalCount,
} from '@/features/claims/data/repositories/claims.repository'
import type { SupabaseClient } from '@supabase/supabase-js'

function buildHydratedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'claim-1',
    claim_number: 'CLAIM-0001',
    employee_id: 'employee-1',
    claim_date: '2026-06-01',
    work_location_id: 'wl-1',
    work_location_name: 'Field - Outstation',
    expense_location_id: null,
    expense_location_name: null,
    expense_region_code: null,
    own_vehicle_used: false,
    vehicle_type_id: null,
    vehicle_type_name: null,
    outstation_state_id: null,
    outstation_city_id: null,
    from_city_id: null,
    to_city_id: null,
    outstation_state_name_snapshot: null,
    outstation_city_name_snapshot: null,
    from_city_name_snapshot: null,
    to_city_name_snapshot: null,
    km_travelled: null,
    total_amount: 200,
    status_id: 'status-1',
    status_code: 'L1_PENDING',
    status_name: 'Pending',
    status_display_color: 'amber',
    allow_resubmit_status_name: null,
    allow_resubmit_display_color: null,
    status_is_terminal: false,
    status_is_rejection: false,
    status_is_payment_issued: false,
    allow_resubmit: false,
    is_superseded: false,
    current_approval_level: 1,
    submitted_at: '2026-06-01T00:00:00+00:00',
    created_at: '2026-06-01T00:00:00+00:00',
    updated_at: '2026-06-01T00:00:00+00:00',
    resubmission_count: 0,
    last_rejection_notes: null,
    last_rejected_at: null,
    accommodation_nights: null,
    food_with_principals_amount: null,
    has_intercity_travel: false,
    has_intracity_travel: false,
    intercity_own_vehicle_used: null,
    intracity_own_vehicle_used: null,
    intracity_vehicle_mode: null,
    base_location_day_type_code: null,
    ...overrides,
  }
}

function buildSupabaseStub(pageRows: unknown[], countRows: unknown[] = []) {
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === 'get_my_claims_page') {
      return Promise.resolve({ data: pageRows, error: null })
    }
    if (name === 'get_my_claims_metrics') {
      return Promise.resolve({ data: countRows, error: null })
    }
    throw new Error(`Unexpected rpc: ${name}`)
  })
  return { rpc } as unknown as SupabaseClient
}

describe('getMyClaimsPaginated', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps a single hydrated page row into a Claim', async () => {
    const supabase = buildSupabaseStub([buildHydratedRow()])

    const result = await getMyClaimsPaginated(supabase, 'employee-1', null, 10)

    expect(result.hasNextPage).toBe(false)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('claim-1')
    expect(result.data[0].work_location).toBe('Field - Outstation')
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_my_claims_page',
      expect.objectContaining({ p_employee_id: 'employee-1' })
    )
  })

  it('slices to limit and builds the cursor from the last bounded row', async () => {
    const rows = [
      buildHydratedRow({ id: 'c1', created_at: '2026-06-02T00:00:00+00:00' }),
      buildHydratedRow({ id: 'c2', created_at: '2026-06-01T00:00:00+00:00' }),
      buildHydratedRow({ id: 'c3', created_at: '2026-05-31T00:00:00+00:00' }),
    ]
    const supabase = buildSupabaseStub(rows)

    const result = await getMyClaimsPaginated(supabase, 'employee-1', null, 2)

    expect(result.hasNextPage).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.data.map((c) => c.id)).toEqual(['c1', 'c2'])
  })
})

describe('getMyClaimsTotalCount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads total_count from get_my_claims_metrics, not a separate count RPC', async () => {
    const supabase = buildSupabaseStub([], [{ total_count: 7 }])

    const count = await getMyClaimsTotalCount(supabase, 'employee-1', {
      claimStatus: null,
      workLocation: null,
      claimDateFrom: null,
      claimDateTo: null,
    })

    expect(count).toBe(7)
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_my_claims_metrics',
      expect.objectContaining({ p_employee_id: 'employee-1' })
    )
  })
})
```

- [ ] **Step 2: Run to verify both fail**

Run: `npx vitest run src/features/claims/__tests__/claim-metrics.rpc.test.ts src/features/claims/__tests__/claims.repository.test.ts`
Expected: FAIL — `getMyClaimsStats` doesn't yet accept a `filters` param / call `get_my_claims_metrics`; `getMyClaimsPaginated`/`getMyClaimsTotalCount` still call `.from('expense_claims')` via PostgREST, not `supabase.rpc(...)`, so the mocked `rpc` function is never invoked and assertions on it fail.

- [ ] **Step 3: Add the hydrated row mapper**

In `src/features/claims/data/queries/claim-columns.ts`, add alongside the existing `mapClaimRow` (do not remove it — `getClaimById`/`getRecentClaimsForEmployee` still use the PostgREST-embed shape):

```typescript
// Maps one flat row from get_my_claims_page directly to a Claim — no
// PostgREST embed unwrapping needed, unlike mapClaimRow (used only by
// getClaimById/getRecentClaimsForEmployee, which still query via PostgREST
// embeds for their own single-claim/recent-list use cases).
export function mapHydratedClaimRow(row: Record<string, any>): Claim {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  const statusDisplay = getClaimStatusDisplay({
    statusCode: row.status_code,
    statusName: row.status_name,
    statusDisplayColor: row.status_display_color,
    allowResubmit: Boolean(row.allow_resubmit),
    allowResubmitStatusName: row.allow_resubmit_status_name,
    allowResubmitDisplayColor: row.allow_resubmit_display_color,
  })

  return {
    id: row.id,
    claim_number: row.claim_number,
    employee_id: row.employee_id,
    claim_date: row.claim_date,
    work_location: row.work_location_name ?? '',
    expense_location_id: row.expense_location_id,
    expense_location_name: row.expense_location_name,
    expense_region_code: row.expense_region_code,
    base_location_day_type_code: row.base_location_day_type_code,
    own_vehicle_used: row.own_vehicle_used,
    vehicle_type: row.vehicle_type_name,
    outstation_state_id: row.outstation_state_id,
    outstation_city_id: row.outstation_city_id,
    from_city_id: row.from_city_id,
    to_city_id: row.to_city_id,
    has_intercity_travel: row.has_intercity_travel ?? false,
    has_intracity_travel: row.has_intracity_travel ?? false,
    intercity_own_vehicle_used: row.intercity_own_vehicle_used ?? null,
    intracity_own_vehicle_used: row.intracity_own_vehicle_used ?? null,
    intracity_vehicle_mode: row.intracity_vehicle_mode,
    outstation_state_name: row.outstation_state_name_snapshot,
    outstation_city_name: row.outstation_city_name_snapshot,
    from_city_name: row.from_city_name_snapshot,
    to_city_name: row.to_city_name_snapshot,
    km_travelled: row.km_travelled,
    total_amount: row.total_amount,
    statusName: statusDisplay.label,
    statusDisplayColor: statusDisplay.colorToken,
    status_id: row.status_id,
    is_terminal: row.status_is_terminal ?? false,
    is_rejection: row.status_is_rejection ?? false,
    allow_resubmit: row.allow_resubmit ?? false,
    is_superseded: row.is_superseded ?? false,
    current_approval_level: row.current_approval_level,
    submitted_at: row.submitted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    resubmission_count: row.resubmission_count,
    last_rejection_notes: row.last_rejection_notes,
    last_rejected_at: row.last_rejected_at,
    accommodation_nights: row.accommodation_nights,
    food_with_principals_amount: row.food_with_principals_amount,
  } as Claim
}
```

- [ ] **Step 4: Rewrite `getMyClaimsPaginated` and `getMyClaimsTotalCount`**

In `src/features/claims/data/repositories/claims.repository.ts`, replace lines 104-149 (`resolveMyClaimsStatusFilter` and `applyMyClaimsFilters` — both superseded by the SQL canonical function) and lines 151-204 (`getMyClaimsPaginated`) with:

```typescript
export async function getMyClaimsPaginated(
  supabase: SupabaseClient,
  employeeId: string,
  cursor: string | null,
  limit = 10,
  filters: MyClaimsFilters = DEFAULT_MY_CLAIMS_FILTERS
): Promise<PaginatedClaims> {
  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)
  const allowResubmitFilter = await resolveClaimAllowResubmitFilterValue(
    supabase,
    parsedStatusFilter
  )
  const decoded = cursor ? decodeCursor(cursor) : null

  const { data, error } = await supabase.rpc('get_my_claims_page', {
    p_employee_id: employeeId,
    p_status_id: parsedStatusFilter?.statusId ?? null,
    p_allow_resubmit: allowResubmitFilter,
    p_work_location_id: filters.workLocation,
    p_claim_date_from: filters.claimDateFrom,
    p_claim_date_to: filters.claimDateTo,
    p_cursor_created_at: decoded?.created_at ?? null,
    p_cursor_id: decoded?.id ?? null,
    p_limit: limit,
  })

  if (error) {
    throw new Error(error.message)
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map(
    mapHydratedClaimRow
  )
  const hasNextPage = rows.length > limit
  const pageData = hasNextPage ? rows.slice(0, limit) : rows

  const lastRecord = pageData.at(-1)
  const nextCursor =
    hasNextPage && lastRecord
      ? encodeCursor({
          created_at: lastRecord.created_at,
          id: lastRecord.id,
        })
      : null

  return {
    data: pageData,
    hasNextPage,
    nextCursor,
    limit,
  }
}
```

Add the new import at the top of the file:

```typescript
import { mapHydratedClaimRow } from '@/features/claims/data/queries/claim-columns'
```

Replace `getMyClaimsTotalCount` (lines 305-326):

```typescript
export async function getMyClaimsTotalCount(
  supabase: SupabaseClient,
  employeeId: string,
  filters: MyClaimsFilters
): Promise<number> {
  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)
  const allowResubmitFilter = await resolveClaimAllowResubmitFilterValue(
    supabase,
    parsedStatusFilter
  )

  const { data, error } = await supabase.rpc('get_my_claims_metrics', {
    p_employee_id: employeeId,
    p_status_id: parsedStatusFilter?.statusId ?? null,
    p_allow_resubmit: allowResubmitFilter,
    p_work_location_id: filters.workLocation,
    p_claim_date_from: filters.claimDateFrom,
    p_claim_date_to: filters.claimDateTo,
  })

  if (error) {
    throw new Error(error.message)
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    total_count: number | string | null
  } | null

  return Number(row?.total_count ?? 0)
}
```

`ClaimsFilterQuery` type (previously used only by `applyMyClaimsFilters`) and the `CLAIM_COLUMNS`-based `.select()` call in `getMyClaimsPaginated` are no longer referenced by this file — leave the `ClaimsFilterQuery` type declaration in place only if it's used elsewhere in the file; remove it if this was its sole use (check before deleting).

- [ ] **Step 5: Add the filtered metrics RPC wrapper and update `getMyClaimsStats`**

In `src/features/claims/data/rpc/claim-metrics.rpc.ts`, add after the existing `EmployeeClaimMetricsRow` type:

```typescript
export type MyClaimsMetricsRow = {
  total_count: number | string | null
  total_amount: number | string | null
  pending_count: number | string | null
  pending_amount: number | string | null
  approved_count: number | string | null
  approved_amount: number | string | null
  rejected_count: number | string | null
  rejected_amount: number | string | null
  rejected_allow_reclaim_count: number | string | null
  rejected_allow_reclaim_amount: number | string | null
}

async function getMyClaimsFilteredMetricsRpc(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<MyClaimsMetricsRow | null> {
  const { data, error } = await supabase.rpc('get_my_claims_metrics', args)

  if (error) {
    throw new Error(error.message)
  }

  return (Array.isArray(data) ? data[0] : data) as MyClaimsMetricsRow | null
}
```

Replace `getMyClaimsStats` (the existing unfiltered version):

```typescript
// Filtered — powers the /claims page's KPI cards, which must respond to the
// active filter bar (Finding 3, 2026-07-01 audit). Distinct from
// getEmployeeClaimMetrics/getDashboardClaimStats/getProfileClaimStats, which
// intentionally stay unfiltered for the dashboard/profile use case.
export async function getMyClaimsStats(
  supabase: SupabaseClient,
  employeeId: string,
  filters: MyClaimsFilters
): Promise<MyClaimsStats> {
  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)
  const allowResubmitFilter = await resolveClaimAllowResubmitFilterValue(
    supabase,
    parsedStatusFilter
  )

  const metrics = await getMyClaimsFilteredMetricsRpc(supabase, {
    p_employee_id: employeeId,
    p_status_id: parsedStatusFilter?.statusId ?? null,
    p_allow_resubmit: allowResubmitFilter,
    p_work_location_id: filters.workLocation,
    p_claim_date_from: filters.claimDateFrom,
    p_claim_date_to: filters.claimDateTo,
  })

  return {
    total: {
      count: toNumber(metrics?.total_count),
      amount: toNumber(metrics?.total_amount),
    },
    pending: {
      count: toNumber(metrics?.pending_count),
      amount: toNumber(metrics?.pending_amount),
    },
    rejected: {
      count: toNumber(metrics?.rejected_count),
      amount: toNumber(metrics?.rejected_amount),
    },
    rejectedAllowReclaim: {
      count: toNumber(metrics?.rejected_allow_reclaim_count),
      amount: toNumber(metrics?.rejected_allow_reclaim_amount),
    },
  }
}
```

Add the necessary new import at the top of the file: `import { parseClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'` and `import { resolveClaimAllowResubmitFilterValue } from '@/features/claims/data/queries'` (adjust the exact import path to match how `resolveClaimAllowResubmitFilterValue` is exported — check `src/features/claims/data/queries/index.ts` if this errors) and `import type { MyClaimsFilters } from '@/features/claims/types'`.

`getEmployeeClaimMetrics` (the unfiltered, `p_employee_id`-only function) stays completely unchanged in this same file — it's still needed by `employee-claim-summary.query.ts`.

- [ ] **Step 6: Update the page to pass filters and remove the redundant count call**

In `src/app/(app)/claims/page.tsx`, change line 130 (`getMyClaimsStats(supabase, employee.id)` → pass filters):

```typescript
const [claims, statusCatalog, workLocations, stats] = await Promise.all([
  getMyClaimsPaginated(supabase, employee.id, cursor, 10, normalizedFilters),
  getClaimStatusCatalog(supabase),
  getAllWorkLocations(supabase),
  getMyClaimsStats(supabase, employee.id, normalizedFilters),
])
```

(Removes `getMyClaimsTotalCount` from this `Promise.all` — `stats.total.count` now carries the same, correctly-filtered total. Mirrors the Finance History fix in `docs/superpowers/plans/2026-07-02-finance-history-dropdown-and-canonical-filter-plan.md` Task 8.)

Replace line 146 (`const claimsTotalPages = getCursorTotalPages(claimsTotalCount, claims.limit)`):

```typescript
const claimsTotalCount = stats.total.count
const claimsTotalPages = getCursorTotalPages(claimsTotalCount, claims.limit)
```

Line 210 (`totalItems: claimsTotalCount`) needs no further change — same variable name, now locally derived instead of awaited.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/features/claims/__tests__/claim-metrics.rpc.test.ts src/features/claims/__tests__/claims.repository.test.ts`
Expected: PASS.

- [ ] **Step 8: Run the broader claims suite, full suite, and typecheck**

Run: `npx vitest run src/features/claims`
Run: `npx vitest run`
Run: `npx tsc --noEmit`
Expected: all clean. In particular, confirm `claims-export-context.test.ts` still passes unmodified (it mocks `getMyClaimsTotalCount` at the module boundary — its internal RPC-name change is invisible to that test, same as Finance History's export-context tests).

- [ ] **Step 9: Do not commit** — leave changes in the working tree per project convention.

---

## Task 4: Post-apply verification (after the user applies Task 1's migration)

**Files:** none — verification only, mirrors the prior two phases' final task.

- [ ] **Step 1: Confirm functions exist with correct signatures**

```sql
select proname, pronargs from pg_proc
where proname in ('my_claims_filtered','get_my_claims_page','get_my_claims_metrics');
```

Expected: three functions present, 6/9/6 args respectively. Also confirm `get_employee_claim_metrics` is unchanged (1 arg, still present) — this plan must not have touched it.

- [ ] **Step 2: `EXPLAIN (ANALYZE, BUFFERS)` for a representative employee**, since Claims' filter shape (all predicates on indexed columns, always employee_id-scoped) doesn't carry the same performance risk Approvals did — this is a lighter check than Approvals' Task 4 Step 2, not a heavy-scope stress test:

```sql
explain (analyze, buffers, format text)
select * from get_my_claims_page(
  (select id from employees limit 1), null, null, null, null, null, null, null, 10
);
```

Expected: index scan on `idx_expense_claims_employee_id`, not a sequential scan.

- [ ] **Step 3: Run the pgTAP test from Task 2 against dev** via the rolled-back-transaction technique (insert fixture, run the three assertions as plain `SELECT` comparisons, wrap in `BEGIN; ... ROLLBACK;`), confirm all three pass, confirm the rollback leaves zero rows.

- [ ] **Step 4: `generate_typescript_types` check (INV-6)** — confirm `my_claims_filtered`, `get_my_claims_page`, `get_my_claims_metrics` all produce fully field-typed `Returns` shapes, and confirm `get_employee_claim_metrics` is still present and unchanged in the generated types (proof this plan didn't touch it).

---

## Self-Review Notes

**Spec coverage:** Finding 3 ✓ (Task 1 canonical function + filtered metrics; Task 2 pgTAP pins it; Task 3 wires the page to pass filters). INV-1 ✓ (Task 2 assertion 3; Task 3 Step 6 makes the pagination total literally `stats.total.count`). INV-2 — `getMyClaimsTotalCount`'s exported signature is unchanged, so `claims-export-context.ts` needs no changes and automatically inherits the fix. INV-6 ✓ (Task 4 Step 4).

**Deliberately not touched:** `get_employee_claim_metrics`, `getDashboardClaimStats`, `getProfileClaimStats`, `getRecentClaimsForEmployee`, `getClaimById`, `mapClaimRow`/`CLAIM_COLUMNS` — all serve a different, correctly-unfiltered or single-record use case outside Finding 3's scope. Flagged explicitly so a future reader doesn't assume this plan missed them.

**Remaining:** Phase 4 (Finance Queue — no bug, applied for consistency only) is the last phase in the design doc's phasing.
