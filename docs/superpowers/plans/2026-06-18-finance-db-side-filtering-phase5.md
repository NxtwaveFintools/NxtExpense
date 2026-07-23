# Finance DB-side Filtering — Phase 5 (Deletions & Guardrails) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
>
> **Commits:** The repo owner handles all git commits. "Checkpoint" = _stage + STOP_; do NOT run `git commit`.
>
> **Prerequisite:** Phases 2–4 green and merged. Every consumer now uses the resolver-backed RPCs; the
> only remaining references to the legacy code should be the parity tests.

**Goal:** Delete the now-dead in-memory filtering code (and the approvals dead code) so the anti-pattern
cannot creep back, and retire the `SAFE_IN_BATCH_SIZE` stop-gap now that no path builds a large ID array.

**Architecture:** Pure removal + guardrail. Each deletion is gated by "grep proves zero non-test
references" before removing. The parity tests that depended on the legacy path are converted to
reference-SQL comparisons or removed.

**Tech Stack:** TypeScript; Vitest; ESLint/tsc as the safety net.

## Reference

- Phase 1–4 plans (the consumers that replaced each legacy function)
- Legacy code to remove:
  - `finance-filters.repository.ts`: `getFilteredClaimIdsForFinance`, `collectActionClaimIds`, `collectHodClaimIds`, `collectClaimIdsInBatches`, `SAFE_IN_BATCH_SIZE`, `FILTER_BATCH_SIZE`, `MAX_FILTERED_CLAIM_IDS`
  - `analytics.query.ts`: `getActionFilteredClaimIds`, `intersectClaimIds`, `ACTION_FILTER_BATCH_SIZE`, `MAX_SCOPED_ACTION_CLAIMS`
  - `history-analytics.query.ts`: `getFinanceActionBuckets`, `normalizeFinanceHistoryActionCode` (if now unused)
  - `filter-date-resolvers.repository.ts`: helpers now superseded by `finance_action_buckets()` (keep `isFinanceActionDateFilterField` if still imported)
  - `approval-analytics.repository.ts`: `getFilteredClaimsByIds`, `getLatestApprovalActionsByClaim` (dead code)

## File Structure

- Modify: `src/features/finance/data/repositories/finance-filters.repository.ts`
- Modify: `src/features/finance/data/queries/analytics.query.ts`
- Modify: `src/features/finance/data/queries/history-analytics.query.ts`
- Modify: `src/features/finance/data/repositories/filter-date-resolvers.repository.ts`
- Modify: `src/features/approvals/data/repositories/approval-analytics.repository.ts`
- Modify/Delete: the Phase-1/2/3 parity tests that import legacy functions
- Optional: drop the now-superseded old SQL functions (`get_finance_history_action_metrics`, `get_claim_bucket_metrics`) only if nothing else calls them

> **Why this phase exists:** Phases 1–4 introduced the new database-driven architecture. **Phase 5
> removes the transitional code and establishes guardrails so application-side claim-ID collection
> cannot re-enter the Finance module.**

> **Sub-phases:** **Phase 5a — Deletion** (Tasks 1–5): remove dead code, chunk helpers, constants, and
> dead SQL. **Phase 5b — Guardrails** (Tasks 6–7): retire the migration-only parity tests but keep one
> durable resolver-vs-reference-SQL regression test, add a forbidden-pattern guard, and document the
> permanent invariant.

---

## Phase 5a — Deletion

### Task 1: Verify each legacy symbol is unreferenced (except tests)

- [ ] **Step 1: Grep each symbol**

Run (for each name): confirm only its own definition + parity tests appear.

```bash
rg -n "getFilteredClaimIdsForFinance|collectActionClaimIds|collectHodClaimIds|collectClaimIdsInBatches|getActionFilteredClaimIds|getFinanceActionBuckets|getFilteredClaimsByIds|getLatestApprovalActionsByClaim" src
```

Expected: each appears only in its defining file and in `__tests__/*parity*.test.ts`. If a production
file still imports one, that consumer wasn't migrated — STOP and finish the relevant earlier phase.

- [ ] **Step 2: Grep the whole forbidden _pattern_ (not just function names)**

You are deleting an entire pattern (`filters → collect ids → arrays → chunk → merge → re-query`), not
just functions. Across all of `src`:

```bash
rg -n "SAFE_IN_BATCH_SIZE|collect.*Ids|intersectClaimIds|chunk|Promise\.all.*\.in\(" src
```

Expected after Phase 5a deletions: **zero matches** (outside any retained reference-SQL test). Anything
left is a survival of the pattern — remove it.

- [ ] **Step 3: Checkpoint (no change yet)** — record both grep outputs in the PR.

---

### Task 2: Remove `approvals` dead code (guardrail)

**Files:** Modify `src/features/approvals/data/repositories/approval-analytics.repository.ts`

- [ ] **Step 1: Delete the two unused functions**

Remove `getFilteredClaimsByIds` and `getLatestApprovalActionsByClaim` (and any now-unused types/imports
they alone used: `ApprovalActionRow`, `ClaimAmountRow`, `PendingApprovalsFilters` import, etc.). Leave
the genuinely-used exports in the file untouched.

- [ ] **Step 2: Typecheck + tests** — `npx tsc --noEmit`; `npx vitest run src/features/approvals/__tests__/`. Expected: green (the deleted functions had no callers).
- [ ] **Step 3: Checkpoint** — stage the file; STOP for owner to commit.

---

### Task 3: Remove finance ID-collection helpers

**Files:** Modify `finance-filters.repository.ts`, `analytics.query.ts`

- [ ] **Step 1: Delete from `finance-filters.repository.ts`**

Remove `getFilteredClaimIdsForFinance`, `collectActionClaimIds`, `collectHodClaimIds`,
`collectClaimIdsInBatches`, `assertClaimIdLimit`, and the constants `SAFE_IN_BATCH_SIZE`,
`FILTER_BATCH_SIZE`, `MAX_FILTERED_CLAIM_IDS`, plus now-unused imports/types (`CursorRow`,
`ActionCursorRow`, `ClaimFilterScope`, `toLikePattern`, etc.). Keep `isFinanceActionDateFilterField`
re-export only if other files still import it from here (grep first); otherwise remove. If the file
becomes empty, delete it and remove its imports elsewhere.

- [ ] **Step 2: Delete from `analytics.query.ts`**

Remove `getActionFilteredClaimIds`, `intersectClaimIds`, `ACTION_FILTER_BATCH_SIZE`,
`MAX_SCOPED_ACTION_CLAIMS`, and now-unused imports. Keep `getFinanceQueueAnalytics` (already rewired in
Phase 2).

- [ ] **Step 3: Typecheck + finance tests** — `npx tsc --noEmit`; `npx vitest run src/features/finance/__tests__/`. Expected: green, except the parity tests that import the deleted symbols (handled in Task 5).

- [ ] **Step 4: Checkpoint** — stage both files; STOP for owner to commit.

---

### Task 4: Remove superseded bucket/date-resolver helpers

**Files:** Modify `history-analytics.query.ts`, `filter-date-resolvers.repository.ts`

- [ ] **Step 1: Delete unused bucket helpers**

In `history-analytics.query.ts`, remove `getFinanceActionBuckets`, `normalizeFinanceHistoryActionCode`,
and related types if no longer referenced (Phase 2 moved bucketing into `finance_action_buckets()`).
In `filter-date-resolvers.repository.ts`, remove `getDateFilterTargetStatusIds`,
`getFinanceActionCodesForDateFilter`, `getFinanceApprovedStatusIds`, `getPaymentReleasedStatusIds`
**only if** Phase 3's history page no longer needs the TS-computed feed action codes. If the history
feed still passes `p_feed_action_codes` computed in TS, keep `getFinanceActionCodesForDateFilter` and
`getFinanceActionCodesForFilter`. Grep before deleting each.

- [ ] **Step 2: Typecheck + tests** — `npx tsc --noEmit`; `npx vitest run`. Expected: green (minus legacy parity imports).
- [ ] **Step 3: Checkpoint** — stage the files; STOP for owner to commit.

---

### Task 5 (Phase 5a deletion): Drop superseded SQL functions

- [ ] **Step 1: Confirm no callers**

```bash
rg -n "get_finance_history_action_metrics|get_claim_bucket_metrics" src
```

Expected: zero (Phase 2 replaced both). If `get_claim_bucket_metrics` is still used by a NON-finance
caller (e.g. claims dashboard), **keep it**. Only drop functions with zero references.

- [ ] **Step 2: Migration to drop (only the truly-unused ones)**

Create `supabase/migrations/20260618094000_drop_superseded_finance_metrics.sql`:

```sql
-- Drop ONLY if Step 1 proved zero references.
drop function if exists public.get_finance_history_action_metrics(uuid[],text,timestamptz,timestamptz,text[],text[],text[]);
-- get_claim_bucket_metrics: keep if any non-finance caller remains.
```

- [ ] **Step 3: Checkpoint** — stage migration; STOP for owner to commit.

---

## Phase 5b — Guardrails & invariant

### Task 6: Retire legacy-dependent parity tests; keep ONE durable regression test

**Files:** Modify/Delete the Phase-1/2/3/4 parity tests

- [ ] **Step 1: Delete the old-vs-new parity tests**

The Phase 1–4 parity tests imported legacy functions to compare old vs new. That job — proving
equivalence during migration — is **done**. Delete them (they cannot even compile once the legacy code
is gone).

- [ ] **Step 2: Keep exactly one durable resolver-vs-reference-SQL regression test**

This single test is the **architectural contract**: it asserts `finance_filtered_claim_ids(...)` output
equals a hand-written reference SQL query (resolver vs reference SQL — no legacy dependency, survives
forever). Opt-in `PARITY=1`, dynamic fixtures. It guards the resolver against future drift.

- [ ] **Step 3: Full test + typecheck** — `npx tsc --noEmit`; `npx vitest run`. Expected: ALL green, no dangling imports.
- [ ] **Step 4: Checkpoint** — stage the test changes; STOP for owner to commit.

---

### Task 7: Forbidden-pattern guard + documented invariant

- [ ] **Step 1: Add a CI guard for the forbidden pattern**

Add a check (npm script + CI step, or a lint rule) that fails the build if the collection pattern
reappears in the finance read paths:

```bash
# scripts/check-no-claim-id-collection.sh — exits non-zero on any match.
rg -n "SAFE_IN_BATCH_SIZE|collect.*Ids|intersectClaimIds|chunk|Promise\.all.*\.in\(" \
  src/features/finance src/app/\(app\)/approved-history \
  && { echo 'Forbidden claim-ID collection pattern detected'; exit 1; } || exit 0
```

Wire it into the test/lint pipeline so a regression is caught automatically.

- [ ] **Step 2: Document the invariant**

Add a short note to the finance module docs (or `CLAUDE.md` / a README near the finance data layer):

> **Finance read architecture invariant.** No Finance read path may materialize claim-ID collections
> whose size grows with claim count. **Allowed:** ≤ `limit` IDs, ≤ `limit + 1` IDs, employee-count
> aggregates. **Not allowed:** all matching claim IDs, cursor-collect loops, cross-page ID accumulation.
> Any future feature requiring claim filtering must compose through `finance_filtered_claim_ids()` or a
> resolver-backed RPC and must **not** introduce application-side claim-ID collection.

- [ ] **Step 3: Checkpoint** — stage the guard script + docs; STOP for owner to commit.

---

## Phase 5 Exit Criteria

**Phase 5a (deletion):**

- `rg` shows **zero** references to any legacy ID-collection function (`getFilteredClaimIdsForFinance`, `collect*`, `getActionFilteredClaimIds`, `getFinanceActionBuckets`, approvals dead code).
- `rg` shows **zero** matches for the pattern `SAFE_IN_BATCH_SIZE|collect.*Ids|intersectClaimIds|chunk|Promise.all(...).in(` in `src` (outside the one reference-SQL test).
- Zero dead exports remain; zero unused imports remain; no migration/compatibility shims remain.
- Repository surface reduced (the ~300-line `finance-filters.repository.ts` collector and the chunk/merge blocks are gone).
- Dead SQL dropped where it had zero callers.
- `npx tsc --noEmit` and `npx vitest run` fully green.

**Phase 5b (guardrails & invariant):**

- Exactly **one durable resolver-vs-reference-SQL regression test** remains as the architectural contract.
- A CI guard fails the build if the forbidden collection pattern reappears.
- The bounded-memory invariant is documented.

**Final architecture — all Finance read paths are:**

```
Parameters → SQL resolver → SQL RPC → Bounded enrichment
```

and never:

```
Parameters → Collect all IDs → Chunk → Merge → Re-query
```

**Bounded-memory invariant (permanent):** No Finance read path may materialize claim-ID collections
whose size grows with claim count. Allowed: ≤ `limit` / ≤ `limit + 1` IDs, employee-count aggregates.
Not allowed: all matching claim IDs, cursor-collect loops, cross-page ID accumulation.

> **Architectural constitution.** Completion of Phase 5 establishes the permanent Finance read
> architecture. Any future feature requiring claim filtering must compose through
> `finance_filtered_claim_ids()` or resolver-backed RPCs and must not introduce application-side
> claim-ID collection.
