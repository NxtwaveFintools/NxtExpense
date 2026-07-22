# Finance Approved History — Single Fully-Hydrated Page RPC

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
>
> **Commits:** The repo owner handles all git commits. "Checkpoint" = _stage + STOP_; do NOT run `git commit`.
>
> **Prerequisite:** Read `docs/superpowers/plans/2026-06-18-finance-db-side-filtering-phase3.md` first — this plan rewrites the RPC that phase built. Read the companion review doc (`2026-07-01-finance-history-single-rpc-hydration-review.md`) before starting Task 1 — it contains required fixes to the design below, not just commentary.

**Background:** Approved History's "All CSV" / "BC Expense" exports were found to return header-only (empty) CSVs for datasets over ~350-400 rows. Root cause: `getFinanceHistoryPaginated` enriches each keyset page via `.from('finance_actions').in('id', actionIds)` and `.from('expense_claims').in('id', claimIds)` — both build PostgREST URLs whose length scales with page size, and Supabase's gateway rejects request URLs above ~15KB with a bare 400. A stopgap (chunk size reduced to 150) is live; this plan is the permanent fix, agreed as "Option C" after evaluating three architectures (Option A: shrink chunk size — rejected, doesn't scale; Option B: move ids into RPC POST bodies but keep 4 round trips/page — rejected, real but strictly dominated; Option C: collapse the enrichment into the keyset RPC itself, 1 round trip/page — **accepted**; Option D: async/background export — correct answer for genuine 1M+ scale, deliberately deferred with concrete trigger conditions, not built now).

**Goal:** Replace `getFinanceHistoryPaginated`'s 3-4-round-trip-per-page shape (keyset RPC → `.in()` finance_actions → `.in()` expense_claims [→ `get_claim_available_actions_bulk`]) with a single RPC per page returning fully-hydrated rows (claim + owner + action already joined). `get_claim_available_actions_bulk` stays a separate call — deliberately out of scope, not an oversight.

**Bounded-memory invariant** (`src/features/finance/data/README.md`) still applies and is not weakened: no `.in()` re-query, no ID collection is introduced. Page size stays ≤ `limit + 1` rows.

**Tech Stack:** PostgreSQL/Supabase; `@supabase/supabase-js`; Vitest; Playwright.

## Reference

- Prior plan: `docs/superpowers/plans/2026-06-18-finance-db-side-filtering-phase3.md` (built the RPC this plan rewrites)
- Current RPC: `supabase/migrations/20260618092100_get_finance_history_page.sql`
- Resolver (unchanged): `supabase/migrations/20260618090100_finance_filtered_claim_ids.sql`
- Existing precedent for array-param RPC: `get_claim_available_actions_bulk` (`supabase/migrations/20260429080441_remote_schema.sql:2611`)
- Existing precedent for single-joined-aggregate RPC: `get_finance_payment_journal_totals` (`supabase/migrations/20260618093000_get_finance_payment_journal_totals.sql`)
- Consumer: `src/features/finance/data/repositories/finance-history.repository.ts` (`getFinanceHistoryPaginated`)
- Projections consumed elsewhere (queue repo, claim detail) — **not touched by this plan**: `CLAIM_COLUMNS`/`mapClaimRow` (`@/features/claims/data/queries`), `FINANCE_OWNER_COLUMNS`/`normalizeFinanceOwner` (`finance-shared.repository.ts`)
- URL-length / db-max-rows landmines: `reference_supabase_url_length_limit` / `reference_postgrest_max_rows` (session memory)

## Design note (superseded from first draft — see review doc)

The first draft of this plan proposed jsonb columns shaped to exactly mimic PostgREST's embed output, specifically so `mapClaimRow`/`normalizeFinanceOwner` could be reused unchanged. The companion review rejected this: it forces hand-written SQL to replicate a PostgREST-specific quirk (object-vs-single-element-array) that was never meant to be a stable target, and it loses real column typing (jsonb → opaque `Json` in generated types) for no durable benefit. **Decision: return flat columns, write a new dedicated mapper (`mapHydratedHistoryRow`) instead of reusing `mapClaimRow`/`normalizeFinanceOwner` for this path.** This also makes the queue-repo/history-repo divergence (§ Task 2 note) an explicit, visible fact rather than something hidden behind a shared-looking mapper call.

## File Structure

- Create: `supabase/migrations/<ts>_rewrite_get_finance_history_page_hydrated.sql`
- Create: `supabase/rollback/<ts>_rewrite_get_finance_history_page_hydrated.rollback.sql`
- Create: `scripts/finance-history-explain.sql`
- Modify: `src/features/finance/data/repositories/finance-history.repository.ts`
- Create: `mapHydratedHistoryRow` (new, colocated with the repository or in a small adjacent module)
- Modify: `src/lib/utils/streaming-export.ts` (re-tune `EXPORT_CHUNK_SIZE`)
- Modify: `src/app/(app)/approved-history/bc-expense-export/route.ts` (re-tune `HISTORY_CHUNK_SIZE`)
- Modify: `src/lib/utils/__tests__/streaming-export.test.ts`
- Modify: `src/app/(app)/approved-history/bc-expense-export/__tests__/route.test.ts`
- Create: `src/features/finance/data/repositories/__tests__/finance-history.repository.test.ts`
- Modify: `src/features/finance/__tests__/finance-list-parity.test.ts` (add field-level parity, not just ID-ordering parity)
- Create: a `CLAIM_COLUMNS`-vs-RPC-output drift-detector test (see Task 4)

**Unaffected — verify green, no code change expected:** `finance/export`, `approved-history/export`, `approved-history/payment-journals-export` route tests (all mock `getFinanceHistoryPaginated`); `finance-export-parity.test.ts` (opt-in, uses `getFinanceHistoryPaginated` as its legacy baseline — signature unchanged); `approved-history/page.tsx`; 7 e2e specs touching `/approved-history`.

**Explicitly out of scope:** `getFinanceQueuePaginated` (same 3-query shape, never hit the URL bug — UI page size ≤ 50); folding `get_claim_available_actions_bulk` into this RPC; Option D (async export).

---

## Task 1 — Migration: rewrite `get_finance_history_page`

**Landmine:** `CREATE OR REPLACE FUNCTION` cannot change a return-table shape (Postgres errors `42P13`). Must `DROP FUNCTION` (exact old signature) then `CREATE FUNCTION`, in the same migration — same pattern already used in this repo for `20260622090000_drop_stale_approval_history_overload.sql` after a live `PGRST203` incident from a stale overload.

- [ ] **Step 0 — join-type audit (required, do this before writing SQL).** For every relation being added, look up its _current_ PostgREST select string and classify inner vs. left from the literal syntax (presence/absence of `!inner`), not from memory. Verified table (from this session's review):

  | Relation                                                    | Join type | Source of truth                                                |
  | ----------------------------------------------------------- | --------- | -------------------------------------------------------------- |
  | `expense_claims` (via `finance_actions.claim_id`)           | INNER     | FK is `NOT NULL`; no existing embed to inherit from (new join) |
  | owner `employees` (via `expense_claims.employee_id`)        | **INNER** | `employees!employee_id!inner(...)` — explicit                  |
  | `designations` (via `employees.designation_id`)             | **LEFT**  | `designations!designation_id(...)` — no `!inner`               |
  | `work_locations`                                            | **LEFT**  | no `!inner`                                                    |
  | `expense_locations`                                         | **LEFT**  | no `!inner`                                                    |
  | `vehicle_types`                                             | **LEFT**  | no `!inner`                                                    |
  | `claim_statuses` (via `expense_claims.status_id`)           | **LEFT**  | `claim_statuses!status_id(...)` — no `!inner`                  |
  | actor `employees` (via `finance_actions.actor_employee_id`) | **LEFT**  | `actor:employees!actor_employee_id(...)` — no `!inner`         |

- [ ] **Step 1 — write the migration** with flat columns (see design note above — not jsonb): `DROP FUNCTION IF EXISTS public.get_finance_history_page(<current 18-arg signature>);` then `CREATE FUNCTION` with the same input parameters, unchanged `base`/resolver-join/`union all`/`order by acted_at desc, id desc`/`limit p_limit + 1` structure inside a `page` CTE (this CTE boundary is load-bearing — see Task 1 Step 3), then join `page` out to the 8 relations above using the audited join types, selecting flat columns (prefixed per source: `owner_employee_id`, `actor_email`, `status_code`, etc. — one column per field currently in `CLAIM_COLUMNS` + `FINANCE_OWNER_COLUMNS` + the action/actor fields).
- [ ] **Step 2 — guardrail comment.** Add an explicit comment above the enrichment joins: _"Every join here MUST be a to-one lookup by primary key — the `page` CTE's `ORDER BY ... LIMIT` already decided the page membership before these joins run, and that invariant (join cardinality ≤ 1) is what keeps `hasNextPage`/keyset math correct. A one-to-many addition (e.g. an array of attachments) requires `json_agg` + `GROUP BY` and a fresh review of this invariant — do not add one casually."_
- [ ] **Step 3 — apply to dev; smoke test.** `select * from public.get_finance_history_page(p_limit => 3);` — expect ≤4 rows, all new columns populated, no error. Specifically test a row where an action's actor employee record and a claim's `vehicle_type_id`/`expense_location_id` are NULL, to confirm the LEFT-joined columns come back null (not silently dropping the row).
- [ ] **Step 4 — write the rollback**, restoring the current 3-column function verbatim (copy from the existing migration, don't retype).
- [ ] **Checkpoint** — stage both files; STOP for owner to apply/commit.

---

## Task 2 — Rewire `getFinanceHistoryPaginated` + new `mapHydratedHistoryRow`

- [ ] Delete the `ActionRow` type, both `.in()` enrichment fetches, and `claimMap` building.
- [ ] Write `mapHydratedHistoryRow(row): FinanceHistoryItem` (new, purpose-built — does not call `mapClaimRow`/`normalizeFinanceOwner`) that assembles `claim`, `owner`, `action` directly from the flat RPC columns.
- [ ] `getClaimAvailableActionsByClaimIds(supabase, claimIds)` call is unchanged, fed `claimIds` from the page rows (still ≤ limit unique ids).
- [ ] Cursor logic (`encodeCursor({created_at: lastRecord.acted_at, id: lastRecord.id})`) unchanged.
- [ ] **Note (accepted, tracked divergence):** after this task, the queue repo (PostgREST embeds via `CLAIM_COLUMNS`) and the history repo (hand-written SQL + `mapHydratedHistoryRow`) are two different mechanisms producing conceptually the same `Claim`/`FinanceOwner` shape. A field added to one won't appear in the other automatically. This is accepted for now; Task 4's drift-detector test is the mitigation, and extending this pattern to the queue repo is a tracked future follow-up, not silent scope creep.
- [ ] `npx tsc --noEmit` — expect clean.
- [ ] **Checkpoint** — stage; STOP for owner to commit.

---

## Task 3 — New direct unit test for the repository

- [ ] Create `finance-history.repository.test.ts`, mocking `supabase.rpc` to return a synthetic flat hydrated row. Assert: `mapHydratedHistoryRow` produces the correct `FinanceHistoryItem`; `hasNextPage`/slicing logic; cursor built from the last _bounded_ row; early-return on `scope.isEmpty`; early-return on empty page (zero `availableActions` calls).
- [ ] **Checkpoint** — stage; STOP for owner to commit.

---

## Task 4 — Parity validation (the real risk gate)

- [ ] **Field-level parity test** (extend `finance-list-parity.test.ts` or a sibling): for a sample of pages across the existing filter matrix, fetch via the new RPC AND independently re-fetch the same `claim_id`/action `id` via today's exact embed query, run both through the respective mappers, and deep-equal every field.
- [ ] Explicitly test nullable-relation edge cases: no `vehicle_type_id`, no `expense_location_id`, a rejected/terminal/superseded claim, an action whose actor employee record is missing.
- [ ] **State plainly in the test file's header comment:** these parity tests run with `SUPABASE_SERVICE_ROLE_KEY` and therefore bypass RLS — they validate query/join correctness, not "does a real Finance user's `authenticated` session see the same data." The only check for that is the e2e run in Task 5. (Verified this session: all 5 newly-joined reference tables + `employees` currently have unconditional `SELECT ... USING (true)` policies for `authenticated`, so there is no known gap today — but a future restrictive policy on any of these tables would not be caught by this test suite.)
- [ ] **Drift-detector test:** parse `CLAIM_COLUMNS` + `FINANCE_OWNER_COLUMNS`'s field lists, assert the new RPC's returned columns are a superset. Catches future silent divergence between the queue repo's PostgREST-embed path and this hand-written SQL path.
- [ ] Run with `PARITY=1` against dev — must be 100% field-identical. Any mismatch blocks Task 2 from merging.
- [ ] **Checkpoint** — stage; STOP for owner to commit.

---

## Task 5 — Re-tune chunk sizes + real-user e2e verification

- [ ] Verify prod's `db-max-rows` before picking a number (dev is confirmed 1000; don't assume prod matches).
- [ ] Pick a value with margin below that cap, sized against an explicit byte-budget for the new (larger, flat-but-wide) per-row payload — not just against the row-count cap. Document the byte-budget assumption in the same comment.
- [ ] Update `EXPORT_CHUNK_SIZE` / `HISTORY_CHUNK_SIZE` with a comment describing the _new_ constraint (db-max-rows + payload size), replacing the URL-length rationale from the stopgap fix.
- [ ] Update the two test files' hardcoded assertions.
- [ ] Re-run the live "All CSV" download **as the real `finance1@nxtwave.co.in` e2e test account** (not service role) to confirm real row counts, reasonable wall-clock time, and that the flat-column/mapper rewrite didn't drop any field a real authenticated session can see.
- [ ] **Checkpoint** — stage; STOP for owner to commit.

---

## Task 6 — Performance validation (fast-follow, non-blocking)

- [ ] `scripts/finance-history-explain.sql`: `EXPLAIN (ANALYZE, BUFFERS)` for first-page (no filters), filtered, and middle-cursor shapes — confirm the 8-join enrichment still executes against ≤ `limit+1` rows (i.e. the `page` CTE's `LIMIT` is genuinely acting as a barrier, not being optimized away).
- [ ] Confirm keyset reads still hit `idx_finance_actions_acted_at_id`.
- [ ] Record before/after round-trip count and wall-clock for a full "All CSV" export at realistic size.
- [ ] Add an index only if a probe justifies it.
- [ ] **Checkpoint** — stage; STOP for owner to commit.

---

## Migration & deployment risks

1. **`DROP`-before-`CREATE` is mandatory** — see Task 1. Fails loud (migration apply error) if skipped, not silent.
2. **Co-deployment requirement**: migration + `finance-history.repository.ts` change ship together. `claim_id`/`acted_at` stay top-level columns either way, so a mismatched partial rollout fails loud (undefined field access) rather than silently returning wrong data.
3. **Translation risk is dominant** — audited join table in Task 1 Step 0 is the control; Task 4's field-level parity test is the gate.
4. **RLS blind spot in the validation method** — service-role parity tests can't see it; the Task 5 real-user e2e run is the only check. Verified no current gap on the 6 tables involved (see Task 4).
5. **`db-max-rows` may differ per environment** — verify prod before picking the new chunk size.
6. **Two parallel data-shaping mechanisms (queue vs. history) is an accepted, tracked trade-off**, not an oversight — mitigated by the Task 4 drift-detector test, not eliminated.
7. Rollback is cheap: restores the exact current 3-column function; reverting the repository file makes the two consistent again. No data migration involved anywhere — pure read-path change.
