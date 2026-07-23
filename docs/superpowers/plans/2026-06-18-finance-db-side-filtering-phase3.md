# Finance DB-side Filtering — Phase 3 (List Pages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
>
> **Commits:** The repo owner handles all git commits. "Checkpoint" = _stage + STOP_; do NOT run `git commit`.
>
> **Prerequisite:** Phase 1a green (resolver parity-validated). Phase 2 not strictly required but recommended first.

**Goal:** Replace the chunked `.in()` + in-memory merge/sort in the Finance Queue list and Approved History feed with SQL **keyset ID-page** RPCs, so filtering + pagination happen in Postgres and only a bounded page of IDs (≤ limit+1) ever returns to Node.

**Architecture:** Two SQL functions return the keyset-ordered page of IDs:
`get_finance_queue_page` → ordered `expense_claims.id` page; `get_finance_history_page` → ordered
`finance_actions` page. The app then fetches the rich rows for just that bounded page via the existing
PostgREST projection with a page-bounded `.in('id', pageIds)` (the same safe enrichment pattern already
used by approvals/admin), and maps them unchanged. This keeps the large nested `CLAIM_COLUMNS`
projection in PostgREST (no need to port it to SQL) while moving filtering/pagination server-side.

> **Bounded-memory invariant (Phase 3):** No pagination path may materialize more than `limit + 1` IDs
> in application memory.
> **Allowed:** `pageIds.length <= limit`, `pageRows.length <= limit + 1`.
> **Not allowed:** collecting all filtered IDs, cross-page accumulation, chunking.

**Tech Stack:** PostgreSQL/Supabase; `@supabase/supabase-js`; Vitest.

## Reference

- Spec §6.4, §6.5
- TS consumers: `finance-queue.repository.ts` (`getFinanceQueuePaginated`), `finance-history.repository.ts` (`getFinanceHistoryPaginated`)
- Projections: `CLAIM_COLUMNS`, `mapClaimRow` (`@/features/claims/data/queries`); `FINANCE_OWNER_COLUMNS`, `normalizeFinanceOwner` (`finance-shared.repository.ts`)
- Cursor utils: `encodeCursor`, `decodeCursor` (`@/lib/utils/pagination`)
- History feed action-scoping logic: `finance-history.repository.ts:95-111`

## File Structure

- Create: `supabase/migrations/20260618092000_get_finance_queue_page.sql`
- Create: `supabase/migrations/20260618092100_get_finance_history_page.sql`
- Modify: `src/features/finance/data/repositories/finance-queue.repository.ts`
- Modify: `src/features/finance/data/repositories/finance-history.repository.ts`
- Create: `src/features/finance/__tests__/finance-list-parity.test.ts`
- Create: `scripts/finance-list-explain.sql` (Phase 3b EXPLAIN probes)

> **Sub-phases:** **Phase 3a (Tasks 1–5)** establishes **correctness** — build the page RPCs, rewire the
> repositories, pass the list parity gate. It draws **no performance conclusions**. **Phase 3b
> (Task 6)** validates **performance** — `EXPLAIN ANALYZE`, cursor-paging behaviour across pages, index
> review. Phase 3a is the hard gate; Phase 3b is a fast follow.

---

## Phase 3a — Correctness

### Task 1: `get_finance_queue_page` (keyset ID page)

**Files:** Create `supabase/migrations/20260618092000_get_finance_queue_page.sql`

- [ ] **Step 1: Write the migration**

```sql
create or replace function public.get_finance_queue_page(
  p_required_status_id uuid,                        -- finance-review status (required scope)
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
  -- `base` is the status-scoped, cursor-bounded candidate set. The resolver is
  -- applied as a JOIN (clearer plans / easier to EXPLAIN than IN (SELECT ...)),
  -- guarded by p_has_filters so the no-filter fast path skips the resolver entirely.
  with base as (
    select ec.id, ec.created_at
    from expense_claims ec
    where ec.status_id = p_required_status_id
      and (
        p_cursor_created_at is null
        or ec.created_at < p_cursor_created_at
        or (ec.created_at = p_cursor_created_at and ec.id < p_cursor_id)
      )
  )
  select b.id, b.created_at
  from base b
  join public.finance_filtered_claim_ids(
    p_required_status_id, p_employee_id, p_employee_name, p_claim_number,
    p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
    p_action_filter, p_date_field, p_date_from, p_date_to
  ) f on f.id = b.id
  where p_has_filters
  union all
  select b.id, b.created_at
  from base b
  where not p_has_filters
  -- DETERMINISTIC keyset order: id is the REQUIRED secondary sort key — never remove it.
  order by created_at desc, id desc
  limit p_limit + 1;
$$;

grant execute on function public.get_finance_queue_page(
  uuid,boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz,
  timestamptz,uuid,integer
) to authenticated, service_role;
```

> The resolver already applies `p_required_status_id`; the `base` CTE repeats `ec.status_id =
p_required_status_id` so the no-filter branch (`p_has_filters=false`) stays correctly scoped without
> calling the resolver. `p_has_filters` is a constant per call, so the planner prunes the inactive
> `union all` branch. Uses `idx_expense_claims_created_at_id` + `idx_ec_status_id`.

- [ ] **Step 2: Apply; smoke test keyset shape**

Run:

```sql
select * from public.get_finance_queue_page(
  (select id from claim_statuses where approval_level=3 and is_approval=false
     and is_rejection=false and is_terminal=false and is_active limit 1),
  p_limit => 5);
```

Expected: ≤ 6 rows ordered by `created_at desc, id desc`, no error.

- [ ] **Step 3: Checkpoint** — stage migration; STOP for owner to commit.

---

### Task 2: `get_finance_history_page` (keyset action-feed ID page)

**Files:** Create `supabase/migrations/20260618092100_get_finance_history_page.sql`

- [ ] **Step 1: Write the migration**

The Approved History feed is `finance_actions` rows scoped to matching claims, filtered by feed action
codes + date, keyset by `(acted_at, id)`. `p_action_codes` is the small bounded list the TS wrapper
computes today (`getFinanceActionCodesForDateFilter` / `getFinanceActionCodesForFilter`).

```sql
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
  p_feed_action_codes  text[]      default null,   -- bounded feed-row action filter
  p_feed_from          timestamptz default null,   -- action-date feed window (IST)
  p_feed_to            timestamptz default null,
  p_cursor_acted_at    timestamptz default null,
  p_cursor_id          uuid        default null,
  p_limit              integer     default 10
)
returns table(id uuid, claim_id uuid, acted_at timestamptz)
language sql stable security invoker set search_path = public
as $$
  -- `base` = feed-action/date/cursor-bounded finance_actions rows. Resolver applied
  -- as a JOIN (clearer plans than IN (SELECT ...)), guarded by p_has_filters.
  with base as (
    select fa.id, fa.claim_id, fa.acted_at
    from finance_actions fa
    where (p_feed_action_codes is null or fa.action = any(p_feed_action_codes))
      and (p_feed_from is null or fa.acted_at >= p_feed_from)
      and (p_feed_to   is null or fa.acted_at <= p_feed_to)
      and (
        p_cursor_acted_at is null
        or fa.acted_at < p_cursor_acted_at
        or (fa.acted_at = p_cursor_acted_at and fa.id < p_cursor_id)
      )
  )
  select b.id, b.claim_id, b.acted_at
  from base b
  join public.finance_filtered_claim_ids(
    null, p_employee_id, p_employee_name, p_claim_number, p_owner_designation,
    p_hod_approver_emp, p_claim_status, p_work_location, p_action_filter,
    p_date_field, p_date_from, p_date_to
  ) f on f.id = b.claim_id
  where p_has_filters
  union all
  select b.id, b.claim_id, b.acted_at
  from base b
  where not p_has_filters
  -- DETERMINISTIC keyset order: id is the REQUIRED secondary sort key — never remove it.
  order by acted_at desc, id desc
  limit p_limit + 1;
$$;

grant execute on function public.get_finance_history_page(
  boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz,
  text[],timestamptz,timestamptz,timestamptz,uuid,integer
) to authenticated, service_role;
```

Uses `idx_finance_actions_claim_latest` / `idx_finance_actions_acted_at_id`.

- [ ] **Step 2: Apply; smoke test** — `select * from public.get_finance_history_page(p_limit => 5);` Expected: ≤ 6 rows ordered by `acted_at desc, id desc`, no error.
- [ ] **Step 3: Checkpoint** — stage migration; STOP for owner to commit.

---

### Task 3: Rewire `getFinanceQueuePaginated`

**Files:** Modify `src/features/finance/data/repositories/finance-queue.repository.ts`

- [ ] **Step 1: Replace ID-collection + chunk/merge with the page RPC + bounded enrichment**

```ts
export async function getFinanceQueuePaginated(
  supabase: SupabaseClient,
  cursor: string | null,
  limit = 10,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<PaginatedFinanceQueue> {
  const { data: financeStatusRow } = await supabase
    .from('claim_statuses')
    .select('id')
    .eq('approval_level', 3)
    .eq('is_rejection', false)
    .eq('is_terminal', false)
    .eq('is_approval', false)
    .eq('is_active', true)
    .maybeSingle()

  if (!financeStatusRow)
    return { data: [], hasNextPage: false, nextCursor: null, limit }

  const hasFilters = hasFinanceClaimFilters(filters)
  const useIst =
    filters.dateFilterField === 'payment_released_date' ||
    filters.dateFilterField === 'finance_approved_date' ||
    filters.dateFilterField === 'submitted_at' ||
    filters.dateFilterField === 'hod_approved_date'
  const decoded = cursor ? decodeCursor(cursor) : null

  const { data: pageRows, error: pageError } = await supabase.rpc(
    'get_finance_queue_page',
    {
      p_required_status_id: financeStatusRow.id,
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
      p_cursor_created_at: decoded?.created_at ?? null,
      p_cursor_id: decoded?.id ?? null,
      p_limit: limit,
    }
  )
  if (pageError) throw new Error(pageError.message)

  const idRows = (pageRows ?? []) as Array<{ id: string; created_at: string }>
  const hasNextPage = idRows.length > limit
  const pageIdRows = hasNextPage ? idRows.slice(0, limit) : idRows
  const pageIds = pageIdRows.map((r) => r.id)

  if (pageIds.length === 0)
    return { data: [], hasNextPage: false, nextCursor: null, limit }

  // Bounded enrichment (≤ limit ids): rich projection stays in PostgREST.
  const { data: claimRows, error: claimError } = await supabase
    .from('expense_claims')
    .select(
      `${CLAIM_COLUMNS}, employees!employee_id!inner(${FINANCE_OWNER_COLUMNS})`
    )
    .in('id', pageIds)
  if (claimError) throw new Error(claimError.message)

  // Preserve keyset order from the RPC (PostgREST .in does not guarantee order).
  const byId = new Map(
    (claimRows ?? []).map((r) => [(r as { id: string }).id, r])
  )
  const ordered = pageIds
    .map((id) => byId.get(id))
    .filter(Boolean) as ExpenseClaimWithOwnerRow[]

  const data = ordered.map((row) => {
    const owner = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees
    return {
      ...(mapClaimRow(row as never) as Claim),
      owner: normalizeFinanceOwner(owner),
    }
  })

  const last = pageIdRows[pageIdRows.length - 1]
  const nextCursor = hasNextPage
    ? encodeCursor({ created_at: last.created_at, id: last.id })
    : null
  return { data, hasNextPage, nextCursor, limit }
}
```

Delete the `SAFE_IN_BATCH_SIZE`, `buildQueuePageQuery`, and chunk/merge code. Keep `getClaimAvailableActionsByClaimIds` if the queue page used it (call it on `pageIds`, page-bounded).

> Verify the exact final mapping (owner field name, available-actions) against the current file —
> reproduce today's output shape exactly; the parity test (Task 5) enforces it.

- [ ] **Step 2: Typecheck + unit tests** — `npx tsc --noEmit`; `npx vitest run src/features/finance/__tests__/`. Expected: green (update mock-based queue tests to the new call shape).
- [ ] **Step 3: Checkpoint** — stage the file; STOP for owner to commit.

---

### Task 4: Rewire `getFinanceHistoryPaginated`

**Files:** Modify `src/features/finance/data/repositories/finance-history.repository.ts`

- [ ] **Step 1: Replace ID-collection + chunk/merge with the page RPC + bounded enrichment**

Compute the feed action codes in TS exactly as today (`getFinanceActionCodesForDateFilter` for action-date filters, else `getFinanceActionCodesForFilter(actionFilter)`), pass them as `p_feed_action_codes`. Call `get_finance_history_page`, take the ≤limit page of `finance_actions` ids, then fetch those bounded action rows with the actor embed and enrich claims — reusing the file's existing enrichment helpers on `pageClaimIds` (already page-bounded):

```ts
const feedActionCodes = filterByFinanceActionDate
  ? resolvedDateFilterActions
  : filters.actionFilter
    ? getFinanceActionCodesForFilter(filters.actionFilter)
    : null

const decoded = cursor ? decodeCursor(cursor) : null
const { data: pageRows, error: pageError } = await supabase.rpc(
  'get_finance_history_page',
  {
    p_has_filters: hasFinanceClaimFilters(filters),
    p_employee_id: filters.employeeId,
    p_employee_name: filters.employeeName,
    p_claim_number: filters.claimNumber,
    p_owner_designation: filters.ownerDesignation,
    p_hod_approver_emp: filters.hodApproverEmployeeId,
    p_claim_status: filters.claimStatus,
    p_work_location: filters.workLocation,
    p_action_filter: filters.actionFilter,
    p_date_field: filters.dateFilterField,
    p_date_from: /* IST when action/submitted/hod date */ null,
    p_date_to: null,
    p_feed_action_codes: feedActionCodes,
    p_feed_from: filterByFinanceActionDate
      ? toIstDayStart(filters.dateFrom)
      : null,
    p_feed_to: filterByFinanceActionDate ? toIstDayEnd(filters.dateTo) : null,
    p_cursor_acted_at: decoded?.created_at ?? null, // existing cursor encodes acted_at in created_at
    p_cursor_id: decoded?.id ?? null,
    p_limit: limit,
  }
)
if (pageError) throw new Error(pageError.message)

const idRows = (pageRows ?? []) as Array<{
  id: string
  claim_id: string
  acted_at: string
}>
const hasNextPage = idRows.length > limit
const pageRowsBounded = hasNextPage ? idRows.slice(0, limit) : idRows
const actionIds = pageRowsBounded.map((r) => r.id)
if (actionIds.length === 0)
  return { data: [], hasNextPage: false, nextCursor: null, limit }

// Bounded fetch of the action rows (≤ limit) with the actor embed.
const { data: actionRowsData, error: actionErr } = await supabase
  .from('finance_actions')
  .select(
    'id, claim_id, actor_employee_id, action, notes, acted_at, actor:employees!actor_employee_id(employee_email, employee_name)'
  )
  .in('id', actionIds)
if (actionErr) throw new Error(actionErr.message)
// reorder to keyset order, then run the file's existing claim enrichment on the page claim ids.
```

Re-use the remainder of the current function (claim enrichment via `.in('id', pageClaimIds)`, available-actions, row mapping, `encodeCursor`). Delete `SAFE_IN_BATCH_SIZE` and the chunk/merge branch. **Important parity detail:** the `p_date_from/p_date_to` passed to the resolver vs the `p_feed_*` window must match today's behavior — for action-date filters the date scopes the FEED rows (`p_feed_*`), and the resolver membership is by claim; confirm against the current file and the parity test.

- [ ] **Step 2: Typecheck + unit tests** — `npx tsc --noEmit`; `npx vitest run src/features/finance/__tests__/`. Expected: green.

- [ ] **Step 3: Architectural assertion — no collection / chunk / merge remains**

The success criterion of Phase 3 is `filters → SQL pagination → bounded enrichment`, **not**
`filters → collect ids → chunks → merge → paginate`. Verify both repos:

```bash
rg -n "SAFE_IN_BATCH_SIZE|collect.*Ids|chunk|Promise\.all.*\.in\(" \
  src/features/finance/data/repositories/finance-queue.repository.ts \
  src/features/finance/data/repositories/finance-history.repository.ts
```

Expected: **zero matches.** Also confirm by inspection that every `.in('id', …)` / `.in('claim_id', …)`
in these files is fed a **page-bounded** array (≤ `limit` ids derived from the page RPC result), never a
filter-derived set. No code path may materialize more than `limit + 1` IDs in application memory for
pagination.

- [ ] **Step 4: Checkpoint** — stage the file; STOP for owner to commit.

---

### Task 5: List parity gate (release gate, blocking)

**Files:** Create `src/features/finance/__tests__/finance-list-parity.test.ts`

- [ ] **Step 1: Write the parity test**

Opt-in `PARITY=1`, dynamic fixtures, same matrix as Phase 1. For each filter case, page through BOTH
the legacy implementation (git-stashed behavior reproduced by calling the pre-swap code path — keep a
copy of the old functions as `getFinanceQueuePaginatedLegacy` / `…HistoryLegacy` temporarily, or run
the test against the pre-swap commit) and the new RPC-backed implementation, collecting the full
ordered ID sequence across all pages. Assert:

- identical ordered ID sequence (page order + contents),
- identical `hasNextPage` progression,
- identical total row count.

The simplest robust form: assert the **new** implementation's concatenated ordered IDs equal the IDs
produced by `finance_filtered_claim_ids` joined + ordered the same way (a direct SQL reference query),
since Phase 1 already proved the resolver set is correct. Compare against a reference SQL:

```sql
-- queue reference order
select ec.id from expense_claims ec
join finance_filtered_claim_ids(<args>) f on f.id = ec.id
where ec.status_id = <finance_status>
order by ec.created_at desc, ec.id desc;
```

- [ ] **Step 2: Add cursor edge-case tests (this is where pagination bugs hide)**

Beyond the filter matrix, add explicit keyset-cursor cases for **both** page RPCs:

- **First page** (`cursor = null`) — returns the newest `limit` rows, `hasNextPage` correct.
- **Middle page** (cursor from a prior page) — no overlap with, and no gap after, the previous page.
- **Last page** (cursor near the end) — returns the final rows, `hasNextPage = false`, `nextCursor = null`.
- **Empty page** (filter that matches nothing, and cursor past the end) — returns `[]`, `hasNextPage = false`.
- **Duplicate timestamps** — seed/locate ≥ 3 rows sharing the same `created_at` (queue) / `acted_at`
  (history); page through them with `limit = 1` and assert every row appears **exactly once**, in
  `id desc` order, with no row skipped or repeated across the page boundary. This is the case the
  `id` tie-breaker exists for.

Assert the full concatenated ordered ID sequence across all pages equals the single-query reference
ordering (no duplicates, no omissions).

- [ ] **Step 3: Verify skip without PARITY** — Expected: skipped.
- [ ] **Step 4: Run the gate** — Expected: ALL cases PASS (ordered ID parity + pagination parity + every cursor edge case). Fix RPC SQL on mismatch; do not proceed until green.
- [ ] **Step 5: Tie-breaker assertion** — Confirm both page RPCs order by `(<time> desc, id desc)`. Pagination ordering **must be deterministic**: `id` is a mandatory tie-breaker and must never be removed. The duplicate-timestamp case above is the proof.
- [ ] **Step 6: Checkpoint** — stage the test; STOP for owner to commit.

---

## Phase 3b — Performance & cursor paging (sub-phase)

> Performance plans and timings here are **informational, for investigation only**. The hard release
> gate for Phase 3 is the list **parity** gate (Task 5). Timings are noisy (shared DB, cold starts, CI).

### Task 6: `EXPLAIN ANALYZE` for the page RPCs

**Files:** Create `scripts/finance-list-explain.sql`

- [ ] **Step 1: Write the EXPLAIN probes**

```sql
-- List page RPC plan probes. Inspect for pathological plans on the hot paths.

-- Queue page: no filters (fast path), first page.
explain (analyze, buffers)
select * from public.get_finance_queue_page(
  (select id from claim_statuses where approval_level=3 and is_approval=false
     and is_rejection=false and is_terminal=false and is_active limit 1),
  p_has_filters => false, p_limit => 10);

-- Queue page: filters active (wide payment_released window), first page.
explain (analyze, buffers)
select * from public.get_finance_queue_page(
  (select id from claim_statuses where approval_level=3 and is_approval=false
     and is_rejection=false and is_terminal=false and is_active limit 1),
  p_has_filters => true, p_date_field => 'payment_released_date',
  p_date_from => '2025-09-01T00:00:00+05:30', p_date_to => '2026-05-31T23:59:59.999+05:30',
  p_limit => 10);

-- Queue page: a MIDDLE page (cursor set) — proves keyset paging stays index-driven.
explain (analyze, buffers)
select * from public.get_finance_queue_page(
  (select id from claim_statuses where approval_level=3 and is_approval=false
     and is_rejection=false and is_terminal=false and is_active limit 1),
  p_has_filters => false,
  p_cursor_created_at => (select created_at from expense_claims order by created_at desc, id desc offset 50 limit 1),
  p_cursor_id => (select id from expense_claims order by created_at desc, id desc offset 50 limit 1),
  p_limit => 10);

-- History page: no filters, action-filter, and a middle cursor page (repeat the 3 shapes).
explain (analyze, buffers)
select * from public.get_finance_history_page(p_limit => 10);
```

- [ ] **Step 2: Run the probes and record plans in the PR**

Acceptance (performance): **no pathological plans on the hot list paths.** First-page and middle-page
keyset reads should use `idx_expense_claims_created_at_id` / `idx_finance_actions_acted_at_id` and
**not** sort the whole relation. Unexpected scans on large relations (`expense_claims`,
`finance_actions`) must be **investigated and justified** in the PR.

- [ ] **Step 3: Add an index only if a probe justifies it** — add + re-probe + record before/after, or note "no new index needed".

- [ ] **Step 4: Checkpoint** — stage `scripts/finance-list-explain.sql` (and any index migration); STOP for owner to commit.

---

## Phase 3 Exit Criteria

**Phase 3a (correctness) — required before relying on the new path:**

- `get_finance_queue_page` / `get_finance_history_page` exist and keyset-paginate in SQL (resolver applied as a JOIN, guarded by `p_has_filters`).
- Both list repos call the page RPCs and enrich only the bounded page via `.in('id', pageIds)`.
- **Bounded-memory success criteria (the architectural win):**
  - No code path materializes more than `limit + 1` IDs in application memory for pagination.
  - Every `.in('id', …)` / `.in('claim_id', …)` call is page-bounded (≤ `limit` IDs).
  - `rg` shows zero `SAFE_IN_BATCH_SIZE` / collect / chunk / `Promise.all(...).in(` matches in either list repo.
- **Determinism:** both RPCs order by `(<time> desc, id desc)`; `id` is the required secondary sort key and is never removed.
- List parity gate **green**: ordered ID sequence + `hasNextPage` progression + total count identical to legacy on the same dataset.
- Phase 3a proves **behavioral equivalence only** — it does not prove optimal pagination performance.

**Phase 3b (performance) — fast follow:**

- `EXPLAIN ANALYZE` plans recorded for first-page, filtered, and middle-cursor shapes of both RPCs.
- No pathological plans on hot paths; keyset reads stay index-driven; any unexpected large-relation scan investigated and justified.
- Any new index justified by measurements (before/after plans recorded).
- Phase 3b validates query plans and cursor performance **separately** from correctness.
