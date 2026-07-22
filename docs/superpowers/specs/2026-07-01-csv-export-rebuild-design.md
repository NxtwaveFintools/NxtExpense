# Design: CSV Export Rebuild (Shared Pipeline + Native Download + Progress Polling)

**Date:** 2026-07-01
**Status:** Approved
**Effort:** Large (6 export routes, 2 repository functions, 1 new shared pipeline, 1 new progress registry, 2 new small API routes, 1 new client component)
**Risk:** Medium — touches every CSV export path in the app; mitigated by parity tests and a per-route rollout

**Client architecture decision log:** two prior client designs were considered
and superseded before this one — see "Client Architecture: Options Considered"
below for why `fetch()` + File System Access API was rejected in favor of
keeping the browser's native download.

---

## Problem

All 6 CSV export routes (`claims/export`, `approvals/export`, `finance/export`,
`finance/pending-export`, `approved-history/bc-expense-export`,
`approved-history/payment-journals-export`) share the same client-side trigger
pattern and have accumulated three independent server-side streaming
implementations. Concretely:

1. **Fake progress.** `csv-export-actions.tsx` and
   `approved-history-export-actions.tsx` trigger downloads via a raw
   `document.createElement('a').click()` — a browser navigation, not a
   JS-visible request. The "progress" shown is a `setInterval` animation
   running on a fixed timer, completely decoupled from how much data has
   actually been transferred.
2. **Errors navigate the whole app away.** Because the trigger is a plain
   anchor click (no `download` attribute, no `fetch`), a 401/403/400 response
   (which carries no `Content-Disposition`) is loaded by the browser as a full
   page navigation, replacing the entire app with raw error text.
3. **Three duplicated streaming implementations.** The generic
   `lib/utils/streaming-export.ts`, plus two hand-rolled local copies of
   `createStreamingCsvResponse` inside `bc-expense-export/route.ts` and
   `payment-journals-export/route.ts`, with slightly different shapes
   (`hasNextPage`/`nextCursor` vs. `{ rows, nextCursor }`).
4. **BC-Expense export pays for 3 queries per chunk, one entirely wasted.**
   It calls `getFinanceHistoryPaginated`, which _always_ issues two RPC calls
   per page (the hydrated history page, and a batched
   `get_claim_available_actions_bulk` lookup) — then does a **third** call,
   `getMappedClaimItemsByClaimId`, to re-fetch claim items keyed by the ids
   just returned. `buildBcExpenseRows` never reads `availableActions`, so the
   second of those three calls produces data nobody uses, every chunk, every
   export. `finance/export`'s "all" mode has the same problem minus the
   third call (2 queries per chunk, 1 wasted).
5. **Silent truncation risk.** If a mid-stream DB error happens after several
   thousand rows are already flushed to the response, the browser's native
   download simply ends — there's no way for the user to tell the resulting
   file is incomplete.

---

## RPC Reuse Validation (done before any new SQL was considered)

Per explicit instruction, the existing `get_finance_history_page` RPC
(rewritten 2026-07-01, migration `20260701100000_rewrite_get_finance_history_page_hydrated.sql`)
was checked for reuse/parameterization before any new RPC was designed.

**Finding: no new RPC is needed anywhere in this rebuild.**

- The wasted `availableActions` query is **not part of `get_finance_history_page`
  at all** — it's a separate TypeScript-layer call
  (`getClaimAvailableActionsByClaimIds`) made by the wrapper function
  `getFinanceHistoryPaginated` _after_ the RPC returns. The fix is to stop
  calling that wrapper for export purposes and call the RPC-only path
  directly. Zero SQL changes.
- BC-Expense's claim-items lookup (`get_expense_claim_items_by_claim_ids`,
  migration `20260701110000`) is a genuine one-to-many relation
  (`expense_claim_items` has multiple rows per claim — fuel, food,
  accommodation, etc.). Folding it into `get_finance_history_page` would
  require `json_agg` + `GROUP BY`, which the rewrite migration's own
  JOIN-TYPE AUDIT comment explicitly flags as needing "a fresh review of this
  invariant" for every existing caller (the live Approved History list, the
  finance dashboard, `finance/export`) — none of which need claim items. That
  cost would be paid on every call, for every consumer, to serve one export
  recipe. The existing separate RPC (already POST/RPC-based, already immune
  to the URL-length ceiling) is the correct shape for this data; it is reused
  as-is, unchanged.
- The four interactive-list "total count" RPCs already exist and are reused
  for export progress (see below) — no new count RPC is written either.

So the entire query-optimization portion of this rebuild is a **TypeScript-only
refactor**: extract the RPC-call-only portion of `getFinanceHistoryPaginated`
into a lean function, and stop calling the wrapper (and its unused
available-actions enrichment) from the two export paths that don't need it.

---

## Client Architecture: Options Considered

Three client designs were discussed before settling on this one:

- **fetch() + in-memory buffer, save on full success.** Rejected: buffers the
  entire export in browser memory before saving (bounded only by the existing
  `MAX_EXPORT_ROWS` cap, not truly bounded), and gives up the browser's native
  download UI entirely.
- **fetch() + File System Access API** (originally approved, then revisited).
  Gives real in-app progress and real error toasts, and on Chromium writes
  chunk-by-chunk with no accumulation. Rejected as the _primary_ path because
  its non-Chromium fallback (Firefox/Safari) still buffers the whole response
  in memory, which contradicts the goal of never buffering client-side, and
  because it gives up the native download mechanism for every browser, not
  just the ones lacking the API.
- **Native download + preflight + progress polling (chosen).** Keeps the
  browser's own download mechanism for the actual file bytes in every
  browser — genuinely zero client-side JS memory, always — while fixing
  real progress and error handling through a side channel instead of by
  intercepting the bytes themselves. The trade-off, accepted explicitly: a
  failure that happens _after_ the preflight check passes but _during_ the
  stream can't retroactively invalidate a file the browser has already
  started saving — the user is told the export failed and the file may be
  incomplete, but the file itself can't be deleted or blocked. This is a
  materially weaker guarantee than the FS Access option had, traded
  deliberately for zero client-side buffering in every browser.

---

## Architecture

### Server-side progress tracking — `src/lib/utils/export-progress-registry.ts`

A transient, in-process registry — **not** a database table, not a worker,
not durable storage. Just a module-level `Map` scoped to the life of the
Node process, tracking in-flight exports so a side-channel poll can report
real progress without the client ever touching the CSV bytes.

```ts
type ExportProgressStatus = 'streaming' | 'done' | 'error'

type ExportProgressEntry = {
  employeeId: string
  status: ExportProgressStatus
  rowsSent: number
  estimatedTotalRows: number | null
  errorMessage: string | null
  updatedAt: number
}

function createExportProgress(
  employeeId: string,
  estimatedTotalRows: number | null
): string // returns requestId (crypto.randomUUID())
function updateExportProgress(requestId: string, rowsSent: number): void
function markExportDone(requestId: string): void
function markExportError(requestId: string, message: string): void
function getExportProgress(
  requestId: string,
  employeeId: string
): ExportProgressEntry | null // null if not found OR employeeId mismatch
```

A `setInterval` sweep (started once, alongside the app's existing runtime
bootstrapping in `instrumentation.ts`, torn down via the same pattern
`critical-resource-cleanup.ts` already uses for graceful shutdown) evicts
entries older than a few minutes — housekeeping for a transient cache, not
a background job processor.

### New route: `POST /api/exports/start`

Runs the **preflight**: the same auth/permission check and filter
normalization each export route already does (extracted into a small shared
`resolve*ExportContext()` helper per feature so the logic is written once and
called from both `start` and the export route's own `GET` handler — not
duplicated), plus the existing count function for that export type. On
success: registers a progress entry, returns `{ requestId }`. On failure:
returns `{ error: message }` with the appropriate 401/403/400 status — caught
entirely before any download is attempted.

### New route: `GET /api/exports/status`

Reads `getExportProgress(requestId, employeeId)` and returns
`{ status, rowsSent, estimatedTotalRows, errorMessage }` as JSON, or 404 if
the entry doesn't exist or belongs to a different employee. No new query
against the database — pure in-memory read.

### Shared server pipeline — `src/lib/utils/run-csv-export.ts`

Replaces `streaming-export.ts` and both ad-hoc local copies. One function:

```ts
type CsvExportRecipe<TRow> = {
  fetchPage: (
    cursor: string | null,
    limit: number
  ) => Promise<{
    data: TRow[]
    hasNextPage: boolean
    nextCursor: string | null
  }>
  headers: string[]
  mapRow: (row: TRow) => string[]
  filename: string
}

function runCsvExport<TRow>(
  recipe: CsvExportRecipe<TRow>,
  requestId: string | null
): Response
```

Internals are unchanged from today's `streaming-export.ts` loop (fetch chunk →
CSV-encode → `controller.enqueue` → forget the chunk → repeat), preserving
bounded server-side memory exactly as it works today. Additions:

- When `requestId` is present (the normal path — the client always passes the
  `requestId` it got from `/start` as a query param on the download URL),
  calls `updateExportProgress(requestId, rowsSent)` after each chunk and
  `markExportDone`/`markExportError` at stream end — a side effect layered on
  top of the existing stream, which is otherwise untouched. If `requestId` is
  absent (e.g. someone hits the URL directly without going through `/start`),
  the export still runs as a plain download with no progress tracking —
  fully backward compatible.
- Error responses — both from `/api/exports/start` and from the export route
  itself (e.g. a re-validation failure, or the rare case where permissions
  change in the moment between the preflight and the download) — always carry
  `Content-Disposition: attachment`. This is what actually closes the
  navigate-away bug on the native-download path: browsers key download-vs-render
  behavior off that header, not the status code, so an error becomes a small
  downloaded message instead of blowing away the app. The preflight is what
  catches the common case (permission/validation failures) _before_ any
  download starts at all; this header is defense in depth for the rare TOCTOU
  case where the export route's own re-check fails after the preflight passed.
- `MAX_EXPORT_ROWS` (50,000) moves here from `streaming-export.ts`, unchanged.

Each export route becomes: existing auth/permission check (unchanged,
feature-specific, now shared with `/start` via the extracted helper) →
existing filter normalization (unchanged) → build the 4 recipe fields →
`return runCsvExport(recipe, requestId)`.

### Per-export-type changes

| Export                                     | Query change                                                                                                                                        | Count source (new use, no new query)                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claims/export` (my-claims)                | None — already 1 query/chunk                                                                                                                        | `getMyClaimsTotalCount` (exists)                                                                                                                                                                                                                                                                                                                                                                                             |
| `approvals/export`                         | None — 2nd query's data is used by the CSV row                                                                                                      | `getFilteredApprovalHistoryCount` (exists)                                                                                                                                                                                                                                                                                                                                                                                   |
| `finance/export` (approved-history "all")  | Stop calling `getFinanceHistoryPaginated`; call new lean `getFinanceHistoryPageForExport` instead (RPC-only, same RPC, no available-actions call)   | `getFinanceHistoryTotalCount` (exists)                                                                                                                                                                                                                                                                                                                                                                                       |
| `finance/pending-export`                   | None — 2nd query's data is used by the CSV row                                                                                                      | `getFinanceQueueTotalCount` (exists)                                                                                                                                                                                                                                                                                                                                                                                         |
| `approved-history/bc-expense-export`       | Same `getFinanceHistoryPageForExport` swap as above (3 queries/chunk → 2); keep `getMappedClaimItemsByClaimId` as-is (necessary, already RPC-based) | `getFinanceHistoryTotalCount` — **approximate**: history-row count, not final CSV line count (BC-Expense can emit 0, 1, or several CSV rows per history row). The same universal 99%-until-actually-done cap (see Client section) absorbs this: if the proxy undercounts, progress plateaus at 99% for a bit longer; if it overcounts, the stream simply finishes before reaching 99%. Either way it never shows 100% early. |
| `approved-history/payment-journals-export` | None — already 1 aggregate query                                                                                                                    | None — single fast call, indeterminate spinner                                                                                                                                                                                                                                                                                                                                                                               |

#### New function: `getFinanceHistoryPageForExport`

In `src/features/finance/data/repositories/finance-history.repository.ts`:
extract the RPC-call + `mapHydratedHistoryRow` portion of
`getFinanceHistoryPaginated` into a private helper; `getFinanceHistoryPaginated`
(used by the interactive list, unchanged behavior) calls that helper and then
layers the `getClaimAvailableActionsByClaimIds` enrichment on top as it does
today. `getFinanceHistoryPageForExport` calls the same helper and returns
`{ data: Pick<FinanceHistoryItem, 'claim' | 'owner' | 'action'>[], hasNextPage, nextCursor }`
directly — no available-actions call. `mapFinanceHistoryToCsvRow` and
`buildBcExpenseRows` only ever read `.claim` and `.owner` (verified by
reading both), so the narrower return type is a safe fit, not a cast.

### Client — native download + preflight + progress polling

Replaces `csv-export-actions.tsx` and `approved-history-export-actions.tsx`
with one reusable button component (one instance per export action, so pages
needing 1, 2, or 3 export buttons compose it directly rather than going
through a bespoke multi-button component). The actual CSV bytes never touch
this component's JS at all — only small JSON status payloads do.

On click:

1. `POST /api/exports/start` with `{ exportType, ...filters }`.
2. If the response is `{ error }`: show a `sonner` error toast with that
   message, stop — no download is attempted, no navigation ever happens.
   This catches essentially every permission/validation failure before
   anything reaches the browser's download manager.
3. If the response is `{ requestId }`: trigger the download exactly as
   today — `document.createElement('a')`, `href` pointed at the export
   route with `?requestId=<id>&...filters`, `.click()`. This is the browser's
   own native, JS-invisible download mechanism, unchanged — zero JS memory
   involvement for the actual file, in every browser.
4. Start polling `GET /api/exports/status?requestId=<id>` (~750ms interval):
   - `status: 'streaming'` → progress = `min(99, rowsSent / estimatedTotalRows * 100)` if `estimatedTotalRows` is known, otherwise an indeterminate spinner.
   - `status: 'done'` → progress → 100%, brief success state, stop polling.
   - `status: 'error'` → stop polling, show a toast: _"Export failed partway through — the downloaded file may be incomplete. Please delete it and retry."_ This is the accepted trade-off from the options discussion: the poll can inform, but the native download already in progress can't be recalled or invalidated.
   - `404` (entry expired or not found) → stop polling, neutral state ("export triggered — check your downloads"), since the file may still have completed successfully even though its progress entry aged out.
   - A wall-clock timeout (e.g. 10 minutes) stops polling regardless, to avoid a runaway interval if a status update is ever missed entirely.

### Removed: `mode=page|all` split

Every route currently exposes a `mode=page` (quick 10-row preview) and
`mode=all` path with separate client buttons. Real progress removes the
reason a separate "quick preview" existed — each export becomes a single
button that exports everything matching the current filters (still capped at
`MAX_EXPORT_ROWS`). `getExportMode` and the page/all branching in each route
are deleted.

---

## What Gets Deleted

- `src/lib/utils/streaming-export.ts` (replaced by `run-csv-export.ts`)
- `src/features/finance/components/approved-history-export-actions.tsx`
- `src/components/ui/csv-export-actions.tsx`
- The local `createStreamingCsvResponse` in `bc-expense-export/route.ts`
- The local `createStreamingCsvResponse` in `payment-journals-export/route.ts`
- `getExportMode` / `mode=page|all` branching in every export route and in `export-route.ts`

## What Does NOT Change

- `approvals/export` and `finance/pending-export` query shapes — both
  already do exactly the queries their CSV rows need; no waste found, no
  change made, per scope.
- `get_finance_history_page` and `get_expense_claim_items_by_claim_ids` SQL —
  reused as-is, zero migrations in this rebuild.
- `getFinanceHistoryPaginated` (interactive list) behavior — unchanged;
  it now calls the same extracted helper internally but its public behavior
  and return shape are identical.
- Server-side bounded-memory streaming loop shape (chunk in, chunk out,
  forget) — unchanged, still the core of `run-csv-export.ts`.
- `MAX_EXPORT_ROWS` cap (50,000) — unchanged, just relocated.
- CSV formatting/sanitization (`toCsvCell`, `sanitizeCsvValue`) — unchanged.
- The actual file-transfer mechanism for CSV bytes — still a plain anchor
  click against a `Content-Disposition: attachment` response, handled
  entirely by the browser's native download manager. The bug was never in
  that transport; it was in the lack of a preflight check and the lack of
  any progress visibility. Client-side JS never buffers the CSV bytes, in
  any browser.

---

## Test Strategy

- Adapt existing parity tests (`csv-export-parity.test.ts`,
  `finance-export-parity.test.ts`, `bc-expense-export.test.ts`,
  `payment-journals-export.test.ts`) to the new pipeline.
- New test: mock the Supabase client and assert the available-actions RPC
  (`get_claim_available_actions_bulk`) is never invoked by `finance/export`
  ("all" mode) or `bc-expense-export` — pinning the query-count reduction
  (2→1 and 3→2 per chunk respectively).
- New tests for `export-progress-registry.ts`: create/update/markDone/markError
  round-trip correctly; `getExportProgress` returns `null` for a mismatched
  `employeeId` (scoping) and for an unknown/expired `requestId`; the TTL
  sweep evicts stale entries and leaves fresh ones untouched.
- New tests for `POST /api/exports/start`: a permission/validation failure
  returns `{ error }` with no `requestId` and registers no progress entry;
  success registers an entry with the count-derived `estimatedTotalRows` and
  returns a `requestId`.
- New tests for the export routes: `runCsvExport` calls `updateExportProgress`
  after each chunk and `markExportDone`/`markExportError` at stream end when
  a `requestId` is supplied; omitting `requestId` runs the export with no
  registry interaction (backward-compatible direct-hit case).
- New test: every error response (`/start` and the export route's own
  re-validation failure) carries `Content-Disposition: attachment`.
- New client-side test: on a `{ error }` response from `/start`, the download
  is never triggered and `window.location` is never touched.
- New client-side test: on a `status: 'error'` poll result, the "may be
  incomplete" toast fires and polling stops.
- Existing per-route `route.test.ts` files updated for the removed
  `mode=page|all` branch (single-mode handler now).
- E2e coverage is actually simpler than the FS Access alternative would have
  been: Playwright's `page.waitForEvent('download')` works directly against
  the unchanged native-download mechanism, with no picker/CDP workarounds
  needed.

---

## Rollout Order

1. Build `export-progress-registry.ts`, `run-csv-export.ts`, the
   `/api/exports/start` and `/api/exports/status` routes, and the lean
   `getFinanceHistoryPageForExport` helper (no existing route changes yet;
   covered by new unit tests).
2. Migrate `claims/export` and `approvals/export` (no query changes — lowest
   risk, validates the preflight → native-download → poll flow end-to-end).
3. Migrate `finance/export` and `finance/pending-export`.
4. Migrate `approved-history/bc-expense-export` and
   `approved-history/payment-journals-export`, deleting their local
   `createStreamingCsvResponse` copies.
5. Delete `streaming-export.ts` and both old client components once every
   route has moved off them.

---

## Rollback

Each route migrates independently (per the rollout order above), so any step
can be reverted by restoring that route's previous handler without affecting
already-migrated routes. `getFinanceHistoryPaginated`'s public behavior is
unchanged throughout, so the interactive Approved History list is never at
risk regardless of export-rollout progress.
