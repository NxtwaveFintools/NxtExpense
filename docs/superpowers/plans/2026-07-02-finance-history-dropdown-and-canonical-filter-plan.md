# Finance Action Dropdown (Finding 2) + Finance History Canonical Filter (Finding 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Finding 2 (Finance Action dropdown flickers because it samples the 200 most-recent `finance_actions` rows) and Finding 1 (the Approved History pagination footer ignores the action filter, showing a wildly inflated total) by (a) sourcing the dropdown from the existing `finance_action_buckets()` authoritative function instead of transactional sampling, and (b) extracting a single canonical `finance_history_filtered()` SQL function that `get_finance_history_page` and `get_finance_history_metrics` both read from, eliminating the independent (and independently-buggy) `get_finance_history_count` RPC entirely.

**Architecture:** Per `docs/superpowers/specs/2026-07-02-filter-count-metrics-consistency-design.md` — one canonical filtered-dataset function per page, two thin RPCs (page, metrics) reading from it, `total_count` sourced exclusively from the metrics RPC. This plan also collapses a second, previously-undocumented duplication discovered while researching this phase: `get_finance_history_page` today receives pre-resolved `p_feed_action_codes`/`p_feed_from`/`p_feed_to` computed in TypeScript (`buildFinanceHistoryFeedScope()` → `getFinanceActionCodesForFilter()`/`getFinanceActionCodesForDateFilter()`), while `get_finance_history_metrics` independently re-resolves the same action/date scoping from raw `p_action_filter`/`p_date_field` inside its own SQL (`action_scope`/`date_scoped` CTEs). The canonical function adopts the SQL-side resolution (already correct, already the pattern used everywhere else in this design) for both, so TypeScript no longer needs to pre-resolve feed action codes for the page/metrics/count path at all.

**Tech Stack:** Next.js (App Router), Supabase Postgres (`language sql stable` functions), Vitest (TS unit tests, mocked Supabase client), pgTAP (SQL regression tests, `begin;...rollback;`), Supabase CLI (`supabase test db`).

**Scope boundary:** This plan does NOT touch `get_finance_payment_journal_totals` / `getFinancePaymentJournalTotals()` / `buildFinanceHistoryFeedScope()` — that RPC has its own independent contract (`p_feed_action_codes`/`p_feed_from`/`p_feed_to` as direct params) and stays exactly as-is; `buildFinanceHistoryFeedScope()` remains in the codebase solely to serve that one caller. This plan also does NOT touch Approvals, Claims, or Finance Queue — those get their own plan documents per the design doc's phasing.

---

## File Structure

| File                                                                                         | Responsibility                                                                                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/finance/data/repositories/finance-filter-options.repository.ts`                | **Modify** — `getFinanceFilterOptions()` sources action options from `finance_action_buckets()`, not `finance_actions` sampling |
| `src/features/finance/data/repositories/__tests__/finance-filter-options.repository.test.ts` | **Create** — first test file for this repository                                                                                |
| `supabase/migrations/20260702100000_finance_history_filtered.sql`                            | **Create** — canonical `finance_history_filtered()` function                                                                    |
| `supabase/migrations/20260702101000_rewrite_get_finance_history_page.sql`                    | **Create** — simplified `get_finance_history_page()` sourcing from the canonical function                                       |
| `supabase/migrations/20260702102000_rewrite_get_finance_history_metrics.sql`                 | **Create** — `get_finance_history_metrics()` sourcing from the canonical function                                               |
| `supabase/migrations/20260702103000_drop_get_finance_history_count.sql`                      | **Create** — drops the buggy, now-unused `get_finance_history_count`                                                            |
| `supabase/tests/010_finance_history_filtered_parity.sql`                                     | **Create** — pgTAP regression test pinning Finding 1                                                                            |
| `src/features/finance/data/repositories/finance-history.repository.ts`                       | **Modify** — `fetchHydratedFinanceHistoryPage()` (:293-345), `getFinanceHistoryTotalCount()` (:410-424)                         |
| `src/features/finance/data/repositories/__tests__/finance-history.repository.test.ts`        | **Modify** — update RPC-arg expectations, remove the now-obsolete short-circuit test                                            |
| `src/app/(app)/approved-history/page.tsx`                                                    | **Modify** — remove the redundant `getFinanceHistoryTotalCount` call, source total from `analytics.total.count`                 |
| `package.json`                                                                               | **Modify** — add `test:db` script                                                                                               |

---

## Task 1: Finance Action dropdown sources from `finance_action_buckets()`

**Files:**

- Modify: `src/features/finance/data/repositories/finance-filter-options.repository.ts:34-149`
- Test: `src/features/finance/data/repositories/__tests__/finance-filter-options.repository.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `src/features/finance/data/repositories/__tests__/finance-filter-options.repository.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAllDesignations: vi.fn(),
  getAllWorkLocations: vi.fn(),
}))

vi.mock('@/lib/services/config-service', () => ({
  getAllDesignations: mocks.getAllDesignations,
  getAllWorkLocations: mocks.getAllWorkLocations,
}))

import { getFinanceFilterOptions } from '@/features/finance/data/repositories/finance-filter-options.repository'

function buildSupabaseStub(options: {
  financeReviewStatusId?: string | null
  actionBuckets?: Array<{ action: string; is_rejected: boolean }>
  claimStatuses?: unknown[]
  workLocations?: unknown[]
  hodRows?: Array<{ approver_employee_id: string | null }>
}) {
  const from = vi.fn((table: string) => {
    if (table === 'claim_statuses') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: options.claimStatuses ?? [],
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.financeReviewStatusId
            ? { id: options.financeReviewStatusId }
            : null,
          error: null,
        }),
      }
    }
    if (table === 'employees') {
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  const rpc = vi.fn((name: string) => {
    if (name === 'finance_action_buckets') {
      return Promise.resolve({
        data: options.actionBuckets ?? [],
        error: null,
      })
    }
    if (name === 'get_hod_approver_employee_ids') {
      return Promise.resolve({ data: options.hodRows ?? [], error: null })
    }
    throw new Error(`Unexpected rpc: ${name}`)
  })

  return {
    from,
    rpc,
  } as unknown as import('@supabase/supabase-js').SupabaseClient
}

describe('getFinanceFilterOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAllDesignations.mockResolvedValue([])
    mocks.getAllWorkLocations.mockResolvedValue([])
  })

  it('sources finance action options from finance_action_buckets(), not a recency-limited finance_actions sample', async () => {
    const supabase = buildSupabaseStub({
      actionBuckets: [
        { action: 'finance_approved', is_rejected: false },
        { action: 'payment_released', is_rejected: false },
        { action: 'finance_rejected', is_rejected: true },
      ],
    })

    const result = await getFinanceFilterOptions(supabase)

    // Every distinct action from finance_action_buckets() must be offered,
    // even one that would have been evicted from the old top-200-by-recency sample.
    const values = result.financeActions.map((option) => option.value)
    expect(values).toContain('finance_approved')
    expect(values).toContain('payment_released')
    expect(values).toContain('finance_rejected')

    // The old implementation queried `finance_actions` directly via `.from()`.
    // Assert it no longer does.
    expect(supabase.from).not.toHaveBeenCalledWith('finance_actions')
  })

  it('offers "Rejected & Allow Reclaim" whenever finance_action_buckets() reports any is_rejected action, regardless of recent transaction volume', async () => {
    const supabase = buildSupabaseStub({
      actionBuckets: [{ action: 'finance_rejected', is_rejected: true }],
    })

    const result = await getFinanceFilterOptions(supabase)

    expect(
      result.financeActions.some(
        (option) => option.value === 'rejected_allow_reclaim'
      )
    ).toBe(true)
  })

  it('omits "Rejected & Allow Reclaim" when finance_action_buckets() reports no rejected action', async () => {
    const supabase = buildSupabaseStub({
      actionBuckets: [{ action: 'payment_released', is_rejected: false }],
    })

    const result = await getFinanceFilterOptions(supabase)

    expect(
      result.financeActions.some(
        (option) => option.value === 'rejected_allow_reclaim'
      )
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/finance/data/repositories/__tests__/finance-filter-options.repository.test.ts`
Expected: FAIL — `supabase.from` is called with `'finance_actions'` (current implementation), and/or `finance_action_buckets` rpc is never called.

- [ ] **Step 3: Implement the fix**

In `src/features/finance/data/repositories/finance-filter-options.repository.ts`, replace the `finance_actions` query and its consumption:

Replace lines 46-62 (the `Promise.all` block) with:

```typescript
const [designations, workLocationRows, statusResult, actionBucketsResult] =
  await Promise.all([
    getAllDesignations(supabase),
    getAllWorkLocations(supabase),
    supabase
      .from('claim_statuses')
      .select(
        'id, status_code, status_name, display_order, allow_resubmit_status_name'
      )
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase.rpc('finance_action_buckets'),
  ])
```

Replace lines 68-70 (the `financeActionResult.error` check) with:

```typescript
if (actionBucketsResult.error) {
  throw new Error(actionBucketsResult.error.message)
}
```

Replace lines 131-149 (the `financeActionCodes`/`financeActions`/`hasRejectFinanceActionCode` block) with:

```typescript
type ActionBucketRow = { action: string; is_rejected: boolean }
const actionBuckets = (actionBucketsResult.data ?? []) as ActionBucketRow[]

const financeActions: FinanceFilterOption[] = actionBuckets.map((bucket) => ({
  value: bucket.action,
  label: formatFinanceActionLabel(bucket.action),
}))

if (actionBuckets.some((bucket) => bucket.is_rejected)) {
  financeActions.push({
    value: REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE,
    label: REJECTED_ALLOW_RECLAIM_ACTION_FILTER_LABEL,
  })
}
```

Remove the now-unused `hasRejectFinanceActionCode` import (line 8) since it's no longer called from this file. Check `src/features/finance/utils/action-filter.ts` for other callers before deleting the export itself — leave the export in place if anything else still imports it (grep confirmed no other TS callers as of this session, but re-check at implementation time since the branch may have moved).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/finance/data/repositories/__tests__/finance-filter-options.repository.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full finance test suite to check for regressions**

Run: `npx vitest run src/features/finance`
Expected: PASS — no other test in this directory references `finance-filter-options.repository.ts`'s old `finance_actions` query shape (confirmed via grep during planning), so no other failures expected.

- [ ] **Step 6: Commit**

```bash
git add src/features/finance/data/repositories/finance-filter-options.repository.ts src/features/finance/data/repositories/__tests__/finance-filter-options.repository.test.ts
git commit -m "fix(finance): source action dropdown from finance_action_buckets(), not recency-limited sample

Finding 2 from the 2026-07-01 filter/display consistency audit: the dropdown
sampled the 200 most-recent finance_actions rows, so low-volume action types
(e.g. finance_rejected) could silently vanish depending on recent activity
mix. finance_action_buckets() is the existing authoritative source (derived
from claim_status_transitions/claim_statuses, not transactional history)."
```

---

## Task 2: Create the canonical `finance_history_filtered()` function

**Files:**

- Create: `supabase/migrations/20260702100000_finance_history_filtered.sql`

- [ ] **Step 1: Write the migration**

This ports the `scoped_actions` CTE chain that already exists (and is already correct) inside `get_finance_history_metrics` (`supabase/migrations/20260630090000_fix_finance_history_metrics_p_has_filters.sql:49-117`) into a standalone, reusable function — extended with the `id`/`notes`/`actor_employee_id` columns the page RPC needs for hydration (metrics doesn't select them, but returning them doesn't change metrics' behavior).

```sql
-- Canonical filtered dataset for the Approved History feed. The ONLY place
-- claim-level filters (via finance_filtered_claim_ids), action-classification
-- (via finance_action_buckets), and action/date-filter resolution are applied
-- for this page. get_finance_history_page and get_finance_history_metrics both
-- read from this function; neither reimplements any of this logic independently.
--
-- This also collapses a duplication that predates this migration: action/date
-- resolution previously happened twice — once in TypeScript
-- (buildFinanceHistoryFeedScope -> getFinanceActionCodesForFilter /
-- getFinanceActionCodesForDateFilter, feeding get_finance_history_page's
-- p_feed_action_codes/p_feed_from/p_feed_to) and independently in SQL (this
-- function's action_scope/date_scoped CTEs, which get_finance_history_metrics
-- already used). This function adopts the SQL-side resolution for both
-- consumers; see the accompanying page-RPC migration for the TypeScript-side
-- simplification this enables.
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
  -- action classification (single source of truth)
  b as (select * from public.finance_action_buckets()),
  -- claim scope: resolver when filters active, all finance-action claims otherwise.
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
  -- Action-date scoping (payment_released_date / finance_approved_date): applies
  -- ONLY when the date field is an action-date field AND a bound is present.
  date_scoped as (
    select action from b
    where (p_date_from is not null or p_date_to is not null)
      and (
        (p_date_field = 'payment_released_date' and is_payment_released)
        or (p_date_field = 'finance_approved_date' and is_finance_approved)
      )
  ),
  -- Action-filter scoping (used only when not action-date scoped).
  -- 'rejected_allow_reclaim' expands to the rejected bucket (the resolver
  -- already narrows the claims to allow_resubmit = true); any other value is
  -- a literal action code.
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
    -- acted_at bounds apply only for action-date fields.
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

-- Not granted to anon/authenticated: internal helper, called only by
-- get_finance_history_page and get_finance_history_metrics (SECURITY INVOKER,
-- so it runs under the caller's own RLS regardless of grants on this function).
```

- [ ] **Step 2: Apply and sanity-check locally** (do not apply to the shared dev project directly — this repo's convention is migration files reviewed by the user before being applied; see project memory)

Run: `supabase db reset` (applies all migrations to the local Supabase stack) or, if using a local Supabase instance already running, `supabase migration up`.
Expected: migration applies with no errors.

- [ ] **Step 3: Manual smoke check against local DB**

Run: `psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -c "select count(*) from finance_history_filtered(false, null,null,null,null,null,null,null,null,'claim_date',null,null);"`
Expected: returns a single row with a count matching `select count(*) from finance_actions;` (no-filter path should include every finance action).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260702100000_finance_history_filtered.sql
git commit -m "feat(finance): add canonical finance_history_filtered() function

Single source of truth for claim-scope, action-classification, and
action/date-filter resolution for the Approved History feed. Extracted from
get_finance_history_metrics's existing scoped_actions CTE chain (already
correct); get_finance_history_page and get_finance_history_metrics are
rewired to read from this function in the following two commits."
```

---

## Task 3: Rewrite `get_finance_history_page` to source from the canonical function

**Files:**

- Create: `supabase/migrations/20260702101000_rewrite_get_finance_history_page.sql`

- [ ] **Step 1: Write the migration**

Signature change: drops `p_feed_action_codes text[]`, `p_feed_from timestamptz`, `p_feed_to timestamptz` (no longer needed — `finance_history_filtered()` resolves action/date scoping internally from `p_action_filter`/`p_date_field`/`p_date_from`/`p_date_to`, which are already present). The hydration join tail (lines 169-240 of the prior migration) is unchanged verbatim — same join-type audit, same columns, same keyset ordering guarantees.

```sql
-- Simplify get_finance_history_page to source its filtered/scoped row set from
-- finance_history_filtered() instead of duplicating claim-scope and
-- action/date-scope resolution inline. Drops p_feed_action_codes/p_feed_from/
-- p_feed_to: those existed only to carry TypeScript's independent resolution
-- of the same action/date scoping finance_history_filtered() now does in SQL.
-- Hydration join tail is byte-for-byte unchanged from the prior migration.

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
    -- DETERMINISTIC keyset order: id is the REQUIRED secondary sort key — never remove it.
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
```

- [ ] **Step 2: Apply locally and smoke-check**

Run: `supabase db reset` (or `supabase migration up`)
Run: `psql "$DB_URL" -c "select claim_number, action_type from get_finance_history_page(false,null,null,null,null,null,null,null,null,'claim_date',null,null,null,null,5);"`
Expected: 5 rows (or fewer if `finance_actions` has fewer than 5 rows), no errors, columns populated.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260702101000_rewrite_get_finance_history_page.sql
git commit -m "refactor(finance): get_finance_history_page reads from finance_history_filtered()

Drops p_feed_action_codes/p_feed_from/p_feed_to — action/date scoping now
resolved once, in finance_history_filtered(), instead of being pre-computed
in TypeScript and passed through. Hydration join tail unchanged."
```

---

## Task 4: Rewrite `get_finance_history_metrics` to source from the canonical function

**Files:**

- Create: `supabase/migrations/20260702102000_rewrite_get_finance_history_metrics.sql`

- [ ] **Step 1: Write the migration**

Same signature as today (already takes raw filter params — no TS call-site change needed for this RPC's arguments), same output columns, body now reads from `finance_history_filtered()` instead of duplicating the `filtered`/`date_scoped`/`action_scope` CTEs inline.

```sql
-- get_finance_history_metrics reads from finance_history_filtered() instead of
-- duplicating claim-scope/action-scope resolution inline. Signature and output
-- columns unchanged — this is a body-only change.

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
```

- [ ] **Step 2: Apply locally and smoke-check**

Run: `supabase db reset` (or `supabase migration up`)
Run: `psql "$DB_URL" -c "select total_count, approved_count, rejected_count from get_finance_history_metrics();"`
Expected: one row, `total_count` matches `select count(*) from finance_actions;`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260702102000_rewrite_get_finance_history_metrics.sql
git commit -m "refactor(finance): get_finance_history_metrics reads from finance_history_filtered()

Body-only change — signature and output columns unchanged. Removes the
independent inline duplication of claim-scope/action-scope resolution that
get_finance_history_page's old body also duplicated separately."
```

---

## Task 5: pgTAP regression test pinning Finding 1

**Files:**

- Create: `supabase/tests/010_finance_history_filtered_parity.sql`

**Finding 1 recap:** the old `get_finance_history_count` ignored `p_action_filter` and counted every finance action of every matched claim, not just the actions matching the requested filter. This test seeds a claim with multiple differently-typed finance actions and asserts a filtered metrics call returns only the count of the matching action type — the exact scenario the audit's live evidence showed failing (`payment_released_date` filter: 154 correct vs. 940 from the old buggy count).

- [ ] **Step 1: Discover the exact NOT NULL / FK columns needed for fixture inserts**

Before writing INSERT statements, confirm current constraints (schema may have drifted since this plan was written):

Run: `psql "$DB_URL" -c "\d expense_claims" | grep -i "not null"`
Run: `psql "$DB_URL" -c "\d employees" | grep -i "not null"`

Use the output to fill in any NOT NULL columns not already covered in the template below (adjust the INSERT statements in Step 2 accordingly — this is expected to require minor adjustment, not a sign the plan is wrong).

- [ ] **Step 2: Write the pgTAP test**

```sql
-- Regression test for Finding 1 (2026-07-01 filter/display consistency audit):
-- get_finance_history_count used to ignore p_action_filter entirely, counting
-- ALL finance_actions of matched claims instead of only the filtered action
-- type. get_finance_history_count no longer exists; this test pins the
-- replacement (get_finance_history_metrics, sourced from
-- finance_history_filtered()) to the correct behavior so this bug class
-- cannot silently reappear.
begin;
set local search_path = public, extensions;

select plan(3);

-- Fixture: one work location, one designation, one status, one employee, one
-- claim with TWO finance actions of different types (finance_approved and
-- payment_released) plus a second unrelated claim/action pair that must NOT
-- be counted when filtering to 'finance_approved'.
insert into work_locations (id, location_code, location_name, is_active)
values ('11111111-1111-1111-1111-111111111111', 'PGTAP_WL', 'PGTAP Test Location', true);

insert into designations (id, designation_code, designation_name, designation_abbreviation, is_active, hierarchy_level)
values ('22222222-2222-2222-2222-222222222222', 'PGTAP_DESIG', 'PGTAP Test Designation', 'PTD', true, 1);

select id as v_status_finance_approved from claim_statuses
where is_approval and not is_rejection and not is_terminal
  and not is_payment_issued and approval_level is null and is_active
limit 1 \gset

insert into employees (id, employee_id, employee_name, employee_email, designation_id, employee_status_id)
select '33333333-3333-3333-3333-333333333333', 'PGTAP0001', 'PGTAP Test Employee', 'pgtap-test@nxtwave.co.in',
       '22222222-2222-2222-2222-222222222222', id
from employee_statuses where is_active limit 1;

insert into expense_claims (id, employee_id, claim_number, claim_date, work_location_id, designation_id, status_id, total_amount, submitted_at)
values (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  'PGTAP-CLAIM-0001',
  current_date,
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  :'v_status_finance_approved',
  500.00,
  now()
);

insert into finance_actions (id, claim_id, action, acted_at, actor_employee_id)
values
  ('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444444', 'finance_approved', now() - interval '2 hours', '33333333-3333-3333-3333-333333333333'),
  ('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444444', 'payment_released', now() - interval '1 hour', '33333333-3333-3333-3333-333333333333');

-- Assertion 1: filtering to 'finance_approved' returns exactly ONE matching
-- action for this claim, not both of its actions (the exact Finding-1 bug).
select is(
  (select total_count from get_finance_history_metrics(
    true, null, null, null, null, null, null,
    '11111111-1111-1111-1111-111111111111', 'finance_approved', 'claim_date', null, null
  )),
  1,
  'metrics.total_count for action_filter=finance_approved counts only matching actions, not every action of the matched claim'
);

-- Assertion 2: filtering to 'payment_released' on the SAME claim also returns
-- exactly one — proves the two action types are distinguished, not summed.
select is(
  (select total_count from get_finance_history_metrics(
    true, null, null, null, null, null, null,
    '11111111-1111-1111-1111-111111111111', 'payment_released', 'claim_date', null, null
  )),
  1,
  'metrics.total_count for action_filter=payment_released counts only matching actions'
);

-- Assertion 3: get_finance_history_page's row count for the same filter
-- matches metrics.total_count exactly (INV-1) — structurally guaranteed since
-- both read finance_history_filtered(), but asserted directly as a regression
-- pin, not just trusted from the architecture.
select is(
  (select count(*)::int from get_finance_history_page(
    true, null, null, null, null, null, null,
    '11111111-1111-1111-1111-111111111111', 'finance_approved', 'claim_date', null, null,
    null, null, 10
  )),
  (select total_count from get_finance_history_metrics(
    true, null, null, null, null, null, null,
    '11111111-1111-1111-1111-111111111111', 'finance_approved', 'claim_date', null, null
  )),
  'page row count and metrics total_count agree for an identical filter'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Add the `test:db` npm script**

In `package.json`, add to the `scripts` block (near the existing `test`/`test:coverage` entries):

```json
    "test:db": "supabase test db",
```

- [ ] **Step 4: Run the pgTAP test and verify it passes**

Run: `npm run test:db`
Expected: `supabase/tests/010_finance_history_filtered_parity.sql` reports `1..3` and all 3 assertions `ok`. If any INSERT fails on a NOT NULL constraint, adjust the fixture using the schema discovered in Step 1 and re-run.

- [ ] **Step 5: Verify the test actually pins the bug — temporarily revert and confirm failure**

Run: `git stash` (stashes Tasks 2-4's migrations, leaving only the old `get_finance_history_count`-based schema) — **do not do this against the dev/shared database, only against your local Supabase stack** — then `supabase db reset && npm run test:db`.
Expected: the test either errors (functions don't exist with the new signature) or, if you temporarily point assertion 1 at the OLD `get_finance_history_count` RPC instead, fails with total_count=2 instead of 1 (reproducing Finding 1 exactly). Restore with `git stash pop`, then `supabase db reset` again to reapply Tasks 2-4.

- [ ] **Step 6: Commit**

```bash
git add supabase/tests/010_finance_history_filtered_parity.sql package.json
git commit -m "test(finance): pgTAP regression test pinning Finding 1

Seeds a claim with two differently-typed finance actions and asserts a
filtered metrics call counts only the matching action type, not every action
of the matched claim (the exact bug get_finance_history_count had). Also
asserts page/metrics total agreement directly, not just by trusting the
architecture."
```

---

## Task 6: Simplify the TypeScript repository layer

**Files:**

- Modify: `src/features/finance/data/repositories/finance-history.repository.ts:232-345,410-424`
- Modify: `src/features/finance/data/repositories/__tests__/finance-history.repository.test.ts`

- [ ] **Step 1: Update the failing/changed tests first**

In `src/features/finance/data/repositories/__tests__/finance-history.repository.test.ts`:

Remove the test `'short-circuits with zero DB calls when an action-date filter resolves to zero action codes'` (lines 249-269) — this behavior no longer exists. Action/date resolution now happens inside `finance_history_filtered()` in SQL; when a date-based action filter matches no classified action bucket, the RPC call still happens but correctly returns zero rows. The TypeScript-level short-circuit was an optimization for a degenerate config state (zero `claim_statuses` rows matching a classification), not a normal empty-result case, and removing it does not change correctness.

Update `buildSupabaseStub` (lines 110-118) — the mock doesn't need changes (it already only asserts on RPC name, not args), but add an explicit args-shape assertion to the first test in `getFinanceHistoryPaginated` to lock in the new, simplified call contract. Add this near the top of the `'maps a single page...'` test (after line 210's existing assertions):

```typescript
expect(mocks.getClaimAvailableActionsByClaimIds).toHaveBeenCalledWith(
  supabase,
  ['claim-1']
)
const rpcArgs = (supabase.rpc as ReturnType<typeof vi.fn>).mock
  .calls[0][1] as Record<string, unknown>
expect(rpcArgs).not.toHaveProperty('p_feed_action_codes')
expect(rpcArgs).not.toHaveProperty('p_feed_from')
expect(rpcArgs).not.toHaveProperty('p_feed_to')
expect(rpcArgs).toHaveProperty('p_action_filter')
expect(rpcArgs).toHaveProperty('p_date_field')
```

- [ ] **Step 2: Run tests to verify the new assertion fails against current code**

Run: `npx vitest run src/features/finance/data/repositories/__tests__/finance-history.repository.test.ts`
Expected: FAIL — current `fetchHydratedFinanceHistoryPage` still sends `p_feed_action_codes`/`p_feed_from`/`p_feed_to` and does not send `p_action_filter`/`p_date_field` directly (they're embedded inside `resolverArgs` today too, so double check — if this assertion unexpectedly passes already, inspect `buildHistoryResolverArgs` output to confirm `p_action_filter`/`p_date_field` are already present, and adjust to assert on the correct missing property instead, e.g. `p_feed_action_codes`).

- [ ] **Step 3: Simplify `fetchHydratedFinanceHistoryPage`**

In `src/features/finance/data/repositories/finance-history.repository.ts`, replace lines 293-345:

```typescript
async function fetchHydratedFinanceHistoryPage(
  supabase: SupabaseClient,
  cursor: string | null,
  limit: number,
  filters: FinanceFilters
): Promise<HydratedHistoryPage> {
  // SQL keyset ID-page + enrichment JOIN in one RPC call. finance_history_filtered()
  // resolves claim-scope and action/date-filter scoping internally — no
  // TypeScript-side pre-resolution needed (see
  // docs/superpowers/plans/2026-07-02-finance-history-dropdown-and-canonical-filter-plan.md).
  const decoded = cursor ? decodeCursor(cursor) : null
  const { data: pageRows, error: pageError } = await supabase.rpc(
    'get_finance_history_page',
    {
      p_has_filters: hasFinanceClaimFilters(filters),
      ...buildHistoryResolverArgs(filters),
      // The existing cursor encodes acted_at under the created_at key.
      p_cursor_acted_at: decoded?.created_at ?? null,
      p_cursor_id: decoded?.id ?? null,
      p_limit: limit,
    }
  )

  if (pageError) {
    throw new Error(pageError.message)
  }

  const idRows = (pageRows ?? []) as HydratedHistoryPageRow[]
  const hasNextPage = idRows.length > limit
  const pageRowsBounded = hasNextPage ? idRows.slice(0, limit) : idRows

  if (pageRowsBounded.length === 0) {
    return { rows: [], hasNextPage: false, nextCursor: null }
  }

  const rows = pageRowsBounded.map((row) => mapHydratedHistoryRow(row))
  const lastRecord = pageRowsBounded.at(-1)
  const nextCursor =
    hasNextPage && lastRecord
      ? encodeCursor({ created_at: lastRecord.acted_at, id: lastRecord.id })
      : null

  return { rows, hasNextPage, nextCursor }
}
```

This removes the `buildFinanceHistoryFeedScope(supabase, filters)` call and the `scope.isEmpty` early return. `buildFinanceHistoryFeedScope` itself stays in the file (still used by `getFinancePaymentJournalTotals`, unchanged) — only this one call site changes.

- [ ] **Step 4: Update `getFinanceHistoryTotalCount` to read from metrics**

Replace lines 410-424:

```typescript
export async function getFinanceHistoryTotalCount(
  supabase: SupabaseClient,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<number> {
  const { data, error } = await supabase.rpc('get_finance_history_metrics', {
    p_has_filters: hasFinanceClaimFilters(filters),
    ...buildHistoryResolverArgs(filters),
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

This function's exported signature (`Promise<number>`, same params) is unchanged — `finance-history-export-context.ts` and `bc-expense-export-context.ts` need no changes at all. It now computes the total via the same RPC `getFinanceHistoryAnalytics` already calls elsewhere, satisfying INV-2 (export count == the same canonical total).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/finance/data/repositories/__tests__/finance-history.repository.test.ts`
Expected: PASS — all tests including the new args-shape assertion.

- [ ] **Step 6: Run the broader finance test suite**

Run: `npx vitest run src/features/finance`
Expected: PASS. In particular, confirm `finance-history-export-context.test.ts` and `bc-expense-export-context.test.ts` still pass unmodified (they mock `getFinanceHistoryTotalCount` at the module boundary, so its internal RPC-name change is invisible to them).

- [ ] **Step 7: Commit**

```bash
git add src/features/finance/data/repositories/finance-history.repository.ts src/features/finance/data/repositories/__tests__/finance-history.repository.test.ts
git commit -m "refactor(finance): simplify page fetch and total-count to match the canonical filter RPCs

fetchHydratedFinanceHistoryPage no longer pre-resolves feed action codes in
TypeScript (finance_history_filtered() does this in SQL now).
getFinanceHistoryTotalCount now reads total_count from
get_finance_history_metrics instead of the now-deleted get_finance_history_count.
Both functions keep their existing exported signatures — no call-site changes
needed outside this file."
```

---

## Task 7: Drop the now-unused `get_finance_history_count`

**Files:**

- Create: `supabase/migrations/20260702103000_drop_get_finance_history_count.sql`

- [ ] **Step 1: Confirm no remaining callers**

Run: `grep -rn "get_finance_history_count" src/ supabase/`
Expected: only this new migration and historical migration files reference it — Task 6 already removed the last live TS call site.

- [ ] **Step 2: Write the migration**

```sql
-- Finding 1's buggy RPC. get_finance_history_page and get_finance_history_metrics
-- both now read from finance_history_filtered(); total_count comes from
-- get_finance_history_metrics (see finance-history.repository.ts
-- getFinanceHistoryTotalCount, updated in Task 6).
drop function if exists public.get_finance_history_count(
  boolean, text, text, text, uuid, uuid, text, uuid, text, text, timestamptz, timestamptz
);
```

- [ ] **Step 3: Apply locally**

Run: `supabase db reset` (or `supabase migration up`)
Expected: no errors. Re-run `npm run test:db` to confirm Task 5's pgTAP test still passes (it never called this function, so it should be unaffected).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260702103000_drop_get_finance_history_count.sql
git commit -m "chore(finance): drop get_finance_history_count

Finding 1's buggy RPC (ignored p_action_filter, counted all actions of
matched claims). No longer called — total_count now comes from
get_finance_history_metrics."
```

---

## Task 8: Remove the redundant total-count call from the page

**Files:**

- Modify: `src/app/(app)/approved-history/page.tsx:19,148-154,166-169,272`

- [ ] **Step 1: Make the change**

`getFinanceHistoryAnalytics` (already called in the same `Promise.all`) computes `analytics.total.count`, which — after Task 4 — is the exact same number `getFinanceHistoryTotalCount` computes (both read `get_finance_history_metrics().total_count`). Calling both is now a redundant second RPC invocation of the same query. Remove the redundant one.

In `src/app/(app)/approved-history/page.tsx`, remove `getFinanceHistoryTotalCount` from the import on line 19:

```typescript
import { getFinanceFilterOptions } from '@/features/finance/data/queries'
```

Replace the `Promise.all` block (lines 148-154):

```typescript
const [history, filterOptions, analytics] = await Promise.all([
  getFinanceHistoryAction(historyCursor, pageSize, normalizedFilterParams),
  getFinanceFilterOptions(supabase),
  getFinanceHistoryAnalytics(supabase, effectiveFilters),
])
```

Replace line 166-169 (`historyTotalPages`) to use `analytics.total.count` instead of the removed `historyTotalCount`:

```typescript
const historyTotalCount = analytics.total.count
const historyTotalPages = getCursorTotalPages(historyTotalCount, history.limit)
```

Line 272 (`totalItems: historyTotalCount`) needs no change — `historyTotalCount` is now a local `const` derived from `analytics.total.count` instead of an awaited RPC result, same name, same usage.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `analytics.total.count` isn't already typed as `number` on `FinanceHistoryAnalytics`, this will surface a type error — it already is (confirmed in `history-analytics.query.ts:19`, `total: ClaimMetricSummary` where `ClaimMetricSummary.count: number`).

- [ ] **Step 3: Run the page's existing tests, if any, plus a manual check**

Run: `npx vitest run src/app/\(app\)/approved-history`
Expected: PASS (or no test files found — this page currently has no dedicated unit test per the file structure seen during planning; if e2e coverage exists, note it for the manual verification step below instead).

Run: `npm run dev`, navigate to `/approved-history`, apply the `Finance Action: Finance Approved` filter, and confirm:

1. The "Total History Records" card and the "Approved History" card show sane, non-zero-unless-actually-zero numbers.
2. The pagination footer's "N total records" now matches the "Approved History" card's count when that filter is applied (this is the exact symptom from Finding 1 — verify it's fixed, not just that the code compiles).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/approved-history/page.tsx"
git commit -m "fix(finance): approved-history page sources pagination total from analytics, not a second RPC call

getFinanceHistoryTotalCount and getFinanceHistoryAnalytics both read
get_finance_history_metrics as of the prior commits in this series — calling
both computed the same number twice per page load. This also completes
Finding 1's fix end-to-end: the pagination footer's total now structurally
cannot disagree with the KPI cards, since it's the same number."
```

---

## Task 9: Implementation-checklist verification (per the design doc)

**Files:** none — verification only.

- [ ] **Step 1: `EXPLAIN (ANALYZE, BUFFERS)` against realistically-filtered queries**

Run against the dev DB (read-only query, no schema changes — do not apply migrations to the shared dev project as part of this step):

```sql
explain (analyze, buffers, format text)
select * from get_finance_history_page(
  true, null, 'some real employee name substring', null, null, null, null, null,
  'finance_approved', 'claim_date', null, null, null, null, 20
);

explain (analyze, buffers, format text)
select * from get_finance_history_metrics(
  true, null, 'some real employee name substring', null, null, null, null, null,
  'finance_approved', 'claim_date', null, null
);
```

Expected: index scans on `finance_actions`/`expense_claims` (via `idx_finance_actions_acted_at_id`, `idx_expense_claims_employee_id` or similar), not sequential scans on the full tables, given a selective employee-name filter. Document the actual plan output in the PR description if it diverges from this expectation — do not silently accept a seq scan without investigating.

- [ ] **Step 2: `generate_typescript_types` regression check (INV-6)**

Run: `npx supabase gen types typescript --project-id <dev-project-ref> > /tmp/check-types.ts` (or use the equivalent MCP tool if working interactively)
Run: `grep -A3 "finance_history_filtered\|get_finance_history_page\|get_finance_history_metrics" /tmp/check-types.ts`
Expected: every one of these three functions has a fully field-typed `Returns` shape — no `Record<string, unknown>` or bare `Json`. If any do, an `OUT` parameter or unsupported construct was accidentally introduced — fix before merging (INV-6 is a hard rule per the design doc).

- [ ] **Step 3: Regenerate the project's committed Supabase types file, if one exists**

Run: `grep -rn "database.types\|supabase.types" src/lib | head -5` to locate the committed types file, then regenerate it the same way the rest of this codebase does (check `package.json` for an existing `gen:types` or similar script before inventing a new command).

---

## Self-Review Notes

**Spec coverage:** Finding 2 (Task 1) ✓. Finding 1 (Tasks 2-8) ✓ — canonical function, both RPCs rewired, buggy RPC dropped, TS layer simplified, redundant count call removed. Design doc's INV-1/INV-2 ✓ (Task 8 makes the pagination total literally the same value as the metrics call; Task 6 Step 4 makes export count read the same metrics call). INV-6 ✓ (Task 9 Step 2 checks it directly). pgTAP regression test ✓ (Task 5). `test:db` npm script ✓ (Task 5 Step 3).

**Not covered by this plan (explicitly out of scope, per the design doc's phasing):** Approvals (Finding 4), Claims (Finding 3), Finance Queue (consistency pass) — each gets its own plan document written just before it's executed, so schema/RPC state is re-verified fresh rather than risking drift from what was true when this plan was written.

**Known follow-up surfaced during this plan, not fixed here:** `getFinanceActionCodesForFilter()` (`src/features/finance/utils/action-filter.ts:16-28`) hardcodes `REJECT_ACTION_CODES = ['rejected', 'finance_rejected']` as a TS constant rather than deriving it from `finance_action_buckets()`'s `is_rejected` flag — the same authoritative-source anti-pattern as Finding 2, in a different file. It's still used by `getFinancePaymentJournalTotals` (out of scope for this plan). Worth a follow-up pass when that RPC is touched.
