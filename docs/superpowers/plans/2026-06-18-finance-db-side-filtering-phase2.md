# Finance DB-side Filtering — Phase 2 (Analytics) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
>
> **Commits:** The repo owner handles all git commits. Every "Checkpoint" means _stage the listed files and STOP_ — do NOT run `git commit`.
>
> **Prerequisite:** Phase 1a **must be green** (resolver `finance_filtered_claim_ids` parity-validated) before starting. See `2026-06-18-finance-db-side-filtering-phase1.md`.

**Goal:** Replace the in-app claim-ID resolution feeding the two finance **analytics** widgets (Approved History metrics, Finance Queue metrics) with resolver-backed SQL RPCs, so no claim-ID array is built in Node for analytics.

**Architecture:** Two new SQL functions that internally scope via `finance_filtered_claim_ids(…)` instead of taking `p_claim_ids uuid[]`: `get_finance_history_metrics` (mirrors `get_finance_history_action_metrics`) and `get_finance_queue_metrics` (mirrors `get_claim_bucket_metrics`, preserving its no-filter summary-table fast path). The two TS query functions call the new RPCs and map results unchanged.

**Tech Stack:** PostgreSQL/Supabase SQL functions; `@supabase/supabase-js`; Vitest.

## Reference

- Spec: `docs/superpowers/specs/2026-06-18-finance-db-side-filtering-design.md` §6.2, §6.3, §6.1
- Existing aggregation to mirror: `get_finance_history_action_metrics`, `get_claim_bucket_metrics` (live DB)
- TS consumers: `src/features/finance/data/queries/history-analytics.query.ts` (`getFinanceHistoryAnalytics`), `src/features/finance/data/queries/analytics.query.ts` (`getFinanceQueueAnalytics`)
- RPC wrappers: `src/features/finance/data/rpc/finance-metrics.rpc.ts`

## File Structure

- Create: `supabase/migrations/20260618091000_get_finance_history_metrics.sql`
- Create: `supabase/migrations/20260618091100_get_finance_queue_metrics.sql`
- Modify: `src/features/finance/data/rpc/finance-metrics.rpc.ts` (add two wrappers)
- Modify: `src/features/finance/data/queries/history-analytics.query.ts` (swap to new RPC)
- Modify: `src/features/finance/data/queries/analytics.query.ts` (swap to new RPC)
- Create: `src/features/finance/__tests__/finance-analytics-parity.test.ts` (analytics golden-master gate)
- Create: `scripts/finance-analytics-explain.sql` (Phase 2b EXPLAIN probes)

> **Sub-phases:** **Phase 2a (Tasks 1–5)** establishes **correctness** — build the two RPCs, rewire the
> analytics queries, pass the analytics parity gate. It draws **no performance conclusions**.
> **Phase 2b (Task 6)** validates **performance** — `EXPLAIN ANALYZE`, timing comparison, indexes if
> justified. Phase 2a is the hard gate before relying on the new path; Phase 2b is a fast follow.

---

## Phase 2a — Correctness

### Task 1: `get_finance_history_metrics` RPC

**Files:** Create `supabase/migrations/20260618091000_get_finance_history_metrics.sql`

- [ ] **Step 1: Write the migration**

This is `get_finance_history_action_metrics` with `p_claim_ids` replaced by an internal resolver scope, and the action buckets sourced from `finance_action_buckets()` instead of TS-passed arrays.

```sql
create or replace function public.get_finance_history_metrics(
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
  filtered as (
    select id from public.finance_filtered_claim_ids(
      null, p_employee_id, p_employee_name, p_claim_number, p_owner_designation,
      p_hod_approver_emp, p_claim_status, p_work_location, p_action_filter,
      p_date_field, p_date_from, p_date_to
    )
  ),
  -- action buckets (single source of truth)
  b as (select * from public.finance_action_buckets()),
  date_scoped as (
    -- payment_released_date / finance_approved_date -> the date-scoped action codes
    select action from b where
      (p_date_field = 'payment_released_date' and is_payment_released)
      or (p_date_field = 'finance_approved_date' and is_finance_approved)
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
    where (p_date_from is null or fa.acted_at >= p_date_from)
      and (p_date_to   is null or fa.acted_at <= p_date_to)
      and (
        (exists (select 1 from date_scoped) and fa.action in (select action from date_scoped))
        or (not exists (select 1 from date_scoped) and p_action_filter is not null and fa.action = p_action_filter)
        or (not exists (select 1 from date_scoped) and p_action_filter is null)
      )
  )
  select
    count(*)::int,
    coalesce(sum(total_amount),0)::numeric,
    count(*) filter (where action in (select action from approved))::int,
    coalesce(sum(total_amount) filter (where action in (select action from approved)),0)::numeric,
    count(*) filter (where action in (select action from rejected))::int,
    coalesce(sum(total_amount) filter (where action in (select action from rejected)),0)::numeric,
    count(*) filter (where action in (select action from rejected) and allow_resubmit = false)::int,
    coalesce(sum(total_amount) filter (where action in (select action from rejected) and allow_resubmit = false),0)::numeric,
    count(*) filter (where action in (select action from rejected) and allow_resubmit = true)::int,
    coalesce(sum(total_amount) filter (where action in (select action from rejected) and allow_resubmit = true),0)::numeric,
    count(*) filter (where action not in (select action from approved) and action not in (select action from rejected))::int,
    coalesce(sum(total_amount) filter (where action not in (select action from approved) and action not in (select action from rejected)),0)::numeric
  from scoped_actions;
$$;

grant execute on function public.get_finance_history_metrics(
  text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz
) to authenticated, service_role;
```

> Draft: the date-scoped / action-filter `where` mirrors `get_finance_history_action_metrics`'s
> branch logic; the `isReclaimOnlyActionFilter` fallback (TS `history-analytics.query.ts:237-251`)
> stays in the consumer mapping. Both pinned by the parity test (Task 5).

> **Hard constraint (same philosophy as Phase 1's resolver):**
> `get_finance_history_metrics` **must remain declarative SQL and must never materialize intermediate
> claim-ID collections or arrays.** It is `LANGUAGE sql` (no `plpgsql`, no `DECLARE`, no `array_agg`
> of ids, no temp tables): just CTEs (`filtered`, `b`, `date_scoped`, `approved`, `rejected`,
> `scoped_actions`) feeding a single aggregate `select`. The CTEs are set-based views the planner
> streams through — `filtered` is a subquery against `finance_filtered_claim_ids`, **not** a collected
> array. If an implementation reaches for an array or a loop here, it has recreated the very
> anti-pattern this migration exists to remove — reject it. At ~17k claims this declarative form is
> fine; the EXPLAIN probe in Phase 2b confirms the plan.

- [ ] **Step 2: Apply migration; smoke test runs without error**

Run:

```sql
select * from public.get_finance_history_metrics(
  p_date_field => 'payment_released_date',
  p_date_from  => '2025-09-01T00:00:00+05:30',
  p_date_to    => '2026-05-31T23:59:59.999+05:30');
```

Expected: one row, all columns non-null integers/numerics, no error. (Numbers verified by parity, not asserted here.)

- [ ] **Step 3: Checkpoint** — stage the migration; STOP for owner to commit.

---

### Task 2: `get_finance_queue_metrics` RPC (preserve no-filter fast path)

**Files:** Create `supabase/migrations/20260618091100_get_finance_queue_metrics.sql`

- [ ] **Step 1: Write the migration**

Mirrors `get_claim_bucket_metrics`. Path A (no active filters) reuses the maintained
`expense_claims_status_summary`; Path B scopes via the resolver. The action-filter intersection
(`getActionFilteredClaimIds`, TS `analytics.query.ts:214-230`) becomes an `EXISTS` on `finance_actions`.

```sql
create or replace function public.get_finance_queue_metrics(
  p_pending_status_ids  uuid[]      default null,
  p_approved_status_ids uuid[]      default null,
  p_rejected_status_ids uuid[]      default null,
  p_has_filters         boolean     default false,
  p_employee_id         text        default null,
  p_employee_name       text        default null,
  p_claim_number        text        default null,
  p_owner_designation   uuid        default null,
  p_hod_approver_emp    uuid        default null,
  p_claim_status        text        default null,
  p_work_location       uuid        default null,
  p_action_filter       text        default null,
  p_date_field          text        default 'claim_date',
  p_date_from           timestamptz default null,
  p_date_to             timestamptz default null,
  -- action-filter intersection window (IST), only when action filter active & not an action-date field
  p_action_intersect    text        default null,
  p_action_from         timestamptz default null,
  p_action_to           timestamptz default null
)
returns table(
  total_count integer, total_amount numeric,
  pending_count integer, pending_amount numeric,
  approved_count integer, approved_amount numeric,
  rejected_count integer, rejected_amount numeric
)
language plpgsql stable security invoker set search_path = public
as $$
declare
  v_has_pending  boolean := coalesce(array_length(p_pending_status_ids, 1),0) > 0;
  v_has_approved boolean := coalesce(array_length(p_approved_status_ids,1),0) > 0;
  v_has_rejected boolean := coalesce(array_length(p_rejected_status_ids,1),0) > 0;
begin
  if not p_has_filters then
    -- Path A: fast summary table (unchanged from get_claim_bucket_metrics Path A)
    select
      coalesce(sum(s.claim_count),0)::int,
      coalesce(sum(s.total_amount),0)::numeric,
      coalesce(sum(s.claim_count)  filter (where v_has_pending  and s.status_id = any(p_pending_status_ids)),0)::int,
      coalesce(sum(s.total_amount) filter (where v_has_pending  and s.status_id = any(p_pending_status_ids)),0)::numeric,
      coalesce(sum(s.claim_count)  filter (where v_has_approved and s.status_id = any(p_approved_status_ids)),0)::int,
      coalesce(sum(s.total_amount) filter (where v_has_approved and s.status_id = any(p_approved_status_ids)),0)::numeric,
      coalesce(sum(s.claim_count)  filter (where v_has_rejected and s.status_id = any(p_rejected_status_ids)),0)::int,
      coalesce(sum(s.total_amount) filter (where v_has_rejected and s.status_id = any(p_rejected_status_ids)),0)::numeric
    into total_count, total_amount, pending_count, pending_amount,
         approved_count, approved_amount, rejected_count, rejected_amount
    from public.expense_claims_status_summary s;
  else
    -- Path B: resolver scope + optional action-filter intersection
    select
      count(*)::int,
      coalesce(sum(ec.total_amount),0)::numeric,
      count(*) filter (where v_has_pending  and ec.status_id = any(p_pending_status_ids))::int,
      coalesce(sum(ec.total_amount) filter (where v_has_pending  and ec.status_id = any(p_pending_status_ids)),0)::numeric,
      count(*) filter (where v_has_approved and ec.status_id = any(p_approved_status_ids))::int,
      coalesce(sum(ec.total_amount) filter (where v_has_approved and ec.status_id = any(p_approved_status_ids)),0)::numeric,
      count(*) filter (where v_has_rejected and ec.status_id = any(p_rejected_status_ids))::int,
      coalesce(sum(ec.total_amount) filter (where v_has_rejected and ec.status_id = any(p_rejected_status_ids)),0)::numeric
    into total_count, total_amount, pending_count, pending_amount,
         approved_count, approved_amount, rejected_count, rejected_amount
    from public.expense_claims ec
    join public.finance_filtered_claim_ids(
      null, p_employee_id, p_employee_name, p_claim_number, p_owner_designation,
      p_hod_approver_emp, p_claim_status, p_work_location, p_action_filter,
      p_date_field, p_date_from, p_date_to
    ) f on f.id = ec.id
    where (
      p_action_intersect is null
      or exists (
        select 1 from public.finance_actions fa
        where fa.claim_id = ec.id
          and fa.action = p_action_intersect
          and (p_action_from is null or fa.acted_at >= p_action_from)
          and (p_action_to   is null or fa.acted_at <= p_action_to)
      )
    );
  end if;

  total_count:=coalesce(total_count,0); total_amount:=coalesce(total_amount,0);
  pending_count:=coalesce(pending_count,0); pending_amount:=coalesce(pending_amount,0);
  approved_count:=coalesce(approved_count,0); approved_amount:=coalesce(approved_amount,0);
  rejected_count:=coalesce(rejected_count,0); rejected_amount:=coalesce(rejected_amount,0);
  return next;
end;
$$;

grant execute on function public.get_finance_queue_metrics(
  uuid[],uuid[],uuid[],boolean,text,text,text,uuid,uuid,text,uuid,text,text,
  timestamptz,timestamptz,text,timestamptz,timestamptz
) to authenticated, service_role;
```

> Note: `rejected_allow_reclaim` action filter sets `p_action_filter='rejected_allow_reclaim'`, which
> the resolver translates to `allow_resubmit = true` — there is no separate `p_action_intersect` in
> that case. `p_action_intersect` is used only for the single-action filters that today go through
> `getActionFilteredClaimIds`. Parity test pins this.

- [ ] **Step 2: Apply migration; smoke test both paths**

Run:

```sql
select * from public.get_finance_queue_metrics(p_has_filters => false);             -- Path A
select * from public.get_finance_queue_metrics(p_has_filters => true,
        p_date_field => 'claim_date');                                              -- Path B
```

Expected: both return one row, no error.

- [ ] **Step 3: Checkpoint** — stage the migration; STOP for owner to commit.

---

### Task 3: TS RPC wrappers

**Files:** Modify `src/features/finance/data/rpc/finance-metrics.rpc.ts`

- [ ] **Step 1: Add the two wrappers (append to the file)**

```ts
export async function getFinanceHistoryMetricsFilteredRpc(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<FinanceHistoryMetricsRow | null> {
  const { data, error } = await supabase.rpc(
    'get_finance_history_metrics',
    args
  )
  if (error) throw new Error(error.message)
  return (
    Array.isArray(data) ? data[0] : data
  ) as FinanceHistoryMetricsRow | null
}

export async function getFinanceQueueMetricsFilteredRpc(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<ClaimBucketMetricsRow | null> {
  const { data, error } = await supabase.rpc('get_finance_queue_metrics', args)
  if (error) throw new Error(error.message)
  return (Array.isArray(data) ? data[0] : data) as ClaimBucketMetricsRow | null
}
```

- [ ] **Step 2: Typecheck** — Run: `npx tsc --noEmit` (changed file clean). Expected: no new errors.
- [ ] **Step 3: Checkpoint** — stage `finance-metrics.rpc.ts`; STOP for owner to commit.

---

### Task 4: Rewire the two analytics query functions

**Files:** Modify `src/features/finance/data/queries/history-analytics.query.ts`, `src/features/finance/data/queries/analytics.query.ts`

- [ ] **Step 1: `getFinanceHistoryAnalytics` — call the new RPC**

Replace the body of `getFinanceHistoryAnalytics` (the `getFilteredClaimIdsForFinance` + `getFinanceActionBuckets` + `getFinanceHistoryActionMetricsRpc` block) with a single RPC call. Date conversion stays in TS:

```ts
export async function getFinanceHistoryAnalytics(
  supabase: SupabaseClient,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<FinanceHistoryAnalytics> {
  const analytics = createEmptyAnalytics()

  const isActionDate =
    filters.dateFilterField === 'payment_released_date' ||
    filters.dateFilterField === 'finance_approved_date'
  const useIst =
    isActionDate ||
    filters.dateFilterField === 'submitted_at' ||
    filters.dateFilterField === 'hod_approved_date'

  const metrics = await getFinanceHistoryMetricsFilteredRpc(supabase, {
    p_employee_id: filters.employeeId,
    p_employee_name: filters.employeeName,
    p_claim_number: filters.claimNumber,
    p_owner_designation: filters.ownerDesignation,
    p_hod_approver_emp: filters.hodApproverEmployeeId,
    p_claim_status: filters.claimStatus,
    p_work_location: filters.workLocation,
    p_action_filter: filters.actionFilter,
    p_date_field: filters.dateFilterField,
    p_date_from: useIst ? toIstDayStart(filters.dateFrom) : filters.dateFrom,
    p_date_to: useIst ? toIstDayEnd(filters.dateTo) : filters.dateTo,
  })

  if (!metrics) return analytics

  const isReclaimOnlyActionFilter =
    filters.actionFilter === REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE
  const rejectedWithoutReclaimCount =
    metrics.rejected_without_reclaim_count ??
    (isReclaimOnlyActionFilter ? 0 : metrics.rejected_count)
  const rejectedWithoutReclaimAmount =
    metrics.rejected_without_reclaim_amount ??
    (isReclaimOnlyActionFilter ? 0 : metrics.rejected_amount)
  const rejectedAllowReclaimCount =
    metrics.rejected_allow_reclaim_count ??
    (isReclaimOnlyActionFilter ? metrics.rejected_count : 0)
  const rejectedAllowReclaimAmount =
    metrics.rejected_allow_reclaim_amount ??
    (isReclaimOnlyActionFilter ? metrics.rejected_amount : 0)

  return {
    total: {
      count: toNumber(metrics.total_count),
      amount: toNumber(metrics.total_amount),
    },
    approvedHistory: {
      count: toNumber(metrics.approved_count),
      amount: toNumber(metrics.approved_amount),
    },
    rejected: {
      count: toNumber(rejectedWithoutReclaimCount),
      amount: toNumber(rejectedWithoutReclaimAmount),
    },
    rejectedAllowReclaim: {
      count: toNumber(rejectedAllowReclaimCount),
      amount: toNumber(rejectedAllowReclaimAmount),
    },
    other: {
      count: toNumber(metrics.other_count),
      amount: toNumber(metrics.other_amount),
    },
  }
}
```

Add the import: `import { getFinanceHistoryMetricsFilteredRpc } from '@/features/finance/data/rpc/finance-metrics.rpc'`. Remove now-unused imports (`getFilteredClaimIdsForFinance`, the bucket helpers) only if nothing else in the file uses them — otherwise leave for Phase 5 cleanup.

- [ ] **Step 2: `getFinanceQueueAnalytics` — call the new RPC**

Replace the `getFilteredClaimIdsForFinance` + `getActionFilteredClaimIds` + `getClaimBucketMetricsRpc` block with one call. Keep the status-id derivation (it queries the tiny `claim_statuses` table):

```ts
const hasFilters = hasActiveAnalyticsFilters(filters)
const filterByFinanceActionDate =
  (filters.dateFilterField === 'finance_approved_date' ||
    filters.dateFilterField === 'payment_released_date') &&
  (filters.dateFrom || filters.dateTo)

const useActionIntersect =
  hasFilters &&
  !!filters.actionFilter &&
  !filterByFinanceActionDate &&
  filters.actionFilter !== 'rejected_allow_reclaim'

const useIst =
  filterByFinanceActionDate ||
  filters.dateFilterField === 'submitted_at' ||
  filters.dateFilterField === 'hod_approved_date'

const metrics = await getFinanceQueueMetricsFilteredRpc(supabase, {
  p_pending_status_ids: pendingFinanceQueueStatusIds,
  p_approved_status_ids: approvedStatusIds,
  p_rejected_status_ids: rejectedStatusIds,
  p_has_filters: hasFilters,
  p_employee_id: filters.employeeId,
  p_employee_name: filters.employeeName,
  p_claim_number: filters.claimNumber,
  p_owner_designation: filters.ownerDesignation,
  p_hod_approver_emp: filters.hodApproverEmployeeId,
  p_claim_status: filters.claimStatus,
  p_work_location: filters.workLocation,
  p_action_filter: filters.actionFilter,
  p_date_field: filters.dateFilterField,
  p_date_from: useIst ? toIstDayStart(filters.dateFrom) : filters.dateFrom,
  p_date_to: useIst ? toIstDayEnd(filters.dateTo) : filters.dateTo,
  p_action_intersect: useActionIntersect ? filters.actionFilter : null,
  p_action_from: useActionIntersect ? toIstDayStart(filters.dateFrom) : null,
  p_action_to: useActionIntersect ? toIstDayEnd(filters.dateTo) : null,
})

if (!metrics) return analytics
return {
  total: {
    count: toNumber(metrics.total_count),
    amount: toNumber(metrics.total_amount),
  },
  pendingFinanceQueue: {
    count: toNumber(metrics.pending_count),
    amount: toNumber(metrics.pending_amount),
  },
  approved: {
    count: toNumber(metrics.approved_count),
    amount: toNumber(metrics.approved_amount),
  },
  rejected: {
    count: toNumber(metrics.rejected_count),
    amount: toNumber(metrics.rejected_amount),
  },
}
```

Add the import for `getFinanceQueueMetricsFilteredRpc`.

- [ ] **Step 3: Typecheck + existing unit tests**

Run: `npx tsc --noEmit` (no new errors) and `npx vitest run src/features/finance/__tests__/` (all pass — these mock-based tests should be unaffected; update any test that asserted the old internal call sequence).

- [ ] **Step 4: Architectural assertion — analytics builds no claim-ID arrays**

This is a success criterion of Phase 2, not a nicety. Analytics RPCs consume filter **parameters**
directly and must never materialize claim-ID collections in application memory. Verify:

```bash
# Neither analytics query file may reference the legacy resolver/collectors or pass p_claim_ids.
rg -n "getFilteredClaimIdsForFinance|getActionFilteredClaimIds|p_claim_ids" \
  src/features/finance/data/queries/history-analytics.query.ts \
  src/features/finance/data/queries/analytics.query.ts
```

Expected: **zero matches**. If anything matches, the rewire is incomplete — the point is that
`filters → RPC`, never `filters → resolver → ids → array → RPC`. (The legacy functions still exist for
the parity test in Task 5; they just must not be on the analytics runtime path.)

- [ ] **Step 5: Checkpoint** — stage both query files; STOP for owner to commit.

---

### Task 5: Analytics parity gate (release gate, blocking)

**Files:** Create `src/features/finance/__tests__/finance-analytics-parity.test.ts`

- [ ] **Step 1: Write the parity test**

Pattern identical to `finance-resolver-parity.test.ts` (Phase 1): opt-in `PARITY=1`, dynamic fixtures via `fetchSamples`, same matrix. For each case, capture the OLD analytics output **before** Task 4's swap by calling git-stashed code is impractical; instead assert the NEW RPC output equals a **fresh recomputation of the legacy formula** run against the same dataset. Concretely, compare the two metrics RPC shapes:

```ts
// For each filter case, assert new resolver-backed metrics == legacy id-array metrics.
// Legacy path: build ids with getFilteredClaimIdsForFinance + buckets, call the OLD RPCs.
// New path: call get_finance_history_metrics / get_finance_queue_metrics.
// Every numeric field (count AND amount) must be equal.
```

Implement two comparisons per case:

- History: legacy `getFinanceHistoryActionMetricsRpc({ p_claim_ids, … })` (built the old way) vs `getFinanceHistoryMetricsFilteredRpc({ filters })`.
- Queue: legacy `getClaimBucketMetricsRpc({ p_claim_ids, … })` vs `getFinanceQueueMetricsFilteredRpc({ filters })`.

Assert field-by-field equality with the case name in the message. (Keep `getFilteredClaimIdsForFinance` + old RPC wrappers importable until Phase 5 so this test can run the legacy side.)

**Required cases — beyond the Phase 1 matrix, add the `allow_resubmit` × action-filter × date/scope
combinations, because that intersection is exactly where regressions hide:**

- `rejected_allow_reclaim` alone
- `rejected_allow_reclaim` + wide date range
- `rejected_allow_reclaim` + `employeeName` (dynamic fixture)
- `rejected_allow_reclaim` + `workLocation` (dynamic fixture)
- `rejected_allow_reclaim` + `claimStatus` (plain) and + `claimStatus:allow_resubmit`
- `finance_rejected` alone and + wide date range (the non-reclaim rejected path, to prove the
  `rejected_without_reclaim` vs `rejected_allow_reclaim` split is identical to legacy)

Each must pass for **both** the history-metrics and queue-metrics comparisons.

- [ ] **Step 2: Verify it skips without PARITY** — Run: `npx vitest run src/features/finance/__tests__/finance-analytics-parity.test.ts`. Expected: skipped.

- [ ] **Step 3: Run the gate** — `PARITY=1 SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx vitest run …finance-analytics-parity.test.ts`. Expected: ALL cases PASS (every count + amount equal). Fix RPC SQL on any mismatch; do not proceed until green.

- [ ] **Step 4: Checkpoint** — stage the parity test; STOP for owner to commit.

---

## Phase 2b — Performance & indexes (sub-phase)

> Performance timings and plans here are **informational and used for investigation only**. The hard
> release gate for Phase 2 is the analytics **parity** gate (Task 5). Shared DB load, cold starts, and
> CI variability make timing numbers noisy — never gate on them.

### Task 6: `EXPLAIN ANALYZE` for the analytics RPCs

**Files:** Create `scripts/finance-analytics-explain.sql`

- [ ] **Step 1: Write the EXPLAIN probes**

```sql
-- Analytics RPC plan probes. Run against the dev project; inspect for pathological plans.

-- History metrics, wide payment_released window (the heavy case).
explain (analyze, buffers)
select * from public.get_finance_history_metrics(
  p_date_field => 'payment_released_date',
  p_date_from  => '2025-09-01T00:00:00+05:30',
  p_date_to    => '2026-05-31T23:59:59.999+05:30'
);

-- Queue metrics, Path B (filters active).
explain (analyze, buffers)
select * from public.get_finance_queue_metrics(
  p_has_filters => true,
  p_date_field  => 'claim_date'
);

-- Queue metrics, Path A (no filters -> summary table fast path).
explain (analyze, buffers)
select * from public.get_finance_queue_metrics(p_has_filters => false);
```

- [ ] **Step 2: Run the probes and record plans in the PR**

Acceptance (performance): **no pathological plans on the hot analytics paths.** Unexpected scans on
large relations (`expense_claims`, `finance_actions`) should be **investigated and justified** in the
PR — not automatically rejected, but not ignored either. Confirm Path A still hits
`expense_claims_status_summary` (tiny), and the resolver `EXISTS` subqueries use the claim-scoped
indexes (`idx_finance_actions_claim_latest`, `idx_approval_history_claim_acted_at_id`).

- [ ] **Step 3: Add an index only if a probe justifies it**

If a probe shows a scan that materially hurts a hot path, add the index in a migration and re-run the
probe to show the improvement. Record the before/after plans. If no index is warranted, note "no new
index needed" in the PR.

- [ ] **Step 4: Checkpoint** — stage `scripts/finance-analytics-explain.sql` (and any index migration); STOP for owner to commit.

---

## Phase 2 Exit Criteria

**Phase 2a (correctness) — required before relying on the new path:**

- `get_finance_history_metrics` and `get_finance_queue_metrics` exist; queue's no-filter summary fast path preserved.
- Both analytics query functions call the new RPCs.
- Analytics parity gate **green**: every metric field (count **and** amount) equals the legacy path on the same dataset, including the `rejected_allow_reclaim` / `finance_rejected` matrix.
- **Architectural success criteria (the whole point of Phase 2):**
  - No analytics code path builds a claim-ID array.
  - No analytics code path passes `p_claim_ids uuid[]`.
  - `getFilteredClaimIdsForFinance()` is no longer referenced by analytics.
  - `getActionFilteredClaimIds()` is no longer referenced by analytics.
  - Analytics RPCs consume filter parameters directly and never materialize claim-ID collections in application memory.
- Phase 2a proves **behavioral equivalence only** — it draws no performance conclusions.

**Phase 2b (performance) — fast follow:**

- `EXPLAIN ANALYZE` plans recorded for both RPCs (and both queue paths).
- No pathological plans on hot paths; any unexpected scan on a large relation investigated and justified.
- Any new index justified by measurements (before/after plans recorded).
- Timing tables recorded for information only — they do **not** gate Phase 2.

> `getActionFilteredClaimIds` and the other legacy collectors remain importable for the parity test; their actual deletion happens in Phase 5.
