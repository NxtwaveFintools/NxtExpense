# Debounced Filters + Scoped Results Shimmer

Date: 2026-06-22
Status: Approved (design), pending implementation

## Problem

On `/approvals`, `/approved-history`, and `/finance`, filters use a form-submit
model: the user types into text inputs and must click **Apply Filters** to
trigger a `router.push` that re-fetches server data. Two UX gaps:

1. **No debounced live search.** Text filters (Employee ID, Employee Name, Claim
   Number) require an explicit Apply click; there is no search-as-you-type.
2. **No loading feedback on filter changes.** The pages are server components
   that read `searchParams`. When a filter applies via `router.push` to the
   _same route_, Next.js performs a soft navigation and keeps the **old content
   visible** until new data arrives. `loading.tsx` only fires on the initial
   hard load, not on subsequent filter changes — so the page appears frozen with
   no indication it is loading.

## Goals

- Text filters auto-apply ~400ms after the user stops typing (debounced).
  - Finance (`/finance`, `/approved-history`): Employee ID, Employee Name, Claim Number.
  - Approvals (`/approvals`): Employee Name.
- Dropdown / date filters keep the explicit **Apply Filters** button.
- While a filter change is fetching, show a skeleton shimmer **only over the
  results region** (analytics count cards + claim tables/lists) — never the
  full page, and never the filter bar (which stays interactive).

## Non-Goals

- No change to the employee-name suggestion dropdown (keeps its existing
  `useDeferredValue` fetch behavior).
- No change to server-side filtering, pagination, or export logic.
- Dashboard (`/dashboard`) finance filters are out of scope.

## Architecture

### New shared primitives

1. **`useDebouncedValue<T>(value, delayMs = 400)`** (`src/lib/hooks/use-debounced-value.ts`)
   Returns `value` after it has stopped changing for `delayMs`. Cleans up its
   timer on change/unmount.

2. **`FilterNavigationProvider` + `useFilterNavigation()`**
   (`src/components/ui/filter-navigation.tsx`)
   Client context wrapping each page's content region. Internally uses
   `useTransition`; exposes `{ isPending, navigate(href: string) }`. `navigate`
   calls `router.push(href)` **inside `startTransition`**, so `isPending` stays
   `true` for the full server round-trip — including the canonicalizing
   `redirect()` — until the new results commit. This is the reliable loading
   signal that `loading.tsx` cannot provide for same-route filter changes.

3. **`PendingResults`** (`src/components/ui/pending-results.tsx`)
   Client boundary. Renders `children` normally; while `useFilterNavigation().isPending`
   is `true`, renders the `skeleton` prop instead.

4. **Skeleton building blocks** (reuse existing `src/components/ui/skeleton.tsx`):
   - **`TableSkeleton`** — configurable `columns` / `rows`, mirrors the table
     markup already used in the route `loading.tsx` files.
   - **`AnalyticsCardsSkeleton`** — placeholder grid matching `ClaimAnalyticsCards`.

### Filter-bar changes

`src/features/finance/components/finance-filters-bar.tsx` and
`src/features/approvals/components/approval-filters-bar.tsx`:

- Debounce the relevant text inputs with `useDebouncedValue`.
- Track the currently-**applied** values (from props) in a ref. An effect keyed
  on the debounced text values navigates when any debounced value differs from
  the applied ref. Keying on the debounced values only (applied via ref) avoids
  a Clear/Apply race where a stale debounced value would re-trigger navigation
  after props update.
- Auto-navigation merges the debounced text values with the already-applied
  dropdown/date filters (from props), and resets pagination (no cursor params),
  matching current Apply behavior.
- **Apply Filters** and **Clear** keep working but route through
  `useFilterNavigation().navigate(...)` instead of calling `router.push`
  directly, so they trigger the same shimmer.

### Page changes

`/finance`, `/approved-history`, `/approvals` `page.tsx`:

- Wrap the content region (`<div className="space-y-6">`) in
  `FilterNavigationProvider`.
- Leave the filter bar outside any `PendingResults` boundary (stays interactive).
- Wrap the analytics cards in a `PendingResults` with `AnalyticsCardsSkeleton`.
- Wrap each list/table section (`FinanceQueue`, `FinanceHistoryList`,
  `ApprovalList`, `ApprovalHistoryList`) in a `PendingResults` with a
  `TableSkeleton` sized to that table.

## Data flow

1. User types in a debounced text field → local state updates immediately
   (input stays responsive).
2. After 400ms idle, `useDebouncedValue` settles → effect compares to applied
   ref → calls `navigate(href)`.
3. `navigate` runs `router.push` inside `startTransition` → `isPending = true`.
4. Every `PendingResults` in the provider swaps to its skeleton; filter bar
   stays live.
5. Server re-renders the page (incl. `redirect()` canonicalization) → new RSC
   payload commits → `isPending = false` → real results render.

## Edge cases

- **Clear/Apply race:** effect keyed only on debounced values (applied tracked
  via ref) → no spurious navigation after props update on Clear.
- **Mount:** debounced values equal applied values → effect no-ops (no
  navigation on first render).
- **Pagination reset:** auto-navigation omits cursor params, so changing a
  filter returns to page 1, consistent with the existing Apply handler.

## Testing

- Unit-test `useDebouncedValue` (settles after delay; cancels on rapid change).
- Verify type-check and existing test suites still pass.
- Manual: type in each text filter and confirm auto-apply + results-only
  shimmer on all three pages; confirm Apply/Clear still work and trigger
  shimmer; confirm filter bar stays interactive during load.
