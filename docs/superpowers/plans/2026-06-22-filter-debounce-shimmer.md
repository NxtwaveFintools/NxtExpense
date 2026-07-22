# Debounced Filters + Scoped Results Shimmer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make text filters on `/approvals`, `/approved-history`, and `/finance` auto-apply ~400ms after typing stops, and show a skeleton shimmer over the results region (analytics cards + tables) while a filter change is fetching.

**Architecture:** A `useDebouncedValue` hook drives auto-navigation from the filter bars. A `FilterNavigationProvider` (React `useTransition`) wraps each page's content and exposes `{ isPending, navigate }`; `navigate` runs `router.push` inside `startTransition` so `isPending` stays true for the full server round-trip. A `PendingResults` boundary swaps each results section for a skeleton while `isPending` is true. The filter bar stays outside the boundary so it remains interactive.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript, Tailwind CSS v4, Vitest + Testing Library (jsdom).

**Note on commits:** The repository owner handles all git commits. Do **not** run `git commit`. After each task, leave changes staged-or-unstaged for the owner to review and commit.

---

## File Structure

**Create:**

- `src/lib/hooks/use-debounced-value.ts` — generic debounce hook.
- `src/lib/hooks/__tests__/use-debounced-value.test.ts` — unit tests for the hook.
- `src/components/ui/filter-navigation.tsx` — `FilterNavigationProvider` + `useFilterNavigation` context.
- `src/components/ui/pending-results.tsx` — `PendingResults` boundary.
- `src/components/ui/results-skeletons.tsx` — `TableSkeleton` + `AnalyticsCardsSkeleton`.
- `src/components/ui/__tests__/pending-results.test.tsx` — boundary behavior test.

**Modify:**

- `src/features/finance/components/finance-filters-bar.tsx` — debounce text inputs + route through `useFilterNavigation`.
- `src/features/approvals/components/approval-filters-bar.tsx` — debounce Employee Name + route through `useFilterNavigation`.
- `src/app/(app)/finance/page.tsx` — wrap content in provider + `PendingResults`.
- `src/app/(app)/approved-history/page.tsx` — wrap content in provider + `PendingResults`.
- `src/app/(app)/approvals/page.tsx` — wrap content in provider + `PendingResults`.

---

### Task 1: `useDebouncedValue` hook

**Files:**

- Create: `src/lib/hooks/use-debounced-value.ts`
- Test: `src/lib/hooks/__tests__/use-debounced-value.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/hooks/__tests__/use-debounced-value.test.ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 400))
    expect(result.current).toBe('a')
  })

  it('settles to the latest value after the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 400),
      { initialProps: { value: 'a' } }
    )

    rerender({ value: 'ab' })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current).toBe('ab')
  })

  it('cancels intermediate values on rapid change', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 400),
      { initialProps: { value: 'a' } }
    )

    rerender({ value: 'ab' })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    rerender({ value: 'abc' })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('abc')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/hooks/__tests__/use-debounced-value.test.ts`
Expected: FAIL — cannot resolve `@/lib/hooks/use-debounced-value`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/hooks/use-debounced-value.ts
import { useEffect, useState } from 'react'

/**
 * Returns `value` after it has stopped changing for `delayMs`. Useful for
 * search-as-you-type inputs that should only act once the user pauses.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [value, delayMs])

  return debouncedValue
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/hooks/__tests__/use-debounced-value.test.ts`
Expected: PASS (3 tests).

---

### Task 2: `FilterNavigationProvider` + `useFilterNavigation`

**Files:**

- Create: `src/components/ui/filter-navigation.tsx`

- [ ] **Step 1: Write the implementation**

```tsx
// src/components/ui/filter-navigation.tsx
'use client'

import { createContext, useCallback, useContext, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type FilterNavigationContextValue = {
  isPending: boolean
  navigate: (href: string) => void
}

const FilterNavigationContext =
  createContext<FilterNavigationContextValue | null>(null)

/**
 * Wraps a page's content region so filter changes can navigate inside a
 * transition. While the transition is pending, consumers can render skeletons
 * over the results without blocking the filter inputs.
 */
export function FilterNavigationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const navigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href)
      })
    },
    [router]
  )

  return (
    <FilterNavigationContext.Provider value={{ isPending, navigate }}>
      {children}
    </FilterNavigationContext.Provider>
  )
}

export function useFilterNavigation(): FilterNavigationContextValue {
  const context = useContext(FilterNavigationContext)

  if (!context) {
    throw new Error(
      'useFilterNavigation must be used within a FilterNavigationProvider'
    )
  }

  return context
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `filter-navigation.tsx`.

---

### Task 3: Results skeleton building blocks

**Files:**

- Create: `src/components/ui/results-skeletons.tsx`

- [ ] **Step 1: Write the implementation**

```tsx
// src/components/ui/results-skeletons.tsx
import { Skeleton } from '@/components/ui/skeleton'

type TableSkeletonProps = {
  columns?: number
  rows?: number
  minWidthClassName?: string
}

/**
 * Skeleton placeholder for a results table. Mirrors the table markup used in
 * the route `loading.tsx` files so the shimmer matches the real layout.
 */
export function TableSkeleton({
  columns = 8,
  rows = 5,
  minWidthClassName = 'min-w-215',
}: TableSkeletonProps) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <Skeleton className="mb-4 h-7 w-36" />
      <div className="overflow-x-auto">
        <table
          className={`w-full ${minWidthClassName} border-collapse text-sm`}
        >
          <thead>
            <tr className="border-b border-border text-left">
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index} className="px-3 py-2">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/70">
                {Array.from({ length: columns }).map((__, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-3">
                    <Skeleton className="h-4 w-full max-w-28" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-end">
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </section>
  )
}

type AnalyticsCardsSkeletonProps = {
  count?: number
  columnsClassName?: string
}

/**
 * Skeleton placeholder for the `ClaimAnalyticsCards` strip.
 */
export function AnalyticsCardsSkeleton({
  count = 4,
  columnsClassName = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4',
}: AnalyticsCardsSkeletonProps) {
  return (
    <div className={columnsClassName}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-border bg-surface p-5"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-4 w-20" />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `results-skeletons.tsx`.

---

### Task 4: `PendingResults` boundary

**Files:**

- Create: `src/components/ui/pending-results.tsx`
- Test: `src/components/ui/__tests__/pending-results.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/__tests__/pending-results.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PendingResults } from '@/components/ui/pending-results'

vi.mock('@/components/ui/filter-navigation', () => ({
  useFilterNavigation: vi.fn(),
}))

import { useFilterNavigation } from '@/components/ui/filter-navigation'

const mockUseFilterNavigation = vi.mocked(useFilterNavigation)

describe('PendingResults', () => {
  it('renders children when not pending', () => {
    mockUseFilterNavigation.mockReturnValue({
      isPending: false,
      navigate: vi.fn(),
    })

    render(
      <PendingResults skeleton={<div>loading</div>}>
        <div>results</div>
      </PendingResults>
    )

    expect(screen.getByText('results')).toBeTruthy()
    expect(screen.queryByText('loading')).toBeNull()
  })

  it('renders the skeleton when pending', () => {
    mockUseFilterNavigation.mockReturnValue({
      isPending: true,
      navigate: vi.fn(),
    })

    render(
      <PendingResults skeleton={<div>loading</div>}>
        <div>results</div>
      </PendingResults>
    )

    expect(screen.getByText('loading')).toBeTruthy()
    expect(screen.queryByText('results')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/__tests__/pending-results.test.tsx`
Expected: FAIL — cannot resolve `@/components/ui/pending-results`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/ui/pending-results.tsx
'use client'

import { useFilterNavigation } from '@/components/ui/filter-navigation'

/**
 * Renders `children`, swapping in `skeleton` while a filter navigation is in
 * flight, so only the results region shows the loading state.
 */
export function PendingResults({
  skeleton,
  children,
}: {
  skeleton: React.ReactNode
  children: React.ReactNode
}) {
  const { isPending } = useFilterNavigation()

  return <>{isPending ? skeleton : children}</>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/__tests__/pending-results.test.tsx`
Expected: PASS (2 tests).

---

### Task 5: Auto-apply + transition navigation in `FinanceFiltersBar`

**Files:**

- Modify: `src/features/finance/components/finance-filters-bar.tsx`

Context: this component is used by both `/finance` (Employee Name + Claim Number text fields; `showEmployeeIdFilter` false) and `/approved-history` (Employee ID + Employee Name + Claim Number). The text fields to debounce are `employeeId`, `employeeName`, `claimNumber`.

- [ ] **Step 1: Add imports**

At the top of the file, add the `useEffect`/`useRef` React imports and the new hooks. Replace the existing React import line:

```tsx
import { useDeferredValue, useState } from 'react'
```

with:

```tsx
import { useEffect, useDeferredValue, useRef, useState } from 'react'
```

Remove the `useRouter` import (navigation now goes through the context):

```tsx
import { useRouter } from 'next/navigation'
```

Add after the existing component imports:

```tsx
import { useFilterNavigation } from '@/components/ui/filter-navigation'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
```

- [ ] **Step 2: Replace router with filter navigation**

Replace:

```tsx
const router = useRouter()
```

with:

```tsx
const { navigate } = useFilterNavigation()
```

- [ ] **Step 3: Add a shared params builder and helpers**

Inside the component, after the `useState` declarations and the existing
`deferredEmployeeName` line, add the debounced values, an applied-values ref,
and a helper that builds the destination href from explicit text values merged
with the current dropdown/date state:

```tsx
const debouncedEmployeeId = useDebouncedValue(employeeId, 400)
const debouncedEmployeeName = useDebouncedValue(employeeName, 400)
const debouncedClaimNumber = useDebouncedValue(claimNumber, 400)

const appliedText = {
  employeeId: filters.employeeId ?? '',
  employeeName: filters.employeeName ?? '',
  claimNumber: filters.claimNumber ?? '',
}
const appliedTextRef = useRef(appliedText)
appliedTextRef.current = appliedText

function buildHref(text: {
  employeeId: string
  employeeName: string
  claimNumber: string
}): string {
  const params = new URLSearchParams()
  if (showEmployeeIdFilter && text.employeeId)
    params.set('employeeId', text.employeeId)
  if (text.employeeName) params.set('employeeName', text.employeeName)
  if (text.claimNumber) params.set('claimNumber', text.claimNumber)
  if (ownerDesignation) params.set('ownerDesignation', ownerDesignation)
  if (showHodApproverFilter && hodApproverEmployeeId)
    params.set('hodApproverEmployeeId', hodApproverEmployeeId)
  if (showClaimStatusFilter && claimStatus) {
    params.set('claimStatus', claimStatus)
  }
  if (workLocation) params.set('workLocation', workLocation)
  if (showActionFilter && actionFilter) {
    params.set('actionFilter', actionFilter)
  }
  if (showDateFilter) {
    if (dateFilterField !== 'claim_date') {
      params.set('dateFilterField', dateFilterField)
    }
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
  }
  const qs = params.toString()
  return `${pathname}${qs ? `?${qs}` : ''}`
}
```

- [ ] **Step 4: Add the auto-apply effect**

Add immediately after the `buildHref` helper. It navigates only when a debounced
text value differs from the applied value (tracked via ref so a Clear/Apply that
updates props does not re-trigger):

```tsx
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [debouncedEmployeeId, debouncedEmployeeName, debouncedClaimNumber])
```

- [ ] **Step 5: Route the Apply handler through `navigate` and reuse `buildHref`**

Replace the body of `handleSubmit` (currently building `params` and calling
`router.push`) with a call that reuses `buildHref` against the live text state:

```tsx
function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  navigate(
    buildHref({
      employeeId,
      employeeName,
      claimNumber,
    })
  )
}
```

- [ ] **Step 6: Route the Clear handler through `navigate`**

In `handleClear`, replace the final line `router.push(pathname)` with:

```tsx
navigate(pathname)
```

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no new errors in `finance-filters-bar.tsx`.

Run: `npm run lint`
Expected: no new errors in `finance-filters-bar.tsx`.

---

### Task 6: Auto-apply + transition navigation in `ApprovalFiltersBar`

**Files:**

- Modify: `src/features/approvals/components/approval-filters-bar.tsx`

Context: only the `employeeName` text field is debounced here. All other
fields (status/date/amount/location) keep the Apply button.

- [ ] **Step 1: Add imports**

Replace:

```tsx
import { useDeferredValue, useState } from 'react'
import { useRouter } from 'next/navigation'
```

with:

```tsx
import { useDeferredValue, useEffect, useRef, useState } from 'react'
```

Add after the existing component imports:

```tsx
import { useFilterNavigation } from '@/components/ui/filter-navigation'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
```

- [ ] **Step 2: Replace router with filter navigation**

Replace:

```tsx
const router = useRouter()
```

with:

```tsx
const { navigate } = useFilterNavigation()
```

- [ ] **Step 3: Add a shared href builder, debounced value, and applied ref**

After the `deferredEmployeeName` line, add a helper that builds the `/approvals`
href from an explicit employee-name value plus the current non-text state, then
the debounced value and applied ref:

```tsx
function buildHref(employeeNameValue: string): string {
  const parsedAmount = toNullable(amountValue)
  const amountAsNumber = parsedAmount === null ? null : Number(parsedAmount)

  const nextFilters: ApprovalHistoryFilters = {
    claimStatus: toNullable(claimStatus),
    employeeName: toNullable(employeeNameValue),
    claimDateFrom: toNullable(claimDateFrom),
    claimDateTo: toNullable(claimDateTo),
    amountOperator,
    amountValue:
      amountAsNumber !== null && Number.isFinite(amountAsNumber)
        ? amountAsNumber
        : null,
    locationType: locationType || null,
    claimDateSort,
    hodApprovedFrom: filters.hodApprovedFrom,
    hodApprovedTo: filters.hodApprovedTo,
    financeApprovedFrom: filters.financeApprovedFrom,
    financeApprovedTo: filters.financeApprovedTo,
  }

  const params = addApprovalFiltersToParams(new URLSearchParams(), nextFilters)
  const queryString = params.toString()
  return queryString ? `/approvals?${queryString}` : '/approvals'
}

const debouncedEmployeeName = useDebouncedValue(employeeName, 400)
const appliedEmployeeName = filters.employeeName ?? ''
const appliedEmployeeNameRef = useRef(appliedEmployeeName)
appliedEmployeeNameRef.current = appliedEmployeeName
```

- [ ] **Step 4: Add the auto-apply effect**

Add after the block from Step 3:

```tsx
useEffect(() => {
  if (debouncedEmployeeName === appliedEmployeeNameRef.current) {
    return
  }

  navigate(buildHref(debouncedEmployeeName))
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [debouncedEmployeeName])
```

- [ ] **Step 5: Route the Apply handler through `navigate` and reuse `buildHref`**

Replace the body of `handleSubmit` with:

```tsx
function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  navigate(buildHref(employeeName))
}
```

- [ ] **Step 6: Route the Clear handler through `navigate`**

In `handleClear`, replace the final line `router.push('/approvals')` with:

```tsx
navigate('/approvals')
```

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no new errors in `approval-filters-bar.tsx`.

Run: `npm run lint`
Expected: no new errors in `approval-filters-bar.tsx`.

---

### Task 7: Wire `/finance` page with provider + boundaries

**Files:**

- Modify: `src/app/(app)/finance/page.tsx`

- [ ] **Step 1: Add imports**

Add to the existing component-import block:

```tsx
import { FilterNavigationProvider } from '@/components/ui/filter-navigation'
import { PendingResults } from '@/components/ui/pending-results'
import {
  AnalyticsCardsSkeleton,
  TableSkeleton,
} from '@/components/ui/results-skeletons'
```

- [ ] **Step 2: Wrap content in the provider and boundaries**

Replace the JSX block that currently reads:

```tsx
          <div className="space-y-6">
            <FinanceFiltersBar
              pathname="/finance"
              heading="Pending Claims Filters"
              filters={effectiveFilters}
              options={filterOptions}
              showHodApproverFilter={false}
              showClaimStatusFilter={false}
              showActionFilter={false}
              dateFilterOptions={PENDING_CLAIMS_DATE_FILTER_OPTIONS}
              exportCurrentPageHref={exportCurrentPageHref}
              exportAllHref={exportAllHref}
            />
            <ClaimAnalyticsCards
              cards={[
```

through the closing of `FinanceQueue` and `</div>`, wrapping it like this
(filter bar stays outside any `PendingResults`):

```tsx
<FilterNavigationProvider>
  <div className="space-y-6">
    <FinanceFiltersBar
      pathname="/finance"
      heading="Pending Claims Filters"
      filters={effectiveFilters}
      options={filterOptions}
      showHodApproverFilter={false}
      showClaimStatusFilter={false}
      showActionFilter={false}
      dateFilterOptions={PENDING_CLAIMS_DATE_FILTER_OPTIONS}
      exportCurrentPageHref={exportCurrentPageHref}
      exportAllHref={exportAllHref}
    />
    <PendingResults skeleton={<AnalyticsCardsSkeleton count={4} />}>
      <ClaimAnalyticsCards
        cards={[
          {
            label: 'Total Claims',
            count: analytics.total.count,
            amount: analytics.total.amount,
            tone: 'neutral',
          },
          {
            label: 'Pending Claims',
            count: analytics.pendingFinanceQueue.count,
            amount: analytics.pendingFinanceQueue.amount,
            tone: 'finance',
          },
          {
            label: 'Payment Released',
            count: analytics.approved.count,
            amount: analytics.approved.amount,
            tone: 'approved',
          },
          {
            label: 'Rejected',
            count: analytics.rejected.count,
            amount: analytics.rejected.amount,
            tone: 'rejected',
          },
        ]}
      />
    </PendingResults>
    <PendingResults
      skeleton={
        <TableSkeleton columns={8} rows={5} minWidthClassName="min-w-215" />
      }
    >
      <FinanceQueue
        queue={queue}
        pagination={{
          ...queuePagination,
          pageSize: queue.limit,
          pageSizeOptions: [...CURSOR_PAGE_SIZE_OPTIONS],
          pageSizeHrefByValue,
          totalPages: queueTotalPages,
          totalItems: queueTotalCount,
        }}
      />
    </PendingResults>
  </div>
</FilterNavigationProvider>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors in `finance/page.tsx`.

---

### Task 8: Wire `/approved-history` page with provider + boundaries

**Files:**

- Modify: `src/app/(app)/approved-history/page.tsx`

- [ ] **Step 1: Add imports**

Add to the existing component-import block:

```tsx
import { FilterNavigationProvider } from '@/components/ui/filter-navigation'
import { PendingResults } from '@/components/ui/pending-results'
import {
  AnalyticsCardsSkeleton,
  TableSkeleton,
} from '@/components/ui/results-skeletons'
```

- [ ] **Step 2: Wrap content in the provider and boundaries**

Replace the `<div className="space-y-6">…</div>` block so the filter bar stays
outside the boundaries and the analytics + history list each get a skeleton:

```tsx
<FilterNavigationProvider>
  <div className="space-y-6">
    <FinanceFiltersBar
      pathname="/approved-history"
      heading="Approved History Filters"
      filters={effectiveFilters}
      options={filterOptions}
      showEmployeeIdFilter
      showHodApproverFilter={false}
      showClaimStatusFilter={false}
      approvedHistoryExportAllHref={exportAllHref}
      approvedHistoryBcExpenseHref={exportBcExpenseHref}
      approvedHistoryPaymentJournalsHref={exportPaymentJournalsHref}
    />
    <PendingResults
      skeleton={
        <AnalyticsCardsSkeleton
          count={5}
          columnsClassName="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
        />
      }
    >
      <ClaimAnalyticsCards
        cards={[
          {
            label: 'Total History Records',
            count: analytics.total.count,
            amount: analytics.total.amount,
            tone: 'neutral',
          },
          {
            label: 'Approved History',
            count: analytics.approvedHistory.count,
            amount: analytics.approvedHistory.amount,
            tone: 'approved',
          },
          {
            label: 'Rejected In Finance',
            count: analytics.rejected.count,
            amount: analytics.rejected.amount,
            tone: 'rejected',
          },
          {
            label: 'Rejected & Allow Reclaim',
            count: analytics.rejectedAllowReclaim.count,
            amount: analytics.rejectedAllowReclaim.amount,
            tone: 'pending',
          },
          {
            label: 'Other Actions',
            count: analytics.other.count,
            amount: analytics.other.amount,
            tone: 'finance',
          },
        ]}
      />
    </PendingResults>
    <PendingResults
      skeleton={
        <TableSkeleton columns={8} rows={5} minWidthClassName="min-w-245" />
      }
    >
      <FinanceHistoryList
        source="approved-history"
        history={history}
        pagination={{
          ...historyPagination,
          pageSize: history.limit,
          pageSizeOptions: [...CURSOR_PAGE_SIZE_OPTIONS],
          pageSizeHrefByValue,
          totalPages: historyTotalPages,
          totalItems: historyTotalCount,
        }}
      />
    </PendingResults>
  </div>
</FilterNavigationProvider>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors in `approved-history/page.tsx`.

---

### Task 9: Wire `/approvals` page with provider + boundaries

**Files:**

- Modify: `src/app/(app)/approvals/page.tsx`

- [ ] **Step 1: Add imports**

Add to the existing component-import block:

```tsx
import { FilterNavigationProvider } from '@/components/ui/filter-navigation'
import { PendingResults } from '@/components/ui/pending-results'
import {
  AnalyticsCardsSkeleton,
  TableSkeleton,
} from '@/components/ui/results-skeletons'
```

- [ ] **Step 2: Wrap content in the provider and boundaries**

Replace the `<div className="space-y-6">…</div>` block so the filter bar stays
outside the boundaries and the analytics cards, pending list, and history list
each get a skeleton:

```tsx
<FilterNavigationProvider>
  <div className="space-y-6">
    <ApprovalFiltersBar
      filters={normalizedFilters}
      statusCatalog={statusCatalog}
      validationError={filterValidationError}
      exportCurrentPageHref={exportCurrentPageHref}
      exportAllHref={exportAllHref}
    />
    <PendingResults
      skeleton={
        <AnalyticsCardsSkeleton
          count={5}
          columnsClassName="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
        />
      }
    >
      <ClaimAnalyticsCards
        columnsClassName="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
        cards={[
          {
            label: 'Total Claims',
            count: approvalAnalytics.total.count,
            amount: approvalAnalytics.total.amount,
            tone: 'neutral',
          },
          {
            label: 'Pending Approvals',
            count: approvalAnalytics.pendingApprovals.count,
            amount: approvalAnalytics.pendingApprovals.amount,
            tone: 'pending',
          },
          {
            label: 'Approved Claims',
            count: approvalAnalytics.approvedClaims.count,
            amount: approvalAnalytics.approvedClaims.amount,
            tone: 'approved',
          },
          {
            label: 'Payment Released',
            count: approvalAnalytics.paymentIssuedClaims.count,
            amount: approvalAnalytics.paymentIssuedClaims.amount,
            tone: 'finance',
          },
          {
            label: 'Rejected Claims',
            count: approvalAnalytics.rejectedClaims.count,
            amount: approvalAnalytics.rejectedClaims.amount,
            tone: 'rejected',
          },
        ]}
      />
    </PendingResults>
    <PendingResults
      skeleton={
        <TableSkeleton columns={7} rows={5} minWidthClassName="min-w-200" />
      }
    >
      <ApprovalList
        approvals={approvals}
        pagination={{
          ...pendingPagination,
          pageSize: approvals.limit,
          totalPages: pendingTotalPages,
          totalItems: pendingTotalCount,
        }}
        dateSort={normalizedFilters.claimDateSort}
      />
    </PendingResults>
    <PendingResults
      skeleton={
        <TableSkeleton columns={7} rows={5} minWidthClassName="min-w-200" />
      }
    >
      <ApprovalHistoryList
        history={history}
        showAmountColumn={showHistoryAmountColumn}
        pagination={{
          ...historyPagination,
          pageSize: history.limit,
          totalPages: historyTotalPages,
          totalItems: historyTotalCount,
        }}
      />
    </PendingResults>
  </div>
</FilterNavigationProvider>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors in `approvals/page.tsx`.

---

### Task 10: Full verification

- [ ] **Step 1: Run the unit test suite**

Run: `npm test`
Expected: PASS (including the two new test files).

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Manual smoke (dev server)**

Run: `npm run dev`, then for each of `/approvals`, `/approved-history`, `/finance`:

- Type in each debounced text filter; confirm results auto-apply ~400ms after
  typing stops and the results region (analytics cards + tables) shows a
  skeleton shimmer while loading, with the filter bar staying interactive.
- Click **Apply Filters** and **Clear**; confirm they still work and trigger the
  same shimmer.
- Confirm no full-page skeleton and no shimmer over the filter bar.

---

## Self-Review Notes

- **Spec coverage:** Debounce (Tasks 5–6), transition-based loading signal
  (Task 2), results-only skeleton incl. analytics cards (Tasks 3–4, 7–9),
  Apply/Clear routed through the same navigation (Tasks 5–6). All spec sections
  covered.
- **Type consistency:** `useFilterNavigation()` returns `{ isPending, navigate }`
  everywhere; `navigate(href: string)`; `PendingResults` props `{ skeleton, children }`;
  `TableSkeleton`/`AnalyticsCardsSkeleton` prop names match usage in Tasks 7–9.
- **Min-width classes** for `ApprovalList`/`ApprovalHistoryList` skeletons
  (`min-w-200`) are approximate; the executor should confirm against the real
  table widths in `approval-list-table.tsx` / `approval-history-list.tsx` and
  match the `minWidthClassName` (and column count) if they differ.
