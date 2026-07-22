# Finance DB-side Filtering — Design Spec

- **Date:** 2026-06-18
- **Status:** Draft (awaiting review)
- **Author:** Engineering
- **Scope:** Finance role read paths (Approved History, Finance Queue, finance analytics, finance exports)

---

## 1. Problem

Finance read paths resolve their filters **in the application**: `getFilteredClaimIdsForFinance()`
walks `expense_claims` / `finance_actions` / `approval_history` page by page, accumulating up to
`MAX_FILTERED_CLAIM_IDS = 10_000` claim UUIDs into a `Set`. That array is then:

- inlined into `.in('id', [...])` for list pages (re-chunked at `SAFE_IN_BATCH_SIZE = 150`),
- passed as `p_claim_ids uuid[]` to the metrics RPCs,
- chunk-collected again for exports.

### Confirmed failure (live evidence)

Filtering Approved History by `payment_released_date` over `2025-09-01 .. 2026-05-31` resolved to
**638** candidate claim IDs. The old code inlined all 638 into one `.in('id', …)`, producing a
**~23 KB GET URL** that the Supabase gateway rejected with a bare `400 Bad Request`
(thrown at `finance-filters.repository.ts:416`). Narrow ranges (88 IDs → ~3 KB) worked; the wide
range did not. Verified in the Supabase API logs (`GET | 400 | …/expense_claims?…&id=in.(430f519f…`).

A stop-gap (`SAFE_IN_BATCH_SIZE` chunking in `finance-filters.repository.ts`) has shipped and keeps
the page working, but the root cause — **growing in-memory ID materialization** — remains. It scales
with data, requires every consumer to chunk/merge, and is fragile.

### Scope confirmation (evidence-based)

The unbounded in-memory pattern is **contained to the Finance role**. HOD / SBH / ZBH, Admin, and the
Employee/User side already use DB-side RPCs (`pending-summary.rpc`, `approval-history.rpc`,
`approval-analytics.rpc`, `get_admin_summary_counts`, `get_employee_claim_metrics`); their
`.in('id', …)` calls are page-bounded enrichment (e.g. `claimIds = pageData.slice(0, limit)`).

Two **dead, unused** functions in `approval-analytics.repository.ts` (`getFilteredClaimsByIds`,
`getLatestApprovalActionsByClaim`) would reintroduce the pattern if wired up; they are deleted here as
a guardrail.

---

## 2. Goals / Non-goals

**Goals**

- Eliminate app-side claim-ID materialization, chunking, and in-memory merge/sort from all Finance read paths.
- Make filtering, pagination, and aggregation happen in Postgres; the app sends filter **parameters** and receives one page / one aggregate / one streamed export.
- Single source of truth for "which claims match" and for finance action semantics.
- Behavior-identical to today (release-gated by parity tests).

**Non-goals**

- No change to the approver/admin/employee paths (already correct).
- No change to filter UX, query-param contract, or output shapes consumed by the UI.
- No new caching layer.
- Not migrating writes (`submit_finance_action_atomic`, etc.) — out of scope.

---

## 3. Architecture

**One canonical filter resolver + specialized consumer RPCs**, over a shared semantics layer.

```
Layer 0  Shared semantics  (single source of truth for action classification + date-field targets)
            │
Layer 1  finance_filtered_claim_ids(filters…) -> TABLE(id uuid)     "which claims match?"
            │  (pure SQL, STABLE, SECURITY INVOKER, no arrays/loops)
            ▼
Layer 2  Consumer RPCs (each JOINs the resolver):
            get_finance_history_metrics(filters…)            "give me metrics"
            get_finance_queue_metrics(filters…)              "give me metrics"
            get_finance_history_page(filters…, cursor, lim)  "give me an ID page"
            get_finance_queue_page(filters…, cursor, lim)    "give me an ID page"
            get_finance_payment_journal_totals(filters…)     "give me the export aggregate"
            (bc-expense export streams the history page RPC — no separate export RPC)
```

### Design principles (locked)

1. **Resolver returns `id` only.** Membership is its sole responsibility; `created_at` / `acted_at`
   are projection/ordering concerns owned by each consumer. (This also lets one resolver serve the
   two list paths, which order differently.)
2. **Pure SQL, no procedural collection.** `LANGUAGE sql STABLE`, a single `SELECT` with optional
   predicates `(p_x IS NULL OR …)` and `EXISTS(…)` subqueries. No `DECLARE`, no array building, no
   loops — otherwise we recreate the anti-pattern inside Postgres.
3. **Keyset pagination in SQL.** Consumers do
   `WITH filtered AS (SELECT id FROM finance_filtered_claim_ids(…)) … JOIN … ORDER BY … LIMIT p_limit`.
   Never return all IDs to TS to paginate.
4. **Separation of responsibilities.** Resolver answers _which claims match?_; consumer RPCs answer
   _metrics / page / export_.
5. **SECURITY INVOKER** (respects RLS, matches existing metrics functions).
6. **Locale stays in TS.** Date-only → IST day boundaries (`toIstDayStart/End`) is done in the thin TS
   wrapper, which passes `timestamptz` to the RPC. SQL filters on the timestamps.
7. **Bounded application memory.** No read path may materialize claim-ID collections whose size grows
   with claim count. Allowed: `≤ limit` / `≤ limit + 1` IDs (pagination), employee-count aggregates
   (exports). Not allowed: collecting all matching IDs, cursor-collect loops, chunking, cross-page
   accumulation. This is the whole point of the migration — see §3.1.
8. **Deterministic keyset ordering.** Every paginated consumer orders by `(<time> DESC, id DESC)`. `id`
   is a **mandatory tie-breaker** and must never be removed — without it, rows sharing a timestamp can
   be skipped or duplicated across page boundaries.
9. **JOIN over `IN (SELECT …)`.** Consumers compose the resolver via a `JOIN` (guarded by a
   `p_has_filters` branch where a no-filter fast path exists), not `WHERE id IN (SELECT …)` — clearer
   execution plans, easier to `EXPLAIN`, consistent with the reference SQL.

### 3.1 Architectural invariants & guardrails (permanent)

**Bounded-memory invariant.** No Finance read path may materialize claim-ID collections whose size
grows with claim count.

| Read path                              | Bounded by                  |
| -------------------------------------- | --------------------------- |
| List pages (queue, history)            | `≤ limit + 1` IDs per page  |
| Page enrichment (`.in('id', pageIds)`) | `≤ limit` IDs               |
| Export — payment journals (aggregate)  | employee count              |
| Export — bc-expense (row dump)         | one streamed page at a time |

**Forbidden** anywhere in the Finance read paths: collecting all matching claim IDs, cursor-collect
loops, `.in()` chunking + in-memory merge, cross-page ID/row accumulation (`Set`/`Map`/array growing
with claim count).

**Guardrails (established in Phase 5):**

- A CI check fails the build on any reappearance of the pattern
  (`SAFE_IN_BATCH_SIZE | collect.*Ids | intersectClaimIds | chunk | Promise.all(...).in(`).
- One durable **resolver-vs-reference-SQL** regression test remains as the architectural contract for
  `finance_filtered_claim_ids`.

**Architectural constitution.** Every Finance read flow is
`parameters → SQL resolver → SQL RPC → bounded enrichment`, and never
`parameters → collect all IDs → chunk → merge → re-query`. Any future feature requiring claim filtering
**must** compose through `finance_filtered_claim_ids()` or a resolver-backed RPC and must not introduce
application-side claim-ID collection.

---

## 4. Layer 0 — Shared semantics

Replaces JS `getFinanceActionBuckets()` (`history-analytics.query.ts`) and
`filter-date-resolvers.repository.ts`. Two helpers, both pure SQL, referenced by the resolver **and**
the metrics consumers so "match" and "bucket" can never drift.

### 4.1 Action classification

A `STABLE` SQL function (or view) labeling each finance action code, derived from `claim_statuses` +
`claim_status_transitions`:

```sql
-- Returns the action codes that belong to each finance bucket.
-- Mirrors getFinanceActionBuckets():
--   financeApproved : transitions whose to_status is approval & not rejection/terminal/
--                     payment_issued & approval_level IS NULL
--   paymentReleased : transitions whose to_status.is_payment_issued, with the 'finance_' prefix
--                     stripped (normalizeFinanceHistoryActionCode)
--   rejected        : transitions whose to_status.is_rejection (normalized)
--   approved        : financeApproved ∪ paymentReleased
create or replace function public.finance_action_buckets()
returns table(action text, is_approved bool, is_rejected bool,
              is_finance_approved bool, is_payment_released bool)
language sql stable security invoker set search_path = public
as $$
  with s as (
    select id, approval_level, is_approval, is_rejection, is_terminal,
           is_payment_issued
    from claim_statuses where is_active
  ),
  t as (
    select action_code, to_status_id from claim_status_transitions where is_active
  )
  select
    case when s.is_payment_issued and t.action_code like 'finance_%'
         then substr(t.action_code, length('finance_') + 1)
         else t.action_code end as action,
    -- approved bucket = finance_approved ∪ payment_released
    (s.is_payment_issued
       or (s.is_approval and not s.is_rejection and not s.is_terminal
           and not s.is_payment_issued and s.approval_level is null)) as is_approved,
    s.is_rejection                                                    as is_rejected,
    (s.is_approval and not s.is_rejection and not s.is_terminal
       and not s.is_payment_issued and s.approval_level is null)      as is_finance_approved,
    s.is_payment_issued                                               as is_payment_released
  from t join s on s.id = t.to_status_id
$$;
```

> Exact bucket predicates are ported **verbatim** from `getFinanceActionBuckets()` /
> `normalizeFinanceHistoryActionCode()` and validated by parity tests (§7).

### 4.2 Date-field target status / action resolution

`payment_released_date` and `finance_approved_date` scope by `finance_actions.acted_at`. The set of
matching action codes is `finance_action_buckets()` filtered to `is_payment_released` /
`is_finance_approved`. `hod_approved_date` scopes by `approval_history` against the
finance-review status (`approval_level = 3, is_approval=false, is_rejection=false, is_terminal=false,
is_active`). These are expressed inline as `EXISTS` subqueries in the resolver (§5), not materialized.

---

## 5. Layer 1 — Canonical resolver

```sql
create or replace function public.finance_filtered_claim_ids(
  p_required_status_id uuid     default null,  -- queue scope (finance review status)
  p_employee_id        text     default null,  -- ILIKE on employees.employee_id
  p_employee_name      text     default null,  -- ILIKE on employees.employee_name
  p_claim_number       text     default null,  -- exact
  p_owner_designation  uuid     default null,
  p_hod_approver_emp   uuid     default null,
  p_claim_status       text     default null,  -- '<uuid>' or '<uuid>:allow_resubmit'
  p_work_location      uuid     default null,
  p_action_filter      text     default null,  -- e.g. 'finance_rejected' | 'rejected_allow_reclaim'
  p_date_field         text     default 'claim_date',
  p_date_from          timestamptz default null,  -- IST boundary, computed in TS
  p_date_to            timestamptz default null
) returns table(id uuid)
language sql stable security invoker set search_path = public
as $$
  select c.id
  from expense_claims c
  join employees e on e.id = c.employee_id
  where
    -- claim status + allow_resubmit (parseClaimStatusFilterValue + resolve…AllowResubmit…)
    (p_required_status_id is null or c.status_id = p_required_status_id)
    and (p_claim_status is null or c.status_id = split_part(p_claim_status, ':', 1)::uuid)
    -- allow_resubmit resolution (single rule):
    --   '<uuid>:allow_resubmit' status filter  -> only allow_resubmit = true
    --   actionFilter 'rejected_allow_reclaim'  -> only allow_resubmit = true
    --   otherwise (default finance view)        -> exclude resubmit-pending duplicates
    and (
      case
        when p_claim_status like '%:allow_resubmit'       then c.allow_resubmit is true
        when p_action_filter = 'rejected_allow_reclaim'   then c.allow_resubmit is true
        else c.allow_resubmit is not true
      end
    )
    and (p_employee_id is null   or e.employee_id   ilike '%'||p_employee_id||'%')
    and (p_employee_name is null or e.employee_name ilike '%'||p_employee_name||'%')
    and (p_claim_number is null  or c.claim_number = p_claim_number)
    and (p_work_location is null or c.work_location_id = p_work_location)
    and (p_owner_designation is null or e.designation_id = p_owner_designation)
    -- date filters on claim columns
    and (p_date_field <> 'claim_date'   or p_date_from is null or c.claim_date  >= p_date_from)
    and (p_date_field <> 'claim_date'   or p_date_to   is null or c.claim_date  <= p_date_to)
    and (p_date_field <> 'submitted_at' or p_date_from is null or c.submitted_at >= p_date_from)
    and (p_date_field <> 'submitted_at' or p_date_to   is null or c.submitted_at <= p_date_to)
    -- finance-action date filters (payment_released_date / finance_approved_date)
    and (
      p_date_field not in ('payment_released_date','finance_approved_date')
      or exists (
        select 1 from finance_actions fa
        join finance_action_buckets() b on b.action = fa.action
        where fa.claim_id = c.id
          and ( (p_date_field = 'payment_released_date' and b.is_payment_released)
             or (p_date_field = 'finance_approved_date' and b.is_finance_approved) )
          and (p_date_from is null or fa.acted_at >= p_date_from)
          and (p_date_to   is null or fa.acted_at <= p_date_to)
      )
    )
    -- HOD approver and/or hod_approved_date
    and (
      (p_hod_approver_emp is null and p_date_field <> 'hod_approved_date')
      or exists (
        select 1 from approval_history ah
        join claim_statuses fs
          on fs.id = ah.new_status_id and fs.approval_level = 3
         and fs.is_approval = false and fs.is_rejection = false
         and fs.is_terminal = false and fs.is_active = true
        where ah.claim_id = c.id
          and (p_hod_approver_emp is null or ah.approver_employee_id = p_hod_approver_emp)
          and (p_date_field <> 'hod_approved_date' or p_date_from is null or ah.acted_at >= p_date_from)
          and (p_date_field <> 'hod_approved_date' or p_date_to   is null or ah.acted_at <= p_date_to)
      )
    );
$$;
```

> This is a **draft**. The `allow_resubmit` resolution (`resolveClaimAllowResubmitFilterValue` +
> `shouldForceAllowResubmitFromActionFilter`) and the queue's `requiredStatusId`/`claimStatus`
> short-circuit (`finance-filters.repository.ts:256-264`) are the highest-risk areas and are pinned by
> parity tests before any deletion. The `hasFinanceClaimFilters` "no filters → return NULL (all claims)"
> case is represented by the TS wrapper deciding whether to call the resolver at all (see §6.1).

---

## 6. Layer 2 — Consumer RPCs

### 6.1 "No active filters" semantics

`getFilteredClaimIdsForFinance` returns `null` when `hasFinanceClaimFilters(filters)` is false, meaning
"don't constrain by ID — show everything (scoped)." Consumers must preserve this: when no claim-level
filters are active, the consumer RPC selects directly from `expense_claims` (queue: scoped to the
finance status; history: all finance actions) **without** joining the resolver. This stays a cheap
`p_has_filters boolean` branch in SQL — no array, no resolver call.

### 6.2 `get_finance_history_metrics(filters…)`

Replaces: app ID-building + `getFinanceActionBuckets` + `get_finance_history_action_metrics(p_claim_ids,…)`.
Internally identical aggregation to today's `get_finance_history_action_metrics`
(returns `total/approved/rejected/rejected_without_reclaim/rejected_allow_reclaim/other` count+amount),
but scopes `finance_actions` to `claim_id IN (SELECT id FROM finance_filtered_claim_ids(…))` instead of
`p_claim_ids`. Action buckets come from `finance_action_buckets()`.

### 6.3 `get_finance_queue_metrics(filters…)`

Replaces: `getActionFilteredClaimIds` loop + `get_claim_bucket_metrics(p_claim_ids,…)`. Same bucket
aggregation, scoped via the resolver.

### 6.4 `get_finance_history_page(filters…, p_cursor_acted_at, p_cursor_id, p_limit)`

The Approved History list is a **feed of `finance_actions`** (not claims). Projection = today's
select (`finance-history.repository.ts:88-90`):
`id, claim_id, actor_employee_id, action, notes, acted_at, actor:employees!actor_employee_id(employee_email, employee_name)`.

```sql
with filtered as (select id from finance_filtered_claim_ids(…))   -- only if p_has_filters
select fa.*
from finance_actions fa
join filtered f on f.id = fa.claim_id
where (p_action_codes is null or fa.action = any(p_action_codes))           -- date-scoped or actionFilter feed rows
  and (p_feed_from is null or fa.acted_at >= p_feed_from)
  and (p_feed_to   is null or fa.acted_at <= p_feed_to)
  and (p_cursor_acted_at is null
       or fa.acted_at < p_cursor_acted_at
       or (fa.acted_at = p_cursor_acted_at and fa.id < p_cursor_id))        -- keyset
order by fa.acted_at desc, fa.id desc
limit p_limit + 1;
```

Uses `idx_finance_actions_claim_latest` / `idx_finance_actions_acted_at_id`. The page's claim
enrichment + available-actions lookups remain page-bounded (`.in('id', pageClaimIds)`) — already safe.
Cursor encode/decode stays in TS (`@/lib/utils/pagination`).

> **Refinement (locked during planning).** The page RPCs return a keyset-ordered **ID page**
> (`TABLE(id, …keys)`), not the rich projection. The app then fetches the rich rows for that bounded
> page (`≤ limit`) via the existing PostgREST `CLAIM_COLUMNS` projection with `.in('id', pageIds)` —
> the large nested projection stays in PostgREST instead of being re-implemented in SQL. The resolver is
> composed via a **`JOIN`** (guarded by `p_has_filters`), and the order is `(<time> DESC, id DESC)` with
> `id` as the mandatory tie-breaker (principles 8–9).

### 6.5 `get_finance_queue_page(filters…, p_cursor_created_at, p_cursor_id, p_limit)`

Queue list is over `expense_claims` scoped to the finance-review status. Projection = today's
`CLAIM_COLUMNS, employees!employee_id!inner(FINANCE_OWNER_COLUMNS)` (`finance-queue.repository.ts:60-69`).

```sql
with filtered as (select id from finance_filtered_claim_ids(p_required_status_id => :finance_status, …))
select … from expense_claims ec
join filtered f on f.id = ec.id
where (p_cursor_created_at is null
       or ec.created_at < p_cursor_created_at
       or (ec.created_at = p_cursor_created_at and ec.id < p_cursor_id))
order by ec.created_at desc, ec.id desc
limit p_limit + 1;
```

Uses `idx_expense_claims_created_at_id`.

### 6.6 Exports — split by shape (refined during planning)

The two exports have different shapes, so each gets the right bounded form:

- **payment-journals** is an **aggregation** (per-employee totals). It becomes a single
  `get_finance_payment_journal_totals(filters…)` RPC — `GROUP BY employee_id` over the resolver scope.
  One query; result bounded by **employee count**. This replaces the page-loop that accumulated a
  growing `seenClaimIds` Set + per-employee `Map` in Node.
  **Dedup semantics:** the RPC must reproduce the legacy `seenClaimIds` deduplication **exactly** — one
  contribution per distinct claim regardless of how many `finance_actions` rows it has
  (`SELECT DISTINCT fa.claim_id`), pinned by parity (grand-total + per-employee assertions).
- **bc-expense** is a **row dump**. It keeps CSV streaming, but each page is a bounded
  `get_finance_history_page` call (the Phase-3 keyset RPC). Only **one page exists in memory at a time**;
  no cross-page arrays/Sets/Maps. No separate export RPC is required.

This satisfies the "single streamed query" intent for the aggregate while keeping the row dump's memory
bounded by page size.

### 6.7 TS wrappers

Thin `*.rpc.ts` wrappers (pattern of `finance-metrics.rpc.ts`) call each RPC; they perform IST date
conversion and cursor encode/decode. **Deleted** after migration: `getFilteredClaimIdsForFinance`,
`collectActionClaimIds`, `collectHodClaimIds`, `collectClaimIdsInBatches`, the `SAFE_IN_BATCH_SIZE`
chunk/merge blocks in `finance-queue`/`finance-history`, `getActionFilteredClaimIds`
(`analytics.query.ts`), and the approvals dead code (`getFilteredClaimsByIds`,
`getLatestApprovalActionsByClaim`).

---

## 7. Parity testing — RELEASE GATE (blocking)

No old code is deleted until parity passes. Run old path vs. new SQL path against the **live dataset**
for a matrix of filter combinations.

**Assertions per combination:**

- `set(oldIds) == set(newIds)` (exact membership)
- `count(oldIds) == count(newIds)`
- every metric (count **and** amount) equal, field by field
- list pages: same ordered claim/action IDs for the first N pages (keyset stability)

**Matrix (cross-product of the drift-prone dimensions):**

- `dateFilterField` ∈ {claim_date, submitted_at, finance_approved_date, payment_released_date, hod_approved_date} × {narrow range, wide range (the 638 case), no range}
- `claimStatus` ∈ {none, `<uuid>`, `<uuid>:allow_resubmit`}
- `actionFilter` ∈ {none, finance_approved, finance_rejected, rejected, rejected_allow_reclaim}
- `hodApproverEmployeeId` ∈ {none, present}
- `ownerDesignation` ∈ {none, present}
- `employeeName` / `employeeId` / `claimNumber` / `workLocation` ∈ {none, present}
- queue scope (`requiredStatusId`) ∈ {set, unset}

**Method:** a vitest integration test (service-role client) that calls both implementations and diffs,
plus ad-hoc SQL diffs via the Supabase MCP during development. Highest scrutiny on: `allow_resubmit`,
action buckets, date-field semantics, HOD-approver resolution.

---

## 8. Indexes & `EXPLAIN ANALYZE`

Existing indexes already cover most paths:

- `expense_claims`: `idx_expense_claims_created_at_id`, `idx_ec_status_id`,
  `idx_expense_claims_status_allow_resubmit`, `idx_expense_claims_claim_date`,
  `idx_expense_claims_employee_id`, `idx_ec_work_location_id`, `idx_ec_designation_id`,
  `idx_expense_claims_claim_number_unique`.
- `finance_actions`: `idx_finance_actions_claim_latest (claim_id, acted_at desc, id desc)`,
  `idx_finance_actions_acted_at_id`.
- `approval_history`: `idx_approval_history_claim_acted_at_id`, `idx_approval_history_new_status_id`,
  `idx_ah_approver_employee`.
- `employees`: `idx_employees_designation_id`, `idx_employees_employee_name`.

**Candidate new indexes (validate with EXPLAIN, add only if the plan needs them):**

- `finance_actions (action, acted_at desc)` — the date-scoped `EXISTS` filters by `action` + range;
  no `action` index exists today.
- `pg_trgm` GIN on `employees.employee_name` / `employee_id` — `ILIKE '%x%'` cannot use the plain
  btree (leading wildcard). This matches **current** behavior (already `ilike` today), so not a
  regression; note for future.
- `submitted_at` — no index today; add `expense_claims (submitted_at)` if the `submitted_at` filter
  plan shows a seq scan at scale.

**Required deliverable:** `EXPLAIN (ANALYZE, BUFFERS)` for the resolver and each consumer RPC at the
638-ID wide-range case and a no-filter case, captured in the implementation PR. Gate: no consumer does
a full seq scan of `expense_claims`/`finance_actions` on the hot paths.

---

## 9. Rollout — phased, each independently shippable

1. **Phase 1 — Resolver + semantics + parity harness.** Ship `finance_action_buckets()` and
   `finance_filtered_claim_ids()`; build the parity test; prove ID-set equality across the matrix.
   No app behavior change yet.
2. **Phase 2 — Analytics.** Switch `get_finance_history_metrics` and `get_finance_queue_metrics`;
   rewire `history-analytics.query.ts` / `analytics.query.ts`. (Simplest swap, biggest pain relief.)
3. **Phase 3 — Lists.** Add `get_finance_history_page` / `get_finance_queue_page`; rewire the queue /
   history repositories to keyset pagination; drop their chunk/merge code.
4. **Phase 4 — Exports.** Add `get_finance_export_rows`; rewire both export routes; drop the loops.
5. **Phase 5 — Deletions.** Remove `getFilteredClaimIdsForFinance` + collect/chunk helpers +
   `getActionFilteredClaimIds`; remove approvals dead code. Keep `SAFE_IN_BATCH_SIZE` safety net live
   only until each path is migrated, then remove.

Each phase keeps the app green; a regressing phase rolls back in isolation.

---

## 10. Risks & mitigations

| Risk                                               | Mitigation                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Behavior drift porting ~300 lines JS → SQL         | Parity tests as a blocking release gate (§7); delete nothing until green                  |
| `allow_resubmit` / status short-circuit subtleties | Pinned explicitly in the matrix; ported verbatim, not reinterpreted                       |
| RLS differences when filtering server-side         | `SECURITY INVOKER` keeps the caller's RLS; verify finance role can read the joined tables |
| Plan regressions at scale                          | `EXPLAIN ANALYZE` deliverable + candidate indexes (§8)                                    |
| IST date-boundary mismatch                         | Conversion stays in TS (`toIstDayStart/End`), unchanged; RPC takes `timestamptz`          |
| Export result size on one connection               | Acceptable at current volumes; revisit with keyset export only if needed                  |

---

## 11. Open questions

1. Should `finance_action_buckets()` be a function or a (cheaper-to-plan) `STABLE` inline CTE embedded
   per RPC? Default: shared function for single-source-of-truth; revisit if planner overhead shows in EXPLAIN.
2. Queue "no-filter" path currently still calls `getFilteredClaimIdsForFinance` (returns null) then
   queries by status — confirm the SQL `p_has_filters` branch reproduces the exact default ordering and
   `is_superseded` handling. (Flagged for Phase 1 parity.)
3. Do any export columns require fields beyond `CLAIM_COLUMNS` (e.g. snapshot columns)? Confirm exact
   export projections in Phase 4.

```

```
