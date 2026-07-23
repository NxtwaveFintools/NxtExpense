# PR #70 Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix seven confirmed/plausible issues surfaced by PR #70 code review — one confirmed count bug, one confirmed pagination bug, one confirmed stale test, two test coverage gaps, one magic-number inconsistency, and one duplicated hook pattern.

**Architecture:** All fixes are self-contained and independent. Tasks 1–3 fix correctness bugs. Tasks 4–5 add/repair test coverage. Task 6 removes a magic literal. Task 7 extracts a shared hook. Each task can be committed individually.

**Tech Stack:** TypeScript, Next.js 14 App Router, Supabase (PostgreSQL), Vitest, React

---

## Files at a glance

| File                                                                             | Task       |
| -------------------------------------------------------------------------------- | ---------- |
| `src/features/finance/utils/filters.ts`                                          | 1          |
| `src/features/finance/__tests__/finance-filters.test.ts`                         | 1          |
| `src/features/approvals/data/repositories/approvals.repository.ts`               | 2, 5       |
| `src/features/approvals/__tests__/approvals.repository.test.ts`                  | 2, 5       |
| `src/features/finance/__tests__/finance-workflow-actions.test.ts`                | 3          |
| `src/app/(app)/approved-history/payment-journals-export/__tests__/route.test.ts` | 4          |
| `src/features/finance/__tests__/finance-list-parity.test.ts`                     | 6          |
| `src/lib/hooks/use-debounced-navigate.ts`                                        | 7 (create) |
| `src/features/approvals/components/approval-filters-bar.tsx`                     | 7          |
| `src/features/finance/components/finance-filters-bar.tsx`                        | 7          |

---

## Task 1: Fix `hasFinanceClaimFilters` to include active action filters

**Background:** `get_finance_history_count` has two branches: when `p_has_filters=true` it counts rows for claims matching `finance_filtered_claim_ids(…p_action_filter…)`; when `p_has_filters=false` it runs `SELECT count(*) FROM finance_actions` with no predicate at all. TypeScript sends `p_has_filters=false` whenever `hasFinanceClaimFilters` returns false. Currently `hasFinanceClaimFilters` only returns true for `actionFilter='rejected_allow_reclaim'` — every other action filter value (e.g. `'finance_approved'`, `'finance_rejected'`, `'approved'`) is ignored, so the count returned is the entire `finance_actions` table instead of the filtered row count. This inflates pagination totals for any action-only filter.

**Files:**

- Modify: `src/features/finance/utils/filters.ts:51-64`
- Modify: `src/features/finance/__tests__/finance-filters.test.ts:87-120`

- [ ] **Step 1: Write the failing test**

  Open `src/features/finance/__tests__/finance-filters.test.ts`. Inside the `'detects whether claim-level filters are active'` test (around line 87), add one new assertion after the existing cases (before the closing `)`):

  ```ts
  expect(
    hasFinanceClaimFilters(
      normalizeFinanceFilters({
        actionFilter: 'finance_approved',
      })
    )
  ).toBe(true)
  ```

- [ ] **Step 2: Run the test to confirm it fails**

  ```
  npx vitest run src/features/finance/__tests__/finance-filters.test.ts
  ```

  Expected: FAIL — `expected false to be true`.

- [ ] **Step 3: Fix `hasFinanceClaimFilters` in `filters.ts`**

  Replace the `shouldForceAllowResubmitFromActionFilter` line with a broader check that treats any non-null, non-`'all'` action filter as active. (`'all'` is the UI sentinel meaning "show all actions"; `null` means no filter.)

  In `src/features/finance/utils/filters.ts`, replace:

  ```ts
  export function hasFinanceClaimFilters(filters: FinanceFilters): boolean {
    return Boolean(
      filters.employeeId ||
      filters.employeeName ||
      filters.claimNumber ||
      filters.ownerDesignation ||
      filters.hodApproverEmployeeId ||
      filters.claimStatus ||
      shouldForceAllowResubmitFromActionFilter(filters.actionFilter) ||
      filters.workLocation ||
      filters.dateFrom ||
      filters.dateTo
    )
  }
  ```

  with:

  ```ts
  export function hasFinanceClaimFilters(filters: FinanceFilters): boolean {
    return Boolean(
      filters.employeeId ||
      filters.employeeName ||
      filters.claimNumber ||
      filters.ownerDesignation ||
      filters.hodApproverEmployeeId ||
      filters.claimStatus ||
      (filters.actionFilter && filters.actionFilter !== 'all') ||
      filters.workLocation ||
      filters.dateFrom ||
      filters.dateTo
    )
  }
  ```

  The import of `shouldForceAllowResubmitFromActionFilter` at the top of `filters.ts` can be removed if it is no longer used in this file (check for other callers first — `action-filter.ts` still exports it for use in repository code, so removing only the import from `filters.ts` is safe).

- [ ] **Step 4: Run the tests to confirm they pass**

  ```
  npx vitest run src/features/finance/__tests__/finance-filters.test.ts
  ```

  Expected: all tests PASS including the new one.

- [ ] **Step 5: Run the full finance test suite to check for regressions**

  ```
  npx vitest run src/features/finance
  ```

  Expected: all PASS.

- [ ] **Step 6: Run the parity gate to confirm the count RPC now matches the feed**

  The count logic changed; the parity test is the only test that compares count-RPC results against actual feed rows end-to-end.

  ```
  PARITY=1 npx vitest run src/features/finance/__tests__/finance-list-parity.test.ts
  ```

  Expected: all PASS (requires a live Supabase connection — run from an environment with `SUPABASE_URL` and `SUPABASE_ANON_KEY` set).

---

## Task 2: Fix `hasNextPage` to throw on enrichment mismatch in approvals repository

**Background:** `getPendingApprovalsPaginated` in `approvals.repository.ts` computes `hasNextPage = idRows.length > limit` immediately from the RPC response (line 115). It then enriches those IDs via a second DB query. If any claims changed status between the two queries and are no longer returned by the enrichment, the `pending` array is shorter than `pageIds`. Silently showing fewer items with an active Next button is wrong, but silently hiding a real next page (the `pending.length === pageIds.length` approach) is also wrong. The correct behavior is to fail loudly: if the two queries diverge, something unexpected happened and the caller deserves an error rather than subtly wrong pagination.

**Files:**

- Modify: `src/features/approvals/data/repositories/approvals.repository.ts:113-116`

Note: The approvals repository test file path — grep for `getPendingApprovalsPaginated` in `src/features/approvals/__tests__` or `src/features/approvals/**/*.test.ts` to find it.

- [ ] **Step 1: Read the current code around line 113**

  In `src/features/approvals/data/repositories/approvals.repository.ts` lines 113-120, the current code is:

  ```ts
  const idRows = (pageRows ?? []) as Array<{ id: string; claim_date: string }>
  const hasNextPage = idRows.length > limit
  const pageIdRows = hasNextPage ? idRows.slice(0, limit) : idRows
  const pageIds = pageIdRows.map((row) => row.id)
  ```

  And around line 187–200:

  ```ts
  const pending: PendingApproval[] = pageIds
    .map((claimId) => {
      const row = claimRowById.get(claimId)
      if (!row) {
        return null
      }
      // ...
      return { ... }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  const lastRecord = pageIdRows.at(-1)
  const nextCursor =
    hasNextPage && lastRecord
      ? encodeCursor({ ... })
      : null

  return { data: pending, hasNextPage, nextCursor, limit }
  ```

- [ ] **Step 2: Apply the fix**

  The four lines at 113-116 stay as-is (`hasNextPage` name is fine). After the `pending` array is built and filtered (around line 187), add a guard that throws if any enrichment lookup missed:

  Find this block (currently after the pending `.filter(...)` call):

  ```ts
  const lastRecord = pageIdRows.at(-1)
  const nextCursor =
    hasNextPage && lastRecord
      ? encodeCursor({
          created_at: lastRecord.claim_date,
          id: lastRecord.id,
        })
      : null

  return {
    data: pending,
    hasNextPage,
    nextCursor,
    limit,
  }
  ```

  Replace with:

  ```ts
  if (pending.length !== pageIds.length) {
    throw new Error('Pending approvals changed during pagination enrichment')
  }

  const lastRecord = pageIdRows.at(-1)
  const nextCursor =
    hasNextPage && lastRecord
      ? encodeCursor({
          created_at: lastRecord.claim_date,
          id: lastRecord.id,
        })
      : null

  return {
    data: pending,
    hasNextPage,
    nextCursor,
    limit,
  }
  ```

- [ ] **Step 3: Run the approvals test suite**

  ```
  npx vitest run src/features/approvals
  ```

  Expected: all PASS.

---

## Task 3: Fix stale `actionFilter: null` assertion in finance-workflow-actions test

**Background:** In `src/features/finance/__tests__/finance-workflow-actions.test.ts`, the test `'should load finance history with normalized filters'` (around line 458) passes `actionFilter: 'finance_rejected'` as input and then asserts `getFinanceHistoryPaginated` was called with `actionFilter: null`. `normalizeFinanceFilters` calls `normalizeText(value.actionFilter)` which returns `'finance_rejected'` (non-empty string preserved as-is). The assertion contradicts the real behavior and fails in CI.

**Files:**

- Modify: `src/features/finance/__tests__/finance-workflow-actions.test.ts:476`

- [ ] **Step 1: Apply the fix**

  In `src/features/finance/__tests__/finance-workflow-actions.test.ts`, find line 476:

  ```ts
        actionFilter: null,
  ```

  That line is inside the `toHaveBeenCalledWith` assertion for the test that passes `actionFilter: 'finance_rejected'` as input. Change it to:

  ```ts
        actionFilter: 'finance_rejected',
  ```

  Context for finding the right line — the surrounding block looks like:

  ```ts
  it('should load finance history with normalized filters', async () => {
    // Act
    await getFinanceHistoryAction(null, 10, {
      actionFilter: 'finance_rejected',
    })

    // Assert
    expect(mocks.getFinanceHistoryPaginated).toHaveBeenCalledWith(
      expect.anything(),
      null,
      10,
      {
        employeeName: null,
        claimNumber: null,
        ownerDesignation: null,
        hodApproverEmployeeId: null,
        claimStatus: null,
        workLocation: null,
        actionFilter: null, // ← change this to 'finance_rejected'
        dateFilterField: 'claim_date',
        dateFrom: null,
        dateTo: null,
      }
    )
  })
  ```

- [ ] **Step 2: Run the test to confirm it passes**

  ```
  npx vitest run src/features/finance/__tests__/finance-workflow-actions.test.ts
  ```

  Expected: all PASS.

---

## Task 4: Add KM intercity pass-through test for payment journals export route

**Background:** When the payment journals export route was rewritten to delegate to `getFinancePaymentJournalTotals`, the test `'includes KM intercity travel amounts in employee totals'` was deleted. The replacement (opt-in parity test) does not run in standard CI. Without a standard CI test, a regression where KM/intercity claim amounts are silently excluded would go undetected. The route itself has no claim-type logic — it just formats whatever totals the query provides. The test should document the route correctly passes through amounts regardless of how they were accumulated.

**Files:**

- Modify: `src/app/(app)/approved-history/payment-journals-export/__tests__/route.test.ts`

- [ ] **Step 1: Add the test**

  Open `src/app/(app)/approved-history/payment-journals-export/__tests__/route.test.ts`. Append a new `it` block inside the `describe('approved-history Payment Journals export route', ...)` block (after the last existing test):

  ```ts
  it('formats totals returned by the aggregate query', async () => {
    // The totals query (getFinancePaymentJournalTotals) is responsible for including
    // the right claim types (including KM/intercity). The route's responsibility is
    // to faithfully format whatever totals it receives — this test verifies that contract.
    mocks.getFinancePaymentJournalTotals.mockResolvedValue(
      new Map<string, number>([
        ['NW0099001', 1200.75], // represents accumulated KM intercity reimbursements
      ])
    )

    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export'
      )
    )

    expect(response.status).toBe(200)

    const csv = await response.text()

    expect(csv).toContain('"NW0099001"')
    expect(csv).toContain('"1200.75"')
    expect(mocks.getFinancePaymentJournalTotals).toHaveBeenCalledTimes(1)
  })
  ```

- [ ] **Step 2: Run the test**

  ```
  npx vitest run "src/app/(app)/approved-history/payment-journals-export/__tests__/route.test.ts"
  ```

  Expected: all PASS including the new test.

---

## Task 5: Add test documenting empty-approvals behavior when actor has no employee record

**Background:** The old `getPendingApprovalsPaginated` called `getApproverActorByEmail` (a DB lookup) and returned `{ data: [], … }` immediately when the email had no employee record. The new code skips that lookup and calls the RPC directly. The `get_pending_approvals` RPC has `WITH me AS (SELECT … WHERE lower(employee_email) = current_user_email() LIMIT 1)` and `JOIN me ON true` — when `me` is empty (no employee for email), the outer query returns 0 rows, not an error. The behavior is identical to the old code, but there is no test documenting it. This test prevents regressions if the RPC implementation ever changes.

**Files:**

- Modify: Find the approvals repository test file. Run: `grep -rl "getPendingApprovalsPaginated" src/features/approvals/` — the test file will be in `src/features/approvals/__tests__/` or similar. Read it to understand the mock setup before adding the test.

- [ ] **Step 1: Find and read the repository test file**

  Run:

  ```
  rg -l "getPendingApprovalsPaginated" src/features/approvals/
  ```

  Open the file and read its mock setup (how it mocks `supabase.rpc`).

- [ ] **Step 2: Add the test**

  Inside the existing test describe block for `getPendingApprovalsPaginated`, add:

  ```ts
  it('returns empty data when the RPC returns no rows (actor has no employee record)', async () => {
    // get_pending_approvals returns 0 rows when the caller email has no employee record
    // (the JOIN me ON true eliminates all rows). The repository must return empty pagination,
    // not throw.
    mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null })

    const result = await getPendingApprovalsPaginated(
      mockSupabase as unknown as SupabaseClient,
      'unknown@nxtwave.co.in',
      null,
      10
    )

    expect(result).toEqual({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })
  })
  ```

  Adjust mock names (`mockSupabase`, `mockSupabase.rpc`) to match what the existing tests in that file use.

- [ ] **Step 3: Run the tests**

  ```
  npx vitest run src/features/approvals/__tests__
  ```

  Expected: all PASS.

---

## Task 6: Replace magic `3` with `MAX_APPROVAL_LEVEL` in finance parity test

**Background:** The same PR that introduced `MAX_APPROVAL_LEVEL = APPROVAL_LEVELS[APPROVAL_LEVELS.length - 1]` (in `src/lib/constants/approval-levels.ts`) to eliminate magic approval-level literals also introduced `finance-list-parity.test.ts` with `.eq('approval_level', 3)` in the `getFinanceReviewStatusId` helper. If the final approval level ever changes, the parity test would silently query the wrong level while all production code using `MAX_APPROVAL_LEVEL` adapts correctly.

**Files:**

- Modify: `src/features/finance/__tests__/finance-list-parity.test.ts:102`

- [ ] **Step 1: Add the import**

  At the top of `src/features/finance/__tests__/finance-list-parity.test.ts`, add the import (verify the existing imports section first to check if it's already imported):

  ```ts
  import { MAX_APPROVAL_LEVEL } from '@/lib/constants/approval-levels'
  ```

- [ ] **Step 2: Replace the literal**

  Find line ~102 (inside `getFinanceReviewStatusId`):

  ```ts
    .eq('approval_level', 3)
  ```

  Replace with:

  ```ts
    .eq('approval_level', MAX_APPROVAL_LEVEL)
  ```

- [ ] **Step 3: Run the tests**

  ```
  npx vitest run src/features/finance/__tests__/finance-list-parity.test.ts
  ```

  Expected: all PASS (this is a parity test that skips when `PARITY` env var is unset — confirm the test suite reports "skipped" or "passed", not "failed").

---

## Task 7: Extract `useDebouncedNavigate` shared hook

**Background:** `approval-filters-bar.tsx` and `finance-filters-bar.tsx` both implement the same non-trivial debounce-navigate pattern: track the current applied URL values in a ref (to avoid stale closures in the effect), compare debounced values against applied values, call `navigate(buildHref())` only when they diverge. The `buildHref` function is intentionally excluded from the effect's deps (it's re-created each render and captures current dropdown/date state — including it would cause infinite loops). This shared invariant belongs in one place.

**Files:**

- Create: `src/lib/hooks/use-debounced-navigate.ts`
- Modify: `src/features/approvals/components/approval-filters-bar.tsx`
- Modify: `src/features/finance/components/finance-filters-bar.tsx`

- [ ] **Step 1: Create the hook**

  Note: `useFilterNavigation` already wraps its `navigate` in `startTransition` internally — no need to add it here.

  Create `src/lib/hooks/use-debounced-navigate.ts`:

  ```ts
  import { useEffect, useRef } from 'react'

  /**
   * Fires navigate(buildHref()) whenever any debounced text value diverges from
   * its corresponding applied value. Both buildHref and navigate are captured via
   * refs so they are always called with the latest render's closures without being
   * deps — the only dep is the JSON-serialized debounced-key string, which changes
   * only when a text field's debounced value changes.
   */
  export function useDebouncedNavigate(
    debouncedValues: string[],
    appliedValues: string[],
    navigate: (href: string) => void,
    buildHref: () => string
  ): void {
    const appliedKeyRef = useRef(JSON.stringify(appliedValues))
    appliedKeyRef.current = JSON.stringify(appliedValues)

    const buildHrefRef = useRef(buildHref)
    buildHrefRef.current = buildHref

    const navigateRef = useRef(navigate)
    navigateRef.current = navigate

    const debouncedKey = JSON.stringify(debouncedValues)

    useEffect(() => {
      if (debouncedKey === appliedKeyRef.current) return
      navigateRef.current(buildHrefRef.current())
      // All mutable state is captured via refs. The only trigger is the debounced key.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedKey])
  }
  ```

- [ ] **Step 2: Update `approval-filters-bar.tsx`**

  In `src/features/approvals/components/approval-filters-bar.tsx`:
  1. Add the import:

     ```ts
     import { useDebouncedNavigate } from '@/lib/hooks/use-debounced-navigate'
     ```

  2. Remove these lines (the manual ref + effect):

     ```ts
     const appliedEmployeeName = filters.employeeName ?? ''
     const appliedEmployeeNameRef = useRef(appliedEmployeeName)
     appliedEmployeeNameRef.current = appliedEmployeeName
     ```

     and:

     ```ts
     useEffect(() => {
       if (debouncedEmployeeName === appliedEmployeeNameRef.current) {
         return
       }

       navigate(buildHref(debouncedEmployeeName))
       // buildHref is recreated each render, so it always captures the current
       // status/date/amount/location state when the debounce fires. This effect is
       // intentionally scoped to the employee-name field only — other filters apply
       // via the Apply button.
       // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [debouncedEmployeeName])
     ```

  3. Add the hook call in their place:

     ```ts
     useDebouncedNavigate(
       [debouncedEmployeeName],
       [filters.employeeName ?? ''],
       navigate,
       () => buildHref(debouncedEmployeeName)
     )
     ```

  4. Remove the `useRef` import if it is no longer used anywhere else in the file.

- [ ] **Step 3: Update `finance-filters-bar.tsx`**

  In `src/features/finance/components/finance-filters-bar.tsx`:
  1. Add the import:

     ```ts
     import { useDebouncedNavigate } from '@/lib/hooks/use-debounced-navigate'
     ```

  2. Remove these lines:

     ```ts
     const appliedText = {
       employeeId: filters.employeeId ?? '',
       employeeName: filters.employeeName ?? '',
       claimNumber: filters.claimNumber ?? '',
     }
     const appliedTextRef = useRef(appliedText)
     appliedTextRef.current = appliedText
     ```

     and:

     ```ts
     useEffect(() => {
       const applied = appliedTextRef.current
       const changed =
         debouncedEmployeeId !== applied.employeeId ||
         debouncedEmployeeName !== applied.employeeName ||
         debouncedClaimNumber !== applied.claimNumber

       if (!changed) {
         return
       }

       navigate(
         buildHref({
           employeeId: debouncedEmployeeId,
           employeeName: debouncedEmployeeName,
           claimNumber: debouncedClaimNumber,
         })
       )
       // buildHref is recreated each render, so it always captures the current
       // dropdown/date state when the debounce fires. This effect is intentionally
       // scoped to the text fields only — dropdowns/dates apply via the Apply button.
       // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [debouncedEmployeeId, debouncedEmployeeName, debouncedClaimNumber])
     ```

  3. Add the hook call in their place:

     ```ts
     useDebouncedNavigate(
       [debouncedEmployeeId, debouncedEmployeeName, debouncedClaimNumber],
       [
         filters.employeeId ?? '',
         filters.employeeName ?? '',
         filters.claimNumber ?? '',
       ],
       navigate,
       () =>
         buildHref({
           employeeId: debouncedEmployeeId,
           employeeName: debouncedEmployeeName,
           claimNumber: debouncedClaimNumber,
         })
     )
     ```

  4. Remove `useRef` from the React import if it is no longer used elsewhere in `finance-filters-bar.tsx`.

- [ ] **Step 4: Run TypeScript check**

  ```
  npx tsc --noEmit 2>&1 | head -40
  ```

  Expected: no errors related to the changed files.

- [ ] **Step 5: Run the relevant test suite**

  ```
  npx vitest run src/features/approvals src/features/finance src/lib/hooks
  ```

  Expected: all PASS.

---

## Self-Review

**Spec coverage:**

- Finding 1 (count ignores actionFilter) → Task 1 ✓
- Finding 2 (hasNextPage from RPC not enriched count) → Task 2 ✓
- Finding 3 (stale actionFilter:null assertion) → Task 3 ✓
- Finding 4 (KM intercity test deleted) → Task 4 ✓
- Finding 5 (DB-level actor check removed) → Task 5 ✓
- Finding 6 (hardcoded 3 vs MAX_APPROVAL_LEVEL) → Task 6 ✓
- Finding 7 (useDebouncedNavigate duplication) → Task 7 ✓

**Placeholder scan:** All steps include exact file paths, exact code blocks, and exact run commands. No TBDs.

**Type consistency:**

- `useDebouncedNavigate` is defined in Task 7 Step 1 and called with the same signature in Steps 2 and 3.
- `hasMoreFromRpc` is introduced in Task 2 Step 2 and consistently used in the reconciled `hasNextPage` computation.
