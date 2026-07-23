# Finance DB-side Filtering — Phase 4 (Exports) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
>
> **Commits:** The repo owner handles all git commits. "Checkpoint" = _stage + STOP_; do NOT run `git commit`.
>
> **Prerequisite:** Phase 3 green (`get_finance_history_page` keyset pagination live), because the row-dump export streams the same paginated feed.

**Goal:** Remove the unbounded in-memory accumulation from the two finance CSV exports — replace the
payment-journals "page through everything and sum in a Map/Set" loop with one DB-side aggregate query,
and ensure the bc-expense row dump streams the Phase-3 SQL keyset pages (bounded per page) rather than
collecting IDs.

**Architecture:** Payment-journals is an **aggregation** (per-employee totals), so it becomes a single
streamed `GROUP BY` RPC (`get_finance_payment_journal_totals`) over the resolver scope — one query,
result bounded by employee count. The bc-expense **row dump** keeps CSV streaming but each page is a
bounded `get_finance_history_page` call (already correct after Phase 3); any residual ID-collection is
removed.

> **Bounded-memory invariant (Phase 4):** No export path may materialize claim-ID collections, Maps, or
> Sets whose size grows with claim count.
> **Allowed:** payment-journals memory `<= employee count` (the per-employee `Map`); bc-expense memory
> `<= page size` (one page at a time).
> **Not allowed:** `seenClaimIds`-style growing Sets, cross-page arrays/Sets/Maps of rows or IDs.
>
> **Streaming guarantee (bc-expense):** only **one** page of rows exists in memory at any time — no
> cross-page arrays, no cross-page Sets, no cross-page Maps.
>
> **Export-scale statement:** exports must execute successfully against the **current dataset
> (~17k claims)** without unbounded memory growth, and continue to as the dataset grows.

**Tech Stack:** PostgreSQL/Supabase; Next.js route handlers; Vitest.

## Reference

- Spec §6.6 (single streamed query)
- Routes: `src/app/(app)/approved-history/payment-journals-export/route.ts`, `src/app/(app)/approved-history/bc-expense-export/route.ts`
- Aggregation helpers used today: `accumulatePaymentJournalsEmployeeTotals`, `buildPaymentJournalsRows` (in the payment-journals route module / its helpers)

## File Structure

- Create: `supabase/migrations/20260618093000_get_finance_payment_journal_totals.sql`
- Create: `src/features/finance/data/rpc/finance-export.rpc.ts` (wrapper)
- Modify: `src/app/(app)/approved-history/payment-journals-export/route.ts`
- Modify: `src/app/(app)/approved-history/bc-expense-export/route.ts`
- Create/Modify: `src/app/(app)/approved-history/*/__tests__/route.test.ts` (existing export tests)
- Create: `scripts/finance-export-explain.sql` (Phase 4b EXPLAIN probes)

> **Why this phase exists:** Phases 1–3 eliminated unbounded filtering and pagination. **Phase 4 removes
> the final export-specific accumulation paths so all finance read flows operate with bounded-memory
> characteristics.**

> **Sub-phases:** **Phase 4a (Tasks 1–5)** establishes **correctness** — build the aggregation RPC,
> rewire both exports, pass the export parity gate. It draws **no performance conclusions**. **Phase 4b
> (Task 6)** validates **performance & memory** — `EXPLAIN ANALYZE`, export timing, index review.

---

## Phase 4a — Correctness

### Task 1: `get_finance_payment_journal_totals` RPC (single GROUP BY)

**Files:** Create `supabase/migrations/20260618093000_get_finance_payment_journal_totals.sql`

- [ ] **Step 1: Confirm the legacy aggregation rule**

Read `accumulatePaymentJournalsEmployeeTotals` in the payment-journals route module. Note exactly:
which finance-action rows are summed (action codes / date window), which amount column, the dedup rule
(`seenClaimIds` — is the per-employee total over distinct claims or over action rows?), and the
employee key. The RPC must reproduce this precisely.

- [ ] **Step 2: Write the migration**

Skeleton (finalize the SUM target + dedup to match Step 1; pinned by parity in Task 4):

```sql
create or replace function public.get_finance_payment_journal_totals(
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
  p_feed_to            timestamptz default null
)
returns table(employee_id uuid, total_amount numeric)
language sql stable security invoker set search_path = public
as $$
  with filtered as (
    select id from public.finance_filtered_claim_ids(
      null, p_employee_id, p_employee_name, p_claim_number, p_owner_designation,
      p_hod_approver_emp, p_claim_status, p_work_location, p_action_filter,
      p_date_field, p_date_from, p_date_to
    )
  ),
  -- distinct claims that appear in the feed (matches seenClaimIds dedup)
  feed_claims as (
    select distinct fa.claim_id
    from finance_actions fa
    join filtered f on f.id = fa.claim_id
    where (p_feed_action_codes is null or fa.action = any(p_feed_action_codes))
      and (p_feed_from is null or fa.acted_at >= p_feed_from)
      and (p_feed_to   is null or fa.acted_at <= p_feed_to)
  )
  select c.employee_id, coalesce(sum(c.total_amount), 0)::numeric
  from feed_claims fc
  join expense_claims c on c.id = fc.claim_id
  group by c.employee_id;
$$;

grant execute on function public.get_finance_payment_journal_totals(
  text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz,text[],timestamptz,timestamptz
) to authenticated, service_role;
```

> **Dedup acceptance criterion (the riskiest part of Phase 4):** this RPC replaces the legacy
> `seenClaimIds` Set with `select distinct fa.claim_id`. It **must reproduce the legacy deduplication
> semantics exactly** — one contribution per distinct claim, regardless of how many `finance_actions`
> rows that claim has. The parity test (Task 5) must include a claim with **multiple finance actions,
> across multiple dates and multiple action codes** and assert the employee total is unchanged. If the
> legacy code summed per claim (not per action), `distinct fa.claim_id` is correct; if it summed per
> action row, the RPC must match that instead — confirm in Step 1 before writing the SUM.

- [ ] **Step 3: Apply; smoke test** — call with the wide payment_released window; expect ≤ (#employees) rows, no error.
- [ ] **Step 4: Checkpoint** — stage migration; STOP for owner to commit.

---

### Task 2: Export RPC wrapper

**Files:** Create `src/features/finance/data/rpc/finance-export.rpc.ts`

- [ ] **Step 1: Write the wrapper**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type PaymentJournalTotalRow = {
  employee_id: string
  total_amount: number | string
}

export async function getFinancePaymentJournalTotalsRpc(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<PaymentJournalTotalRow[]> {
  const { data, error } = await supabase.rpc(
    'get_finance_payment_journal_totals',
    args
  )
  if (error) throw new Error(error.message)
  return (data ?? []) as PaymentJournalTotalRow[]
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`. Expected: clean.
- [ ] **Step 3: Checkpoint** — stage the file; STOP for owner to commit.

---

### Task 3: Rewire payment-journals export (drop the page-accumulate loop)

**Files:** Modify `src/app/(app)/approved-history/payment-journals-export/route.ts`

- [ ] **Step 1: Replace the `for(;;)` accumulation with one RPC call**

Inside `createStreamingCsvResponse`'s producer, replace the loop over `getFinanceHistoryPaginated` +
`accumulatePaymentJournalsEmployeeTotals` (and the `seenClaimIds` / `totalsByEmployeeId` accumulators)
with a single RPC call, then feed `buildPaymentJournalsRows`:

```ts
;async () => {
  const feedActionCodes =
    /* same computation the history feed uses for these filters */ null
  const useIst = /* action/submitted/hod date field */ false
  const totals = await getFinancePaymentJournalTotalsRpc(supabase, {
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
    p_feed_action_codes: feedActionCodes,
    p_feed_from: /* IST from when action-date filter */ null,
    p_feed_to: null,
  })

  const totalsByEmployeeId = new Map<string, number>(
    totals.map((t) => [t.employee_id, Number(t.total_amount)])
  )
  return buildPaymentJournalsRows({ totalsByEmployeeId, defaults })
}
```

Remove the `for(;;)`, `seenClaimIds`, and `accumulatePaymentJournalsEmployeeTotals` import/usage.

- [ ] **Step 2: Run the existing export route test** — `npx vitest run src/app/(app)/approved-history/payment-journals-export/__tests__/route.test.ts`. Update mocks to stub the RPC. Expected: green.
- [ ] **Step 3: Checkpoint** — stage the route + test; STOP for owner to commit.

---

### Task 4: bc-expense export — stream bounded SQL pages (no ID collection)

**Files:** Modify `src/app/(app)/approved-history/bc-expense-export/route.ts`

- [ ] **Step 1: Point the CSV fetcher at the Phase-3 paginated feed**

Confirm the bc-expense `fetcher` obtains its rows from `getFinanceHistoryPaginated` (now SQL-keyset
after Phase 3) and simply maps each bounded page to CSV lines. Remove any local ID-collection or
`for(;;)` that accumulates across pages outside the CSV stream. The `createStreamingCsvResponse` loop
is the correct streaming mechanism — each iteration now fetches a bounded SQL keyset page, so memory
stays bounded. No new RPC is required for the row dump.

> If bc-expense currently builds its own filtered-ID set (not via `getFinanceHistoryPaginated`),
> replace that with `getFinanceHistoryPaginated` paging; the per-page rows are already bounded.

> **Streaming acceptance criteria (why bc-expense scales):**
>
> - At most **one page of rows** exists in application memory at a time.
> - The CSV stream **never accumulates previously emitted pages** — each page is encoded and flushed,
>   then dropped. No cross-page array/Set/Map of rows or IDs is retained.

- [ ] **Step 2: Run the bc-expense route test** — `npx vitest run src/app/(app)/approved-history/bc-expense-export/__tests__/route.test.ts`. Expected: green.

- [ ] **Step 3: Architectural assertion — no export-side accumulation remains**

The goal is not just removing one loop; it's eliminating `filter → collect ids → grow maps → aggregate
in Node`. Verify:

```bash
rg -n "seenClaimIds|totalsByEmployeeId.*set|collect.*Ids|SAFE_IN_BATCH_SIZE" \
  "src/app/(app)/approved-history"
```

Expected: **zero matches.** (The payment-journals route may still build a `Map` from the RPC's
per-employee result — that is bounded by employee count and is fine — but no Set/Map whose size grows
with **claim** count may remain.)

- [ ] **Step 4: Checkpoint** — stage the route + test; STOP for owner to commit.

---

### Task 5: Export parity gate

**Files:** extend `src/features/finance/__tests__/finance-analytics-parity.test.ts` or new `finance-export-parity.test.ts`

- [ ] **Step 1: Assert export equality on the same dataset**

Opt-in `PARITY=1`, dynamic fixtures. For the **payment-journals** path, across the filter matrix, assert
the per-employee totals from `get_finance_payment_journal_totals` equal the legacy
`accumulatePaymentJournalsEmployeeTotals` output when paging the legacy history. Assert **all** of:

- **employee count identical** (same number of employee rows),
- **employees present identical** (same set of `employee_id`s),
- **per-employee totals identical**,
- **grand total identical** (`sum` of all totals) — this catches subtle dedup bugs around `seenClaimIds`
  / distinct claims / action rows that a per-employee spot check would miss.

For **bc-expense**: assert the streamed row set (claim/action IDs, in order) equals the legacy streamed set.

- [ ] **Step 2: Dedup regression case** — include a claim with multiple finance actions across multiple
      dates and action codes; assert it contributes to its employee total exactly once (matching legacy).

- [ ] **Step 3: Run the gate** — Expected: ALL PASS (counts, sets, totals, grand total, dedup identical). Fix on mismatch.
- [ ] **Step 4: Checkpoint** — stage the test; STOP for owner to commit.

---

## Phase 4b — Performance & memory (sub-phase)

> Timings and plans here are **informational, for investigation only**. The hard release gate for
> Phase 4 is the export **parity** gate (Task 5).

### Task 6: `EXPLAIN ANALYZE` for the export aggregation

**Files:** Create `scripts/finance-export-explain.sql`

- [ ] **Step 1: Write the EXPLAIN probes**

```sql
-- Payment-journals aggregation plan probes. Aggregation plans matter at ~17k claims.

-- Wide payment_released window.
explain (analyze, buffers)
select * from public.get_finance_payment_journal_totals(
  p_date_field => 'payment_released_date',
  p_date_from  => '2025-09-01T00:00:00+05:30',
  p_date_to    => '2026-05-31T23:59:59.999+05:30');

-- No filters.
explain (analyze, buffers)
select * from public.get_finance_payment_journal_totals();

-- Employee filter / action filter (use a real employee + an action code).
explain (analyze, buffers)
select * from public.get_finance_payment_journal_totals(
  p_action_filter => 'finance_rejected');
```

- [ ] **Step 2: Run + record plans** — Acceptance: **no pathological plans**; the `GROUP BY employee_id`
      aggregates over the resolver-scoped set without scanning the whole of `finance_actions`/`expense_claims`
      unjustifiably. Any unexpected large-relation scan investigated and justified in the PR.
- [ ] **Step 3: Index only if justified** — add + re-probe + record, or note "no new index needed".
- [ ] **Step 4: Memory validation** — confirm (by inspection / a manual large-export run) that the
      payment-journals route holds only the per-employee `Map` (bounded by employee count) and bc-expense
      holds only one page at a time. Record the observation in the PR.
- [ ] **Step 5: Checkpoint** — stage `scripts/finance-export-explain.sql` (and any index migration); STOP for owner to commit.

---

## Phase 4 Exit Criteria

**Phase 4a (correctness) — required before relying on the new path:**

- Payment-journals export uses one `GROUP BY` RPC; no `for(;;)` accumulation, no `seenClaimIds` growth.
- bc-expense export streams bounded SQL keyset pages; no cross-page ID/row collection.
- **Bounded-memory success criteria (the point of Phase 4):**
  - No export path materializes unbounded claim-ID collections, Maps, or Sets whose size grows with claim count.
  - Export memory is bounded by **employee count** (payment journals) and **page size** (bc-expense).
  - `rg` shows zero `seenClaimIds` / claim-growing `Map`/`Set` / collect / `SAFE_IN_BATCH_SIZE` in `approved-history`.
- **Dedup:** the aggregation RPC reproduces legacy deduplication semantics exactly (verified by the multi-action regression case).
- Export parity gate **green**: employee count, employees present, per-employee totals, grand total, and bc-expense row set all identical to legacy.
- Phase 4a proves **behavioral equivalence only**.

**Phase 4b (performance & memory) — fast follow:**

- `EXPLAIN ANALYZE` plans recorded for the aggregation (wide / no-filter / filtered shapes); no pathological plans; unexpected scans justified.
- Memory behavior validated (employee-bounded aggregation; one-page-at-a-time streaming).
- Any new index justified by measurements.
- Phase 4b validates performance characteristics and memory behavior **separately** from correctness.
