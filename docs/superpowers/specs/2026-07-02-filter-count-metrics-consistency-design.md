# Design: Filter / Count / Metrics Consistency — Canonical Filtered Datasets

> **Origin:** `docs/superpowers/audits/2026-07-01-finance-approvals-claims-filter-display-consistency-audit.md` (4 confirmed findings). This document is a from-scratch architectural redesign, not a patch set — the audit's per-finding "suggested fix directions" are superseded by this design.
> **Status:** Design approved by user 2026-07-02, pending written spec review before handoff to implementation planning.
> **Verification method:** every platform assumption below was tested live against the dev DB (Supabase project `NxtExpenseTest`, `ibrvpangpuxiorspeffz`) via a throwaway spike (created and dropped in this session — no trace remains) rather than assumed. See "Verified platform behavior" section.

---

## Design principle

> Each page's data is defined by exactly one canonical filtered-dataset SQL function. Every RPC that serves that page (page rows, metrics, and — where used — export counts) reads from that same canonical function; none of them reimplement filter logic independently. The public API surface stays small (exactly two RPCs per page: page and metrics) and self-explanatory — no denormalized broadcast fields, no sentinel rows, no discriminator columns required to interpret a response. Business filter semantics exist in exactly one place, full stop.

This is the standard every finding below, and every future filter added to these pages, is judged against.

---

## Background: why the existing "good pattern" isn't sufficient

Finance Queue's `buildQueueRpcArgs()` (`src/features/finance/data/repositories/finance-queue.repository.ts:41-61`) ensures its three RPCs _receive_ identical arguments, and is cited in the audit as the pattern to generalize. It's necessary but not sufficient: Findings 1 and 4 both show RPCs receiving the _correct_ argument and still diverging, because each RPC's SQL body independently re-implements "apply the filters." `get_finance_history_count` received `p_action_filter` but its body ignored it; `get_pending_approval_scope_summary` received `p_employee_name` but escaped `_`/`%` differently than its sibling. A shared TS arg-builder prevents argument drift; it cannot prevent SQL-body drift. This design targets the SQL-body drift directly.

---

## Core mechanism

Per page, three SQL artifacts:

```sql
-- 1. The ONLY place filter predicates for this page are written.
--    Not exposed via PostgREST (no grant to anon/authenticated) — internal only,
--    called exclusively by the two RPCs below.
create function <page>_filtered(<all filter params>)
  returns table(<every column needed by either the page RPC or the metrics RPC>)
  language sql stable as $$
    select ... from ... where <every filter predicate, written exactly once>
  $$;

-- 2. Page rows. Thin: adds only pagination on top of the canonical function.
--    Fetches p_limit + 1 rows and trims the extra one; getting the extra row
--    back means hasNextPage = true. No counting of any kind happens here.
create function get_<page>_page(<filter params>, p_cursor_*, p_limit int)
  returns table(<row columns>)
  language sql stable as $$
    select * from <page>_filtered(<filter params>)
    where <cursor predicate> order by <keyset columns> limit p_limit + 1
  $$;

-- 3. Metrics. Thin: one aggregate pass over the same canonical function.
--    Always returns exactly one row (plain aggregate, no GROUP BY) — this is
--    ordinary SQL semantics, not a sentinel or special case. total_count here
--    is the ONLY count computed for the page — see "Pagination & counting
--    strategy" below for why a second count on the page RPC would be redundant.
create function get_<page>_metrics(<filter params>)
  returns table(total_count int, approved_count int, ..., total_amount numeric)
  language sql stable as $$
    select count(*), count(*) filter (where ...), ..., coalesce(sum(...), 0)
    from <page>_filtered(<filter params>)
  $$;
```

**Export preflight** (count without rows) calls `get_<page>_metrics(<filters>)` and reads `total_count` — same function every other count-consumer uses, zero rows transferred, no separate code path. This closes INV-2 (export count == pagination total) structurally rather than by convention.

---

## Pagination & counting strategy

An earlier version of this design put `Prefer: count=exact` on the page RPC (PostgREST's `Content-Range` header mechanism, confirmed working in the spike below) to get the pagination total. That was removed after checking what the UI actually needs — it was solving an already-solved problem, and it obscured a real scaling question that deserved a direct answer instead of an assumption.

**What was checked, and why it changed the design:**

- `src/components/ui/cursor-pagination-controls.tsx` renders "Page X of Y" / "N total records" **only when `totalPages`/`totalItems` are passed** — they're optional props, not load-bearing. Navigation is Previous/Next only; there is no jump-to-page control and no offset-based `?page=N` URL param anywhere in the four pages. So the footer's exact count is decorative, not a navigation requirement.
- The KPI cards above every table ("Total Claims", "Pending Approvals", "Total History Records", etc.) **are** a real, unavoidable requirement — prominent business metrics, independent of the pagination footer, on all four pages. These already require computing `total_count` inside `get_<page>_metrics()` regardless of anything pagination-related.
- Given that, putting `count=exact` on the page RPC _too_ would compute the same number a second time in the same request. Removed. **`get_<page>_metrics()` is now the single source of `total_count`** for both the cards and (when shown) the footer's "Page X of Y" text (`totalPages = ceil(total_count / page_size)`, computed in TS from the one number, not a second query).
- `get_<page>_page()` no longer counts anything. Next/Previous enablement uses the standard keyset over-fetch trick — request `p_limit + 1` rows, trim the extra one, `hasNextPage = (rows.length > p_limit)`. This is O(limit), not O(n), regardless of table size, and needs no header, no `GET`-vs-`POST` distinction, nothing PostgREST-specific.

**Is exact counting itself a scaling risk?** Checked per-page, not in the abstract:

| Page                   | Natural scope bound                                                                                                              | Exact-count risk as tables grow                                                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/claims`              | Always filtered to `employee_id = <current user>`                                                                                | None — bounded to one person's lifetime claim count forever, however large `expense_claims` gets overall. An index range scan on `employee_id` stays cheap regardless of total table size.                |
| `/approvals` (pending) | Always scoped to the approver's subordinate tree                                                                                 | None — bounded to team size, grows with headcount under that manager, not with total company history.                                                                                                     |
| `/finance` (queue)     | Always filtered to pending-review status                                                                                         | None — bounded to current work-in-progress (claims awaiting finance action), which is self-limiting: claims leave this scope as finance processes them. Doesn't grow with all-time volume.                |
| `/approved-history`    | **None** — intentionally all-time, company-wide, optionally filter-free (`page.tsx:96-101` removes HOD/status scoping by design) | **The one real case.** An unfiltered `count(*)` here scans the entire all-time `finance_actions`/`expense_claims` join, and that table only grows. This is the case the user's concern is actually about. |

Three of the four pages are safe indefinitely by construction — no counting strategy beyond a plain indexed `count(*)` is ever needed there, because the _scope_, not the _table_, bounds the cost. Only `/approved-history`'s zero-filter path is exposed to real long-term growth, and only that specific query shape needs a scaling answer.

**Current state vs. the stated risk:** `finance_actions` is ~3,300 rows and `expense_claims` is ~18,000 rows today (checked live during this session). An unfiltered join-and-count across both, with the existing indexes, ran in 13-31ms in the `EXPLAIN (ANALYZE, BUFFERS)` spike below — nowhere close to a problem. "Tens or hundreds of millions of rows" is 4-5 orders of magnitude beyond current volume; for an internal, headcount-bounded expense tool (growth tracks employee count × claims/year, not viral/unbounded usage), reaching that scale is a many-years-away, not-guaranteed event. Building incremental counters or a materialized view today, for a scale this system may never reach, would be premature — but the strategy is worth naming now so it isn't a scramble later.

**Scaling menu for `/approved-history`'s zero-filter count, evaluated (not implemented) per the user's request:**

| Strategy                                                         | How it would work                                                                                              | Trade-off                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger-maintained cached counter                                | Single-row counter table, incremented/decremented by `finance_actions`/`expense_claims` insert/delete triggers | O(1) read, exact, but only answers "count with zero filters" — any filter still needs a live query (which is fine, since filters bound the scan)                                                                  |
| Approximate count (`pg_class.reltuples`-style estimate)          | Use Postgres's own planner statistics instead of a live count for the zero-filter path only                    | Simplest to build, matches how large-scale systems show "~2.8M records"; not exact, needs product sign-off that an approximation is acceptable for this one number                                                |
| Materialized view, refreshed periodically (e.g. via `pg_cron`)   | Precompute the zero-filter metrics bucket on a schedule (minutes, not real-time)                               | Handles the exact case that's expensive (no filter) without touching the cheap filtered cases; adds refresh-lag and a scheduled job to operate                                                                    |
| Incremental bucketed aggregates (counts by action + date bucket) | Summary table maintained by triggers, covering common filter combinations                                      | Only covers the _fixed, low-cardinality_ filters (action type, date bucket) — doesn't help free-text employee-name or claim-number search, which are naturally selective/index-bounded anyway and don't need this |

**Recommendation:** do nothing now; keep live `count(*)` via `get_finance_history_metrics()` for `/approved-history` as for the other three pages. Revisit when there's an actual trigger — e.g., `finance_actions` crosses roughly 5-10M rows, or the zero-filter metrics call's `EXPLAIN ANALYZE` time on production data exceeds ~200ms. At that point, the approximate-count-for-the-zero-filter-path option is the right first move (least machinery, matches the one query shape that's actually expensive) before reaching for a materialized view or trigger-maintained counters.

---

## Verified platform behavior (spike results, not assumptions)

A temporary type/function pair (`_spike_*`, clearly namespaced, created and dropped within this session, zero persisted trace) was used to test every load-bearing assumption in this design against real dev-DB data (17,923 `expense_claims`, 3,293 `finance_actions`) before adopting it.

| Assumption                                                                                                                          | Method                                                                                                       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A single composite RPC (OUT params, array-of-composite `rows` field + scalar metrics) types cleanly via `generate_typescript_types` | Created `_spike_get_finance_history_view` with this shape, ran codegen                                       | **Failed.** Produced `Returns: Record<string, unknown>` — fully opaque, no field-level typing.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| OUT parameters break codegen specifically because of the nested array                                                               | Created `_spike_metrics_only`, scalar-only OUT params, no arrays, ran codegen                                | **Failed identically** — also `Record<string, unknown>`. OUT parameters break codegen categorically in this Supabase project's tooling, regardless of field shape. This rules out any OUT-param-based design.                                                                                                                                                                                                                                                                                                   |
| `RETURNS TABLE(...)` types cleanly                                                                                                  | Created `_spike_get_finance_history_view_v2` (flat table, denormalized metrics), ran codegen                 | **Confirmed.** Every field individually typed (`acted_at: string`, `total_count: number`, etc.) — this is the only pattern that survives codegen in this project.                                                                                                                                                                                                                                                                                                                                               |
| PostgREST correctly serializes composite-array fields when they are used                                                            | `row_to_json()` over the OUT-param spike function                                                            | **Confirmed at the JSON level** — clean array of named-field objects. (Still rejected above on typing grounds, not serialization grounds.)                                                                                                                                                                                                                                                                                                                                                                      |
| The shared `filtered` CTE is computed once and reused, not recomputed per reference                                                 | `EXPLAIN (ANALYZE, BUFFERS)` on both spike functions                                                         | **Confirmed.** Plan shows one `Hash Join` under `CTE filtered` (~10-24ms, 3,293 rows), then multiple cheap `CTE Scan on filtered`/`filtered_1`/`filtered_2` nodes (~0.3ms each) reusing the materialized result. Total execution 13-31ms unfiltered (worst case — real filtered calls will be cheaper via existing indexes, not more expensive).                                                                                                                                                                |
| `Prefer: count=exact` + `Range` headers work on a `RETURNS TABLE` RPC called via `GET`                                              | `curl -i` against the live PostgREST endpoint with these headers                                             | **Confirmed working** — response included a `Content-Range` header with the count, fully decoupled from the body. **Not used in the adopted design**: checking the actual UI (see "Pagination & counting strategy") showed `get_<page>_metrics()` already computes `total_count` for the KPI cards, so putting `count=exact` on the page RPC too would have counted the same thing twice. Documented here because it's a real, verified capability worth knowing about even though this design doesn't need it. |
| Denormalizing metrics onto every row is cheap at realistic page sizes                                                               | Measured `pg_column_size()` of the JSON payload at `p_limit` = 10/50/200/500/1000/3293 for both spike shapes | Denormalized shape carries a **stable ~30% overhead** vs. the (codegen-broken) alternative — a few hundred bytes to ~4KB at realistic page sizes (10-50 rows). Moot for the adopted design (Option B below carries no denormalized metrics on rows at all — page rows are exactly as lean as the leanest option tested).                                                                                                                                                                                        |

---

## The single-RPC vs. two-RPC decision

Three designs were evaluated in sequence during this review, each tested against the same criteria (single canonical filter definition, strong typing, no cross-RPC drift, acceptable payload/performance):

1. **Single composite RPC via OUT params** (rows as array-of-composite + scalar metrics, one round trip) — rejected: breaks TypeScript codegen (`Record<string, unknown>`), confirmed above.
2. **Single flat RPC via `RETURNS TABLE`** (metrics denormalized onto every row, sentinel row for the empty-page case) — types cleanly and keeps one round trip, but requires either an implicit `id IS NULL` sentinel check or an explicit discriminator column (`is_data_row`) that every consumer must understand permanently. Postgres's own precedent for "detail rows + a summary row in one result set" (`ROLLUP`/`GROUPING SETS`) uses an explicit `GROUPING()` discriminator rather than implicit nullability specifically because the latter was judged too fragile to standardize on — which argues against the implicit version, but even the explicit version is a permanent API-shape convention every future consumer has to learn.
3. **Two thin RPCs (page + metrics), both reading the same canonical `<page>_filtered()` function** — **adopted.** The metrics RPC always returns exactly one row because it's a plain aggregate — ordinary SQL semantics, not a sentinel — and it's the single source of `total_count` (see "Pagination & counting strategy" below for why that's the only count computed, and how page navigation avoids counting entirely via keyset over-fetch). No discriminator column, no null-check convention, anywhere. Two round trips per page (still fewer than today's two-to-three), in exchange for zero permanent API conventions and a public surface any future developer can read cold.

**Decision: Option 3.** The user's stated rationale: the architectural goal is not minimizing HTTP requests at all costs, it's a clean, expressive, maintainable API — two lightweight RPCs derived from one canonical filtered function are preferable to a single RPC that requires permanent sentinel/discriminator semantics.

---

## Per-page scope

| Page                   | Canonical function             | Public RPCs                                                   | Fixes           | Notes                                                                                                                                                      |
| ---------------------- | ------------------------------ | ------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/approved-history`    | `finance_history_filtered()`   | `get_finance_history_page`, `get_finance_history_metrics`     | Finding 1       | Builds on the existing hydration work (commit `8994e2d`) — extends it, doesn't discard it.                                                                 |
| `/approvals` (pending) | `pending_approvals_filtered()` | `get_pending_approvals_page`, `get_pending_approvals_metrics` | Finding 4       | Single `ILIKE`/escaping predicate, defined once.                                                                                                           |
| `/claims`              | `my_claims_filtered()`         | `get_my_claims_page`, `get_my_claims_metrics`                 | Finding 3       | Biggest net-new SQL — today's list path is a PostgREST query-builder chain (`applyMyClaimsFilters`), not an RPC at all.                                    |
| `/finance` (queue)     | `finance_queue_filtered()`     | `get_finance_queue_page`, `get_finance_queue_metrics`         | — (consistency) | No bug today (audit confirmed parity via `buildQueueRpcArgs()`); migrated anyway so no page is left on the old multi-RPC pattern. Mandatory, not optional. |

**Finding 2 (dropdown)** is unrelated to the above mechanism and ships independently: `getFinanceFilterOptions()` (`src/features/finance/data/repositories/finance-filter-options.repository.ts:57-61`) currently samples the 200 most-recent `finance_actions` rows. `finance_action_buckets()` (`supabase/migrations/20260618090000_finance_action_buckets.sql`) already exists, is already labeled in its own migration comment as _"Layer 0: single source of truth for finance action classification,"_ and is derived from `claim_status_transitions`/`claim_statuses` (workflow config, not transactional history). Fix: read from it directly. Zero schema change.

**Scope boundary:** a repo-wide audit for the same anti-pattern (business-domain values inferred from transactional history instead of an authoritative source) found one more instance — `src/features/admin/queries/admin-logs.ts:45-55` samples `admin_logs` the same way for its action-type/entity-type dropdowns. Per user decision, **this stays out of scope** for this refactor; the four originally-audited findings are the boundary. Noted here only as a pointer for a future, separately-scoped pass.

---

## Architectural invariants

These are binding rules, not just test assertions — a future PR that violates one of these should be rejected in review even if no test happens to catch it.

| Invariant | Statement                                                                                                                                                                      | Enforcement                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INV-1     | The pagination footer's displayed total (when shown) is never independently computed — it is always `get_<page>_metrics().total_count`, the same number shown on the KPI cards | Structural — `get_<page>_page()` performs no counting at all (keyset over-fetch only); there is exactly one count computation per page load, so this can't drift by construction                                                               |
| INV-2     | Export count equals the KPI-card total for identical filters                                                                                                                   | Export preflight calls `get_<page>_metrics(<filters>)` and reads `total_count` — literally the same function and call every other count-consumer uses, not a separate code path                                                                |
| INV-3     | Every consumer of a page's data (rows, metrics, export, dropdown-scoping if any) derives from the same canonical filtered dataset                                              | Structural — same named `<page>_filtered()` function, referenced by name; code review checks no new `WHERE` clause touching these tables appears outside the designated `_filtered()` function                                                 |
| INV-4     | A business filter predicate exists in exactly one SQL source location per page                                                                                                 | pgTAP test seeds an edge-case filter value (e.g., employee name containing literal `_`/`%`) and asserts page and metrics agree                                                                                                                 |
| INV-5     | Domain/catalog values (dropdown options, valid action types, etc.) are never derived by sampling or limiting transactional history                                             | Applied to Finding 2 via `finance_action_buckets()`; pgTAP/lint check that new filter-options queries contain no `ORDER BY <activity column> ... LIMIT`                                                                                        |
| INV-6     | No public dataset RPC uses `OUT` parameters; all use `RETURNS TABLE(...)`                                                                                                      | Confirmed necessary this session — OUT params break TypeScript codegen categorically in this project. Implementation checklist item: re-run `generate_typescript_types` after each phase and confirm no `Record<string, unknown>` regressions. |

---

## Performance

**Planner behavior:** `<page>_filtered()` and its two callers are simple, non-recursive `language sql` functions, which Postgres can inline into the calling query rather than treating as an opaque black box — each caller gets a plan tailored to what it actually needs (the page call's `ORDER BY`/`LIMIT`/cursor predicate pushed down; the metrics call's aggregate pass). This needs an `EXPLAIN (ANALYZE, BUFFERS)` check per function during implementation (methodology demonstrated in this session) rather than being assumed from the design doc alone.

**Existing indexes are sufficient for the finance-history path** (checked against current migrations): `idx_finance_actions_acted_at_id (acted_at DESC, id DESC)`, `idx_finance_actions_claim_latest (claim_id, acted_at DESC, id DESC)`, `idx_expense_claims_status_allow_resubmit (status_id, allow_resubmit)`, `idx_cst_active/from/to`, `idx_claim_statuses_active/code`.

**Gap identified:** Claims has only single-column indexes (`idx_expense_claims_employee_id`, `idx_ec_status_id`, `idx_ec_work_location_id`, `idx_expense_claims_claim_date`) where My Claims always filters by `employee_id` first. Recommend adding a composite `(employee_id, status_id, claim_date)` index as part of the Claims phase — not urgent at current data scale (hundreds of rows per employee), but cheap to add while touching this code.

**Round trips:** two per page under this design, versus today's two-to-three (finance-history: 3 → 2; approvals: 2 → 2, now guaranteed consistent; claims: query-builder + RPC → 2 clean RPCs; finance-queue: 3 → 2). Not the primary goal, but not a regression either.

**Payload:** page rows carry no denormalized metrics (Option 3 above) — leanest of every shape tested. Metrics response is a single row of ~5 scalar fields, trivially small regardless of dataset size, since it's an aggregate, not a row dump.

**Large-dataset note (future, not urgent):** `count(*)` in the metrics function is a full scan of the matching rows — true today, unchanged by this design. If a page's scope ever grows past what an indexed count handles comfortably, an estimated count for the no-filter case is the standard future mitigation; not implemented now, no evidence it's needed at current volumes (low thousands of rows per scope).

---

## Regression tests

TS repository tests (`finance-history.repository.test.ts` and siblings) mock the Supabase client — they cannot catch this bug class, since the mock always agrees with itself and the bugs live in SQL bodies. The repo already has one (minimally used) pgTAP convention (`supabase/tests/001_pgtap_employees_smoke.sql`); this design extends it rather than introducing new infrastructure:

- One pgTAP file per page (e.g. `supabase/tests/010_finance_history_view_parity.sql`), run inside `begin; ... rollback;` against seeded fixture rows, including employee names with literal `_`/`%` to regression-pin Finding 4.
- Each assertion compares the RPC's output against an **independently hand-written** SQL count/sum over the same fixtures — never re-derived from the function's own CTEs, which would be tautological.
- Written test-first per phase (TDD), not bolted on at the end.
- A new npm script (`test:db`, wrapping `supabase test db`) runs these alongside `npm run test`.
- The keyset over-fetch (`p_limit + 1` trick for `hasNextPage`) is simple enough to cover directly in pgTAP: seed exactly `p_limit + 2` matching fixture rows, assert the page RPC returns `p_limit` rows and the TS layer's trim/`hasNextPage` logic (unit-testable in isolation, no DB needed) behaves correctly at the boundary.

---

## Phasing

Each phase is independently shippable and includes its own pgTAP tests (test-first) alongside the SQL and TS changes:

0. **Finding 2** — dropdown fix via `finance_action_buckets()`. Trivial, zero risk, no dependency on anything else. Ships first.
1. **Finance History** (`finance_history_filtered()` + page/metrics RPCs) — fixes Finding 1, builds on the existing hydration commit.
2. **Approvals** (`pending_approvals_filtered()` + page/metrics RPCs) — fixes Finding 4.
3. **Claims** (`my_claims_filtered()` + page/metrics RPCs, net-new SQL) — fixes Finding 3, biggest lift.
4. **Finance Queue** (`finance_queue_filtered()` + page/metrics RPCs) — no bug fixed, applied for consistency (mandatory).
5. Old RPCs (`get_finance_history_count`, `get_finance_history_metrics` [old signature], `get_pending_approval_scope_summary`, `get_employee_claim_metrics`, `get_finance_queue_count`) dropped once call-sites are confirmed migrated — explicit grep-for-callers step before each drop, since export-context files (`*-export-context.ts`) call some of these independently today.

**Explicitly out of scope:** Admin Logs dropdown fix (tracked separately, not part of this plan).

---

## Implementation-start checklist (carried from this session's spike learnings)

- [ ] Run `EXPLAIN (ANALYZE, BUFFERS)` for each new `<page>_filtered()` / page / metrics function against realistically-filtered queries (not just the unfiltered worst case tested in this session) before merging each phase.
- [ ] Run `generate_typescript_types` after each phase and confirm no `Record<string, unknown>`/`Json` regressions (INV-6).
- [ ] Add the `(employee_id, status_id, claim_date)` composite index during the Claims phase.
- [ ] Confirm the pagination footer's `totalPages`/`totalItems` props are wired from `get_<page>_metrics().total_count`, not from a second count computation, when updating each page's `page.tsx`.
