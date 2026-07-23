# Finance DB-side Filtering — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.
>
> **Commits:** This repo's owner handles all git commits. Every "Checkpoint" step means _stage the listed files and STOP for the owner to review and commit_ — do NOT run `git commit`.

**Goal:** Ship the canonical SQL filter resolver (`finance_filtered_claim_ids`) plus its shared action-semantics helper (`finance_action_buckets`), and prove via a live golden-master parity gate that the SQL resolver returns the exact same claim-ID set as today's `getFilteredClaimIdsForFinance()` across the full filter matrix — without changing any app behavior yet.

**Architecture:** Two pure-SQL functions (`LANGUAGE sql STABLE SECURITY INVOKER`) added as Supabase migrations. A vitest parity harness calls the old TS path and the new RPC for each filter combination and asserts `set==set` and `count==count`. No consumer is rewired and nothing is deleted in this phase; Phase 1 is purely additive and independently shippable.

**Tech Stack:** PostgreSQL (Supabase) SQL functions; `@supabase/supabase-js` service-role client; Vitest; existing TS in `src/features/finance/data/repositories/finance-filters.repository.ts`.

---

## Reference

- Spec: `docs/superpowers/specs/2026-06-18-finance-db-side-filtering-design.md`
- Old path under test: `getFilteredClaimIdsForFinance()` in `src/features/finance/data/repositories/finance-filters.repository.ts`
- Filter type: `FinanceFilters` in `src/features/finance/types`
- IST date conversion: `toIstDayStart` / `toIstDayEnd` in `src/features/finance/utils/filters`
- Supabase project ref (dev): `ibrvpangpuxiorspeffz`

## File Structure

- Create: `supabase/migrations/20260618090000_finance_action_buckets.sql` — the action-classification helper (Layer 0).
- Create: `supabase/migrations/20260618090100_finance_filtered_claim_ids.sql` — the canonical resolver (Layer 1).
- Create: `src/features/finance/__tests__/finance-resolver-parity.test.ts` — the golden-master parity gate (old TS vs new SQL).
- Create: `scripts/finance-resolver-explain.sql` — `EXPLAIN (ANALYZE, BUFFERS)` probes for the resolver.
- No application code is modified or deleted in Phase 1.

> **Migration filename convention:** Supabase applies `supabase/migrations/*.sql` in lexical order. The `20260618HHMMSS_` timestamps above sort after existing migrations. If a later real timestamp is required by the owner's tooling, keep the two files in the given relative order.

> **Sub-phases:** Phase 1a (Tasks 1–3) establishes **correctness** — the resolver and its parity gate. Phase 1b (Task 4) handles **performance** — `EXPLAIN ANALYZE` and any index. 1a is independently shippable; 1b is a fast follow once parity is green and the timing table from Task 3 Step 4 is in hand.

---

## Phase 1a — Resolver, semantics & parity gate (correctness)

### Task 1: `finance_action_buckets()` — shared action semantics

**Files:**

- Create: `supabase/migrations/20260618090000_finance_action_buckets.sql`

- [x] **Step 1: Write the migration**

Create `supabase/migrations/20260618090000_finance_action_buckets.sql`:

```sql
-- Layer 0: single source of truth for finance action classification.
-- Ports getFinanceActionBuckets() + normalizeFinanceHistoryActionCode() from
-- src/features/finance/data/queries/history-analytics.query.ts into SQL.
create or replace function public.finance_action_buckets()
returns table(
  action               text,
  is_approved          boolean,
  is_rejected          boolean,
  is_finance_approved  boolean,
  is_payment_released  boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with s as (
    select id, approval_level, is_approval, is_rejection, is_terminal, is_payment_issued
    from claim_statuses
    where is_active
  ),
  t as (
    select action_code, to_status_id
    from claim_status_transitions
    where is_active
  )
  select
    case
      when s.is_payment_issued and t.action_code like 'finance_%'
        then substr(t.action_code, length('finance_') + 1)
      else t.action_code
    end as action,
    (
      s.is_payment_issued
      or (s.is_approval and not s.is_rejection and not s.is_terminal
          and not s.is_payment_issued and s.approval_level is null)
    ) as is_approved,
    s.is_rejection as is_rejected,
    (
      s.is_approval and not s.is_rejection and not s.is_terminal
      and not s.is_payment_issued and s.approval_level is null
    ) as is_finance_approved,
    s.is_payment_issued as is_payment_released
  from t
  join s on s.id = t.to_status_id;
$$;

grant execute on function public.finance_action_buckets() to authenticated, service_role;
```

- [x] **Step 2: Apply the migration to the dev project and verify it loads**

Apply via the owner's normal Supabase migration flow (or `supabase db push`). Then verify the function returns rows and the normalization works:

Run (SQL console / `supabase db execute`):

```sql
select action, is_approved, is_rejected, is_finance_approved, is_payment_released
from public.finance_action_buckets()
order by action;
```

Expected: a non-empty result; rows where `is_payment_released` is true have `action` values **without** the `finance_` prefix (e.g. `payment_released`, not `finance_payment_released`); at least one `is_finance_approved=true` and one `is_rejected=true` row.

- [x] **Step 3: Cross-check against the current JS buckets**

Compare the SQL output to the JS `getFinanceActionBuckets()` result for the same DB. Run this diff query — it must return **zero rows**:

```sql
-- payment_released action set from SQL must match the app's paymentReleasedActions.
-- (Manual check: list the SQL sets, confirm they equal what getFinanceActionBuckets returns.)
select 'sql_payment_released' as src, array_agg(distinct action order by action) as actions
from public.finance_action_buckets() where is_payment_released
union all
select 'sql_finance_approved', array_agg(distinct action order by action)
from public.finance_action_buckets() where is_finance_approved
union all
select 'sql_rejected', array_agg(distinct action order by action)
from public.finance_action_buckets() where is_rejected;
```

Expected: the three arrays equal `paymentReleasedActions`, `financeApprovedActions`, and `rejectedActions` produced by `getFinanceActionBuckets()` (read them off by temporarily logging that function, or compare against the `finance_actions.action` values seen in the live data). Record the arrays in the PR description.

- [x] **Step 4: Checkpoint**

Stage `supabase/migrations/20260618090000_finance_action_buckets.sql` and STOP for the owner to review and commit.

---

### Task 2: `finance_filtered_claim_ids()` — canonical resolver

**Files:**

- Create: `supabase/migrations/20260618090100_finance_filtered_claim_ids.sql`

- [x] **Step 1: Write the migration**

Create `supabase/migrations/20260618090100_finance_filtered_claim_ids.sql`:

```sql
-- Layer 1: canonical membership resolver. Returns ONLY ids (projection/ordering
-- is the consumer's job). Pure SQL, no arrays, no loops. Ports
-- getFilteredClaimIdsForFinance() from
-- src/features/finance/data/repositories/finance-filters.repository.ts.
create or replace function public.finance_filtered_claim_ids(
  p_required_status_id uuid        default null,
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
returns table(id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id
  from expense_claims c
  join employees e on e.id = c.employee_id
  where
    (p_required_status_id is null or c.status_id = p_required_status_id)
    and (p_claim_status is null or c.status_id = split_part(p_claim_status, ':', 1)::uuid)
    -- allow_resubmit resolution (single rule):
    --   '<uuid>:allow_resubmit' status filter  -> only allow_resubmit = true
    --   actionFilter 'rejected_allow_reclaim'  -> only allow_resubmit = true
    --   otherwise (default finance view)        -> exclude resubmit-pending duplicates
    and (
      case
        when p_claim_status like '%:allow_resubmit'     then c.allow_resubmit is true
        when p_action_filter = 'rejected_allow_reclaim' then c.allow_resubmit is true
        else c.allow_resubmit is not true
      end
    )
    and (p_employee_id   is null or e.employee_id   ilike '%' || p_employee_id   || '%')
    and (p_employee_name is null or e.employee_name ilike '%' || p_employee_name || '%')
    and (p_claim_number  is null or c.claim_number = p_claim_number)
    and (p_work_location is null or c.work_location_id = p_work_location)
    and (p_owner_designation is null or e.designation_id = p_owner_designation)
    -- claim-column date filters
    and (p_date_field <> 'claim_date'   or p_date_from is null or c.claim_date   >= p_date_from)
    and (p_date_field <> 'claim_date'   or p_date_to   is null or c.claim_date   <= p_date_to)
    and (p_date_field <> 'submitted_at' or p_date_from is null or c.submitted_at >= p_date_from)
    and (p_date_field <> 'submitted_at' or p_date_to   is null or c.submitted_at <= p_date_to)
    -- finance-action date filters (payment_released_date / finance_approved_date)
    and (
      p_date_field not in ('payment_released_date', 'finance_approved_date')
      or exists (
        select 1
        from finance_actions fa
        join finance_action_buckets() b on b.action = fa.action
        where fa.claim_id = c.id
          and (
            (p_date_field = 'payment_released_date' and b.is_payment_released)
            or (p_date_field = 'finance_approved_date' and b.is_finance_approved)
          )
          and (p_date_from is null or fa.acted_at >= p_date_from)
          and (p_date_to   is null or fa.acted_at <= p_date_to)
      )
    )
    -- HOD approver and/or hod_approved_date (finance-review status = level 3, not approval/rejection/terminal)
    and (
      (p_hod_approver_emp is null and p_date_field <> 'hod_approved_date')
      or exists (
        select 1
        from approval_history ah
        join claim_statuses fs
          on fs.id = ah.new_status_id
         and fs.approval_level = 3
         and fs.is_approval = false
         and fs.is_rejection = false
         and fs.is_terminal = false
         and fs.is_active = true
        where ah.claim_id = c.id
          and (p_hod_approver_emp is null or ah.approver_employee_id = p_hod_approver_emp)
          and (p_date_field <> 'hod_approved_date' or p_date_from is null or ah.acted_at >= p_date_from)
          and (p_date_field <> 'hod_approved_date' or p_date_to   is null or ah.acted_at <= p_date_to)
      )
    );
$$;

grant execute on function public.finance_filtered_claim_ids(
  uuid, text, text, text, uuid, uuid, text, uuid, text, text, timestamptz, timestamptz
) to authenticated, service_role;
```

- [x] **Step 2: Apply the migration and smoke-test the previously-failing shape**

Apply via the owner's migration flow. Then run the original wide `payment_released` shape — the point is that it now executes **server-side without a 400** and returns a count, not that it returns any specific number:

Run:

```sql
select count(*) as n
from public.finance_filtered_claim_ids(
  p_date_field => 'payment_released_date',
  p_date_from  => '2025-09-01T00:00:00+05:30',
  p_date_to    => '2026-05-31T23:59:59.999+05:30'
);
```

Expected: the query succeeds (no error) and returns a single integer `n >= 0`. **Do not assert a fixed number** — counts move as data changes. Correctness of the count is proven by the parity gate (Task 3), which compares against the old implementation on the _same_ dataset.

- [x] **Step 3: Checkpoint**

Stage `supabase/migrations/20260618090100_finance_filtered_claim_ids.sql` and STOP for the owner to review and commit.

---

### Task 3: Golden-master parity gate (old TS vs new SQL)

**Files:**

- Create: `src/features/finance/__tests__/finance-resolver-parity.test.ts`

This is the **release gate**. It runs the existing `getFilteredClaimIdsForFinance()` and the new `finance_filtered_claim_ids` RPC against the **live dev dataset** for every filter combination and asserts identical ID sets and counts. It requires a real service-role client, so it is gated behind an env var and skipped in normal unit runs.

- [x] **Step 1: Write the parity test**

Create `src/features/finance/__tests__/finance-resolver-parity.test.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

import { getFilteredClaimIdsForFinance } from '@/features/finance/data/repositories/finance-filters.repository'
import { toIstDayEnd, toIstDayStart } from '@/features/finance/utils/filters'
import type { FinanceFilters } from '@/features/finance/types'

// Live golden-master parity gate. Opt-in: requires a service-role connection.
// Run with:
//   PARITY=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run \
//     src/features/finance/__tests__/finance-resolver-parity.test.ts
const ENABLED = process.env.PARITY === '1'

const BASE: FinanceFilters = {
  employeeId: null,
  employeeName: null,
  claimNumber: null,
  ownerDesignation: null,
  hodApproverEmployeeId: null,
  claimStatus: null,
  workLocation: null,
  actionFilter: null,
  dateFilterField: 'claim_date',
  dateFrom: null,
  dateTo: null,
}

// Arbitrary bounds. We assert parity between old and new on the SAME dataset,
// never the contents of these ranges — so they stay valid as data changes.
const WIDE = { dateFrom: '2025-09-01', dateTo: '2026-05-31' }
const NARROW = { dateFrom: '2026-04-01', dateTo: '2026-05-31' }

function usesIstBoundary(field: FinanceFilters['dateFilterField']): boolean {
  return (
    field === 'payment_released_date' ||
    field === 'finance_approved_date' ||
    field === 'submitted_at' ||
    field === 'hod_approved_date'
  )
}

// Calls the new resolver exactly as the future TS wrapper will: date-only values
// are converted to IST day boundaries before being passed as timestamptz.
async function newResolverIds(
  supabase: SupabaseClient,
  filters: FinanceFilters
): Promise<string[]> {
  const useIst = usesIstBoundary(filters.dateFilterField)
  const dateFrom = useIst ? toIstDayStart(filters.dateFrom) : filters.dateFrom
  const dateTo = useIst ? toIstDayEnd(filters.dateTo) : filters.dateTo

  const { data, error } = await supabase.rpc('finance_filtered_claim_ids', {
    p_required_status_id: null,
    p_employee_id: filters.employeeId,
    p_employee_name: filters.employeeName,
    p_claim_number: filters.claimNumber,
    p_owner_designation: filters.ownerDesignation,
    p_hod_approver_emp: filters.hodApproverEmployeeId,
    p_claim_status: filters.claimStatus,
    p_work_location: filters.workLocation,
    p_action_filter: filters.actionFilter,
    p_date_field: filters.dateFilterField,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  })

  if (error) throw new Error(error.message)
  return (data ?? []).map((r: { id: string }) => r.id)
}

function sortedUnique(ids: string[] | null): string[] {
  return [...new Set(ids ?? [])].sort()
}

// Real fixture values fetched from the live dataset at runtime (never hardcoded,
// so the suite survives data refreshes). Any value that isn't present is skipped.
type Samples = {
  claimStatus?: string
  designation?: string
  hodApprover?: string
  workLocation?: string
  employeeName?: string
  employeeId?: string
  claimNumber?: string
}

async function fetchSamples(supabase: SupabaseClient): Promise<Samples> {
  const [statusRes, empRes, claimRes, ahRes] = await Promise.all([
    supabase
      .from('claim_statuses')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('employees')
      .select('employee_id, employee_name, designation_id')
      .not('designation_id', 'is', null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('expense_claims')
      .select('claim_number, work_location_id')
      .not('work_location_id', 'is', null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('approval_history')
      .select('approver_employee_id')
      .not('approver_employee_id', 'is', null)
      .limit(1)
      .maybeSingle(),
  ])

  return {
    claimStatus: statusRes.data?.id,
    designation: empRes.data?.designation_id ?? undefined,
    employeeId: empRes.data?.employee_id ?? undefined,
    employeeName: empRes.data?.employee_name ?? undefined,
    workLocation: claimRes.data?.work_location_id ?? undefined,
    claimNumber: claimRes.data?.claim_number ?? undefined,
    hodApprover: ahRes.data?.approver_employee_id ?? undefined,
  }
}

describe.skipIf(!ENABLED)('finance resolver parity (old TS vs new SQL)', () => {
  let supabase: SupabaseClient
  let samples: Samples

  beforeAll(async () => {
    supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false } }
    )
    samples = await fetchSamples(supabase)
  })

  it('matches the old implementation across the filter matrix (set + count + perf)', async () => {
    const cases: Array<{ name: string; filters: FinanceFilters }> = [
      {
        name: 'claim_date wide',
        filters: { ...BASE, dateFilterField: 'claim_date', ...WIDE },
      },
      {
        name: 'submitted_at wide',
        filters: { ...BASE, dateFilterField: 'submitted_at', ...WIDE },
      },
      {
        name: 'payment_released wide',
        filters: { ...BASE, dateFilterField: 'payment_released_date', ...WIDE },
      },
      {
        name: 'payment_released narrow',
        filters: {
          ...BASE,
          dateFilterField: 'payment_released_date',
          ...NARROW,
        },
      },
      {
        name: 'finance_approved wide',
        filters: { ...BASE, dateFilterField: 'finance_approved_date', ...WIDE },
      },
      {
        name: 'hod_approved wide',
        filters: { ...BASE, dateFilterField: 'hod_approved_date', ...WIDE },
      },
      {
        name: 'actionFilter rejected_allow_reclaim',
        filters: { ...BASE, actionFilter: 'rejected_allow_reclaim' },
      },
      {
        name: 'actionFilter finance_rejected',
        filters: { ...BASE, actionFilter: 'finance_rejected' },
      },
    ]

    // Data-dependent cases — added only when a real value exists in this dataset.
    if (samples.claimStatus) {
      cases.push({
        name: 'claimStatus',
        filters: { ...BASE, claimStatus: samples.claimStatus },
      })
      cases.push({
        name: 'claimStatus allow_resubmit',
        filters: {
          ...BASE,
          claimStatus: `${samples.claimStatus}:allow_resubmit`,
        },
      })
    }
    if (samples.designation)
      cases.push({
        name: 'ownerDesignation',
        filters: { ...BASE, ownerDesignation: samples.designation },
      })
    if (samples.hodApprover)
      cases.push({
        name: 'hodApprover',
        filters: { ...BASE, hodApproverEmployeeId: samples.hodApprover },
      })
    if (samples.workLocation)
      cases.push({
        name: 'workLocation',
        filters: { ...BASE, workLocation: samples.workLocation },
      })
    if (samples.employeeName)
      cases.push({
        name: 'employeeName',
        filters: { ...BASE, employeeName: samples.employeeName },
      })
    if (samples.employeeId)
      cases.push({
        name: 'employeeId',
        filters: { ...BASE, employeeId: samples.employeeId },
      })
    if (samples.claimNumber)
      cases.push({
        name: 'claimNumber',
        filters: { ...BASE, claimNumber: samples.claimNumber },
      })

    const timings: Array<{
      name: string
      oldMs: number
      newMs: number
      n: number
    }> = []

    for (const { name, filters } of cases) {
      const t0 = performance.now()
      const oldIds = await getFilteredClaimIdsForFinance(supabase, filters)
      const t1 = performance.now()
      const newIds = await newResolverIds(supabase, filters)
      const t2 = performance.now()

      const oldSet = sortedUnique(oldIds)
      const newSet = sortedUnique(newIds)

      // count parity first (cheap, clear failure), then exact set parity.
      expect(newSet.length, `count mismatch: ${name}`).toBe(oldSet.length)
      expect(newSet, `set mismatch: ${name}`).toEqual(oldSet)

      timings.push({ name, oldMs: t1 - t0, newMs: t2 - t1, n: oldSet.length })
    }

    // Performance is INFORMATIONAL ONLY (timings on a shared live DB are noisy, so
    // a hard threshold would flake). Print per-case + aggregate timings for human
    // judgement; never fail the suite on timing. The hard gate is parity above.
    const oldTotal = timings.reduce((acc, t) => acc + t.oldMs, 0)
    const newTotal = timings.reduce((acc, t) => acc + t.newMs, 0)
    // eslint-disable-next-line no-console
    console.table(
      timings.map((t) => ({
        ...t,
        oldMs: Math.round(t.oldMs),
        newMs: Math.round(t.newMs),
      }))
    )
    // eslint-disable-next-line no-console
    console.log(
      `PARITY perf total (informational): old=${Math.round(oldTotal)}ms new=${Math.round(newTotal)}ms`
    )
  })
})
```

- [x] **Step 2: Verify the test is wired correctly (skips without PARITY)**

Run: `npx vitest run src/features/finance/__tests__/finance-resolver-parity.test.ts`
Expected: the suite is **skipped** (0 failures) because `PARITY` is unset — confirms it won't break normal CI.

- [x] **Step 3: Run the parity gate against the live dev dataset**

Run:

```bash
PARITY=1 \
SUPABASE_URL=https://ibrvpangpuxiorspeffz.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<dev service role key> \
npx vitest run src/features/finance/__tests__/finance-resolver-parity.test.ts
```

Expected: the single matrix test PASSES — every case shows `set==set` and `count==count`. The acceptance is **parity with the old implementation on this dataset**, not any fixed number. If a case fails, the resolver SQL in Task 2 is wrong for that dimension — fix the SQL (re-apply migration), re-run; do not proceed until green. This is the gate.

- [x] **Step 4: Confirm the performance acceptance criterion**

The test prints a per-case timing table and `PARITY perf total (informational): old=… new=…`. This is **informational only — it never fails the suite**. Eyeball the table and investigate any single case where `newMs` exceeds `~2×` its `oldMs` (likely a missing index — addressed in Phase 1b, Task 4). Record the table in the PR for the performance discussion.

- [x] **Step 5: Checkpoint**

Stage `src/features/finance/__tests__/finance-resolver-parity.test.ts` and STOP for the owner to review and commit.

---

## Phase 1b — Performance & indexes (sub-phase)

### Task 4: `EXPLAIN ANALYZE` and index validation

**Files:**

- Create: `scripts/finance-resolver-explain.sql`

- [x] **Step 1: Write the EXPLAIN probes**

Create `scripts/finance-resolver-explain.sql`:

```sql
-- Resolver plan probes. Run against the dev project and inspect for seq scans.

-- 1) The wide payment_released case (the shape that overflowed the URL pre-fix).
explain (analyze, buffers)
select id from public.finance_filtered_claim_ids(
  p_date_field => 'payment_released_date',
  p_date_from  => '2025-09-01T00:00:00+05:30',
  p_date_to    => '2026-05-31T23:59:59.999+05:30'
);

-- 2) No-filter default (allow_resubmit exclusion only).
explain (analyze, buffers)
select id from public.finance_filtered_claim_ids();

-- 3) HOD approver present.
explain (analyze, buffers)
select id from public.finance_filtered_claim_ids(
  p_hod_approver_emp => (select approver_employee_id from approval_history limit 1)
);
```

- [x] **Step 2: Run the probes and record plans**

Run each statement against the dev project. Capture the plans into the PR description.
Expected acceptance gate: the finance-action `EXISTS` uses `idx_finance_actions_claim_latest` (or `idx_finance_actions_claim_id`); the HOD `EXISTS` uses `idx_approval_history_claim_acted_at_id`; the outer scan over `expense_claims` is not a full seq scan on the filtered cases.

- [x] **Step 3: Add candidate index only if a probe shows a seq scan**

If (and only if) probe #1 shows a seq scan on `finance_actions` driven by the `action` predicate, create
`supabase/migrations/20260618090200_finance_actions_action_acted_at_idx.sql`:

```sql
create index if not exists idx_finance_actions_action_acted_at
  on public.finance_actions (action, acted_at desc);
```

Re-run probe #1; confirm the plan improves. If no seq scan was observed, skip this step and note "no new index needed" in the PR.

- [x] **Step 4: Checkpoint**

Stage `scripts/finance-resolver-explain.sql` (and the index migration if created) and STOP for the owner to review and commit.

---

## Phase 1 Exit Criteria

**Phase 1a (correctness) — required before any consumer rewiring:**

- `finance_action_buckets()` and `finance_filtered_claim_ids()` exist in the dev DB.
- Parity gate is **green** across the full matrix: `set==set` and `count==count` vs the old implementation on the same dataset (correctness is parity, never a fixed number).
- Timing table recorded for information; any unexplained `>2×` case noted for Phase 1b. (Timings do **not** gate Phase 1a.)
- No application code changed or deleted; the shipped `SAFE_IN_BATCH_SIZE` stop-gap remains the live safety net.

> Phase 1a proves the resolver is **correct** (identical results to today); it does not by itself prove the resolver is **optimally performant** — that is Phase 1b's job (`EXPLAIN ANALYZE` + indexes).

**Phase 1b (performance) — fast follow:**

- `EXPLAIN ANALYZE` plans recorded for the resolver; no full seq scans on the hot paths; the candidate index added only if a probe proved it necessary.

When Phase 1a holds, the resolver is trusted and the **next plans** can be written:

- Phase 2 — analytics RPCs (`get_finance_history_metrics`, `get_finance_queue_metrics`) + rewire `history-analytics.query.ts` / `analytics.query.ts`.
- Phase 3 — keyset list RPCs (`get_finance_history_page`, `get_finance_queue_page`) + rewire repos.
- Phase 4 — `get_finance_export_rows` + rewire export routes.
- Phase 5 — delete `getFilteredClaimIdsForFinance` + collect/chunk helpers + `getActionFilteredClaimIds` + approvals dead code; remove the `SAFE_IN_BATCH_SIZE` stop-gap.

```

```
