# CSV Export Rebuild — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared, tested building blocks (progress registry, streaming pipeline, lean finance-history export query, error-response helper) that every export route migration in Phases 2–4 will consume. No existing route behavior changes in this phase.

**Architecture:** See `docs/superpowers/specs/2026-07-01-csv-export-rebuild-design.md` for the full design. This phase builds net-new, currently-unused modules plus one safe additive change to `export-route.ts` and one internal refactor of `finance-history.repository.ts` that preserves `getFinanceHistoryPaginated`'s existing public behavior exactly.

**Tech Stack:** Next.js route handlers, Supabase JS client, Vitest, TypeScript.

---

### Task 1: Add `createCsvExportErrorResponse` to `export-route.ts`

**Files:**

- Modify: `src/lib/utils/export-route.ts`
- Test: `src/lib/utils/__tests__/export-route.test.ts`

This is the helper every migrated route (Phases 2–4) will use for error responses. Unlike today's plain-text error responses, it always sets `Content-Disposition: attachment` so a 401/403/400 downloads as a small file instead of navigating the browser away from the app (see spec, "Shared server pipeline" section).

- [ ] **Step 1: Write the failing test**

Add to `src/lib/utils/__tests__/export-route.test.ts` (append inside the existing `describe('export-route utilities', ...)` block, after the `'creates csv error response...'` test):

```ts
it('creates a csv export error response with an explicit status and always sets Content-Disposition', async () => {
  const response = createCsvExportErrorResponse(
    'Finance access is required.',
    403
  )

  expect(response.status).toBe(403)
  expect(response.headers.get('content-disposition')).toBe(
    'attachment; filename="export-error.txt"'
  )
  await expect(response.text()).resolves.toBe('Finance access is required.')
})
```

Add `createCsvExportErrorResponse` to the existing import block at the top of the file:

```ts
import {
  buildDatedCsvFilename,
  createCsvErrorResponse,
  createCsvExportErrorResponse,
  createCsvResponse,
  createExportRouteHandlers,
  getExportMode,
} from '@/lib/utils/export-route'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/__tests__/export-route.test.ts`
Expected: FAIL — `createCsvExportErrorResponse is not a function` (or a TypeScript error if type-checked first).

- [ ] **Step 3: Write minimal implementation**

In `src/lib/utils/export-route.ts`, add this new function (keep every existing export in the file unchanged):

```ts
export function createCsvExportErrorResponse(
  message: string,
  status: number
): Response {
  return new Response(message, {
    status,
    headers: {
      'Content-Disposition': 'attachment; filename="export-error.txt"',
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/utils/__tests__/export-route.test.ts`
Expected: PASS (all tests in the file, including the new one).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/export-route.ts src/lib/utils/__tests__/export-route.test.ts
git commit -m "feat(export): add createCsvExportErrorResponse with Content-Disposition on error"
```

---

### Task 2: Create the export progress registry

**Files:**

- Create: `src/lib/utils/export-progress-registry.ts`
- Test: `src/lib/utils/__tests__/export-progress-registry.test.ts`

A transient, in-process `Map` — not a database table, not a worker. Tracks in-flight exports so `/api/exports/status` (Phase 2) can report real progress without the client touching CSV bytes.

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils/__tests__/export-progress-registry.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createExportProgress,
  getExportProgress,
  markExportDone,
  markExportError,
  resetExportProgressRegistryForTests,
  startExportProgressSweep,
  stopExportProgressSweep,
  updateExportProgress,
} from '@/lib/utils/export-progress-registry'

describe('export-progress-registry', () => {
  beforeEach(() => {
    resetExportProgressRegistryForTests()
  })

  afterEach(() => {
    resetExportProgressRegistryForTests()
    vi.useRealTimers()
  })

  it('creates an entry with streaming status and the given estimated total', () => {
    const requestId = createExportProgress('emp-1', 250)
    const entry = getExportProgress(requestId, 'emp-1')

    expect(entry).toMatchObject({
      employeeId: 'emp-1',
      status: 'streaming',
      rowsSent: 0,
      estimatedTotalRows: 250,
      errorMessage: null,
    })
  })

  it('supports a null estimated total (indeterminate progress)', () => {
    const requestId = createExportProgress('emp-1', null)
    const entry = getExportProgress(requestId, 'emp-1')

    expect(entry?.estimatedTotalRows).toBeNull()
  })

  it('updates rowsSent as chunks stream', () => {
    const requestId = createExportProgress('emp-1', 100)

    updateExportProgress(requestId, 40)
    expect(getExportProgress(requestId, 'emp-1')?.rowsSent).toBe(40)

    updateExportProgress(requestId, 90)
    expect(getExportProgress(requestId, 'emp-1')?.rowsSent).toBe(90)
  })

  it('marks an entry done', () => {
    const requestId = createExportProgress('emp-1', 10)
    updateExportProgress(requestId, 10)
    markExportDone(requestId)

    expect(getExportProgress(requestId, 'emp-1')?.status).toBe('done')
  })

  it('marks an entry errored with a message', () => {
    const requestId = createExportProgress('emp-1', 10)
    markExportError(requestId, 'DB connection lost.')

    const entry = getExportProgress(requestId, 'emp-1')
    expect(entry?.status).toBe('error')
    expect(entry?.errorMessage).toBe('DB connection lost.')
  })

  it('returns null for an unknown requestId', () => {
    expect(getExportProgress('does-not-exist', 'emp-1')).toBeNull()
  })

  it('returns null when the requesting employee does not match the entry owner (scoping)', () => {
    const requestId = createExportProgress('emp-1', 10)
    expect(getExportProgress(requestId, 'emp-2')).toBeNull()
  })

  it('update/markDone/markError are no-ops for an unknown requestId (no throw)', () => {
    expect(() => updateExportProgress('does-not-exist', 5)).not.toThrow()
    expect(() => markExportDone('does-not-exist')).not.toThrow()
    expect(() => markExportError('does-not-exist', 'x')).not.toThrow()
  })

  it('sweep evicts entries older than the TTL and leaves fresh ones untouched', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T00:00:00.000Z'))

    const staleId = createExportProgress('emp-1', 10)

    vi.setSystemTime(new Date('2026-07-01T00:04:00.000Z'))
    const freshId = createExportProgress('emp-1', 10)

    // TTL is 5 minutes; advance 6 minutes from the start so staleId (created at
    // T+0) is past TTL while freshId (created at T+4min) is not (T+4min + 6min
    // sweep-advance = T+10min elapsed for freshId's own clock is only 6min).
    vi.setSystemTime(new Date('2026-07-01T00:06:00.000Z'))
    startExportProgressSweep()
    vi.advanceTimersByTime(60_000)
    stopExportProgressSweep()

    expect(getExportProgress(staleId, 'emp-1')).toBeNull()
    expect(getExportProgress(freshId, 'emp-1')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/__tests__/export-progress-registry.test.ts`
Expected: FAIL — module `@/lib/utils/export-progress-registry` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/utils/export-progress-registry.ts`:

```ts
import { randomUUID } from 'node:crypto'

export type ExportProgressStatus = 'streaming' | 'done' | 'error'

export type ExportProgressEntry = {
  employeeId: string
  status: ExportProgressStatus
  rowsSent: number
  estimatedTotalRows: number | null
  errorMessage: string | null
  updatedAt: number
}

const EXPORT_PROGRESS_TTL_MS = 5 * 60 * 1000
const EXPORT_PROGRESS_SWEEP_INTERVAL_MS = 60 * 1000

const registry = new Map<string, ExportProgressEntry>()
let sweepIntervalHandle: ReturnType<typeof setInterval> | null = null

export function createExportProgress(
  employeeId: string,
  estimatedTotalRows: number | null
): string {
  const requestId = randomUUID()

  registry.set(requestId, {
    employeeId,
    status: 'streaming',
    rowsSent: 0,
    estimatedTotalRows,
    errorMessage: null,
    updatedAt: Date.now(),
  })

  return requestId
}

export function updateExportProgress(
  requestId: string,
  rowsSent: number
): void {
  const entry = registry.get(requestId)

  if (!entry) {
    return
  }

  entry.rowsSent = rowsSent
  entry.updatedAt = Date.now()
}

export function markExportDone(requestId: string): void {
  const entry = registry.get(requestId)

  if (!entry) {
    return
  }

  entry.status = 'done'
  entry.updatedAt = Date.now()
}

export function markExportError(requestId: string, message: string): void {
  const entry = registry.get(requestId)

  if (!entry) {
    return
  }

  entry.status = 'error'
  entry.errorMessage = message
  entry.updatedAt = Date.now()
}

export function getExportProgress(
  requestId: string,
  employeeId: string
): ExportProgressEntry | null {
  const entry = registry.get(requestId)

  if (!entry || entry.employeeId !== employeeId) {
    return null
  }

  return entry
}

function sweepExpiredExportProgress(now: number): void {
  for (const [requestId, entry] of registry) {
    if (now - entry.updatedAt > EXPORT_PROGRESS_TTL_MS) {
      registry.delete(requestId)
    }
  }
}

export function startExportProgressSweep(): () => void {
  if (!sweepIntervalHandle) {
    sweepIntervalHandle = setInterval(() => {
      sweepExpiredExportProgress(Date.now())
    }, EXPORT_PROGRESS_SWEEP_INTERVAL_MS)

    sweepIntervalHandle.unref?.()
  }

  return stopExportProgressSweep
}

export function stopExportProgressSweep(): void {
  if (sweepIntervalHandle) {
    clearInterval(sweepIntervalHandle)
    sweepIntervalHandle = null
  }
}

export function resetExportProgressRegistryForTests(): void {
  registry.clear()
  stopExportProgressSweep()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/utils/__tests__/export-progress-registry.test.ts`
Expected: PASS (all 10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/export-progress-registry.ts src/lib/utils/__tests__/export-progress-registry.test.ts
git commit -m "feat(export): add in-process export progress registry"
```

---

### Task 3: Wire the progress sweep into app bootstrap and graceful shutdown

**Files:**

- Modify: `src/instrumentation.ts`

No test file exists for `instrumentation.ts` today (it's a thin bootstrap wrapper) — this step is verified by the manual check in Step 2, consistent with the existing file having no test coverage.

- [ ] **Step 1: Modify `src/instrumentation.ts`**

Replace the full file contents with:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  const [
    { installHttpRequestTracking },
    { initializeGracefulShutdown },
    {
      initializeCriticalResourceShutdownHandlers,
      registerCacheShutdownCleanup,
    },
    { startExportProgressSweep },
  ] = await Promise.all([
    import('@/lib/runtime/http-request-tracking'),
    import('@/lib/utils/graceful-shutdown'),
    import('@/lib/runtime/critical-resource-cleanup'),
    import('@/lib/utils/export-progress-registry'),
  ])

  installHttpRequestTracking()
  initializeGracefulShutdown()
  initializeCriticalResourceShutdownHandlers()

  const stopExportProgressSweep = startExportProgressSweep()
  registerCacheShutdownCleanup('export-progress-sweep', stopExportProgressSweep)
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev`
Expected: server starts with no errors in the console (the new import resolves and `startExportProgressSweep()` runs without throwing). Stop the server with Ctrl+C and confirm no unhandled-rejection or "handler already registered" errors print during shutdown.

- [ ] **Step 3: Commit**

```bash
git add src/instrumentation.ts
git commit -m "feat(export): start export progress sweep on app boot, stop on shutdown"
```

---

### Task 4: Create the shared streaming export pipeline

**Files:**

- Create: `src/lib/utils/run-csv-export.ts`
- Test: `src/lib/utils/__tests__/run-csv-export.test.ts`

This does not yet replace `streaming-export.ts` — both exist side by side until every route has migrated (Phase 5 deletes the old one). New code only.

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils/__tests__/run-csv-export.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateExportProgress: vi.fn(),
  markExportDone: vi.fn(),
  markExportError: vi.fn(),
}))

vi.mock('@/lib/utils/export-progress-registry', () => ({
  updateExportProgress: mocks.updateExportProgress,
  markExportDone: mocks.markExportDone,
  markExportError: mocks.markExportError,
}))

import {
  runCsvExport,
  exportTooLargeResponse,
  EXPORT_CHUNK_SIZE,
  MAX_EXPORT_ROWS,
} from '@/lib/utils/run-csv-export'

describe('runCsvExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('streams CSV header and data rows across paginated fetches', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ value: 'A' }, { value: 'B' }],
        hasNextPage: true,
        nextCursor: 'cursor-2',
      })
      .mockResolvedValueOnce({
        data: [{ value: 'C' }],
        hasNextPage: false,
        nextCursor: null,
      })

    const response = runCsvExport<{ value: string }>(
      {
        fetchPage,
        headers: ['Value'],
        mapRow: (row) => [row.value],
        filename: 'stream.csv',
      },
      null
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="stream.csv"'
    )
    expect(response.headers.get('transfer-encoding')).toBe('chunked')

    await expect(response.text()).resolves.toBe('"Value"\n"A"\n"B"\n"C"\n')

    expect(fetchPage).toHaveBeenNthCalledWith(1, null, EXPORT_CHUNK_SIZE)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'cursor-2', EXPORT_CHUNK_SIZE)
  })

  it('emits only the header row when fetchPage returns no records', async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
    })

    const response = runCsvExport<{ value: string }>(
      {
        fetchPage,
        headers: ['Value'],
        mapRow: (row) => [row.value],
        filename: 'empty.csv',
      },
      null
    )

    await expect(response.text()).resolves.toBe('"Value"\n')
  })

  it('errors the stream when the row cap is exceeded', async () => {
    const mapRow = vi.fn((row: { value: string }) => [row.value])
    const fetchPage = vi.fn().mockResolvedValue({
      data: Array.from({ length: MAX_EXPORT_ROWS + 1 }, (_, i) => ({
        value: `row-${i}`,
      })),
      hasNextPage: false,
      nextCursor: null,
    })

    const response = runCsvExport<{ value: string }>(
      { fetchPage, headers: ['Value'], mapRow, filename: 'too-large.csv' },
      null
    )

    const reader = response.body?.getReader()
    if (!reader)
      throw new Error('Expected response stream body to be available.')

    const firstChunk = await reader.read()
    expect(firstChunk.done).toBe(false)

    await expect(reader.read()).rejects.toThrow(
      /Export exceeds 50000 rows\. Apply filters to narrow results\./
    )
    expect(mapRow).not.toHaveBeenCalled()
  })

  it('propagates fetchPage errors through the stream reader', async () => {
    const response = runCsvExport<{ value: string }>(
      {
        fetchPage: vi.fn().mockRejectedValue(new Error('boom')),
        headers: ['Value'],
        mapRow: (row: { value: string }) => [row.value],
        filename: 'error.csv',
      },
      null
    )

    const reader = response.body?.getReader()
    if (!reader)
      throw new Error('Expected response stream body to be available.')

    const firstChunk = await reader.read()
    expect(firstChunk.done).toBe(false)

    await expect(reader.read()).rejects.toThrow('boom')
  })

  it('returns 413 helper response for oversized export prechecks', async () => {
    const response = exportTooLargeResponse()

    expect(response.status).toBe(413)
    const body = await response.text()
    expect(body).toContain('Export too large.')
    expect(body).toContain('Maximum: 50000 rows.')
  })

  it('when requestId is null, never touches the progress registry', async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      data: [{ value: 'A' }],
      hasNextPage: false,
      nextCursor: null,
    })

    const response = runCsvExport<{ value: string }>(
      {
        fetchPage,
        headers: ['Value'],
        mapRow: (row) => [row.value],
        filename: 'x.csv',
      },
      null
    )
    await response.text()

    expect(mocks.updateExportProgress).not.toHaveBeenCalled()
    expect(mocks.markExportDone).not.toHaveBeenCalled()
    expect(mocks.markExportError).not.toHaveBeenCalled()
  })

  it('when requestId is provided, updates progress per chunk and marks done at stream end', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ value: 'A' }, { value: 'B' }],
        hasNextPage: true,
        nextCursor: 'cursor-2',
      })
      .mockResolvedValueOnce({
        data: [{ value: 'C' }],
        hasNextPage: false,
        nextCursor: null,
      })

    const response = runCsvExport<{ value: string }>(
      {
        fetchPage,
        headers: ['Value'],
        mapRow: (row) => [row.value],
        filename: 'x.csv',
      },
      'request-123'
    )
    await response.text()

    expect(mocks.updateExportProgress).toHaveBeenNthCalledWith(
      1,
      'request-123',
      2
    )
    expect(mocks.updateExportProgress).toHaveBeenNthCalledWith(
      2,
      'request-123',
      3
    )
    expect(mocks.markExportDone).toHaveBeenCalledWith('request-123')
    expect(mocks.markExportError).not.toHaveBeenCalled()
  })

  it('when requestId is provided and fetchPage throws, marks the progress entry errored', async () => {
    const response = runCsvExport<{ value: string }>(
      {
        fetchPage: vi.fn().mockRejectedValue(new Error('boom')),
        headers: ['Value'],
        mapRow: (row: { value: string }) => [row.value],
        filename: 'x.csv',
      },
      'request-456'
    )

    const reader = response.body?.getReader()
    if (!reader)
      throw new Error('Expected response stream body to be available.')
    await reader.read()
    await expect(reader.read()).rejects.toThrow('boom')

    expect(mocks.markExportError).toHaveBeenCalledWith('request-456', 'boom')
    expect(mocks.markExportDone).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/__tests__/run-csv-export.test.ts`
Expected: FAIL — module `@/lib/utils/run-csv-export` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/utils/run-csv-export.ts`:

```ts
import { toCsvCell } from '@/lib/utils/csv'
import {
  markExportDone,
  markExportError,
  updateExportProgress,
} from '@/lib/utils/export-progress-registry'

/** Hard server-side cap to prevent memory exhaustion on large exports. */
export const MAX_EXPORT_ROWS = 50_000
// Same chunk-size rationale as the retired streaming-export.ts: db-max-rows
// (confirmed 1000 on dev/prod) minus 1 for the page RPC's internal p_limit+1
// probe row. 500 gives 2x margin below that ceiling.
export const EXPORT_CHUNK_SIZE = 500

type CsvExportPage<T> = {
  data: T[]
  hasNextPage: boolean
  nextCursor: string | null
}

type CsvExportFetcher<T> = (
  cursor: string | null,
  limit: number
) => Promise<CsvExportPage<T>>

type CsvRowMapper<T> = (row: T) => string[]

export type CsvExportRecipe<T> = {
  fetchPage: CsvExportFetcher<T>
  headers: string[]
  mapRow: CsvRowMapper<T>
  filename: string
}

function toCsvLine(cells: string[]): string {
  return cells.map((cell) => toCsvCell(cell)).join(',')
}

/**
 * requestId is null when a route is hit directly without going through
 * POST /api/exports/start (e.g. a bookmarked URL) — the export still runs,
 * just without progress-registry side effects.
 */
export function runCsvExport<T>(
  recipe: CsvExportRecipe<T>,
  requestId: string | null
): Response {
  const { fetchPage, headers, mapRow, filename } = recipe
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(toCsvLine(headers) + '\n'))

        let cursor: string | null = null
        let totalFetched = 0

        do {
          const page = await fetchPage(cursor, EXPORT_CHUNK_SIZE)

          totalFetched += page.data.length

          if (totalFetched > MAX_EXPORT_ROWS) {
            const message = `Export exceeds ${MAX_EXPORT_ROWS} rows. Apply filters to narrow results.`

            if (requestId) {
              markExportError(requestId, message)
            }

            controller.error(new Error(message))
            return
          }

          const chunk = page.data
            .map((row) => toCsvLine(mapRow(row)))
            .join('\n')

          if (chunk) {
            controller.enqueue(encoder.encode(chunk + '\n'))
          }

          if (requestId) {
            updateExportProgress(requestId, totalFetched)
          }

          cursor = page.hasNextPage ? page.nextCursor : null
        } while (cursor)

        if (requestId) {
          markExportDone(requestId)
        }

        controller.close()
      } catch (error) {
        if (requestId) {
          markExportError(
            requestId,
            error instanceof Error ? error.message : 'Export failed.'
          )
        }

        controller.error(error)
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'Transfer-Encoding': 'chunked',
    },
  })
}

export function exportTooLargeResponse(): Response {
  return new Response(
    `Export too large. Apply filters to narrow results. Maximum: ${MAX_EXPORT_ROWS} rows.`,
    { status: 413 }
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/utils/__tests__/run-csv-export.test.ts`
Expected: PASS (all 9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/run-csv-export.ts src/lib/utils/__tests__/run-csv-export.test.ts
git commit -m "feat(export): add requestId-aware shared CSV streaming pipeline"
```

---

### Task 5: Extract a lean, export-only finance history query (no available-actions call)

**Files:**

- Modify: `src/features/finance/data/repositories/finance-history.repository.ts`
- Test: `src/features/finance/data/repositories/__tests__/finance-history.repository.test.ts`

Extracts the RPC-call-only portion of `getFinanceHistoryPaginated` into a private helper that both it and a new `getFinanceHistoryPageForExport` call. `getFinanceHistoryPaginated`'s public behavior and return shape are unchanged — verified by the existing tests continuing to pass unmodified.

- [ ] **Step 1: Write the failing test**

Add to `src/features/finance/data/repositories/__tests__/finance-history.repository.test.ts`, after the closing `})` of the `describe('getFinanceHistoryPaginated', ...)` block (find it by searching for the last `})` that closes that describe — append a new sibling `describe` block at the same indentation level, at the end of the file):

```ts
describe('getFinanceHistoryPageForExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns claim/owner/action rows without calling getClaimAvailableActionsByClaimIds', async () => {
    const row = buildHydratedRow()
    const supabase = buildSupabaseStub([row])

    const result = await getFinanceHistoryPageForExport(supabase, null, 10)

    expect(result.hasNextPage).toBe(false)
    expect(result.nextCursor).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data[0].claim.id).toBe('claim-1')
    expect(result.data[0].owner.employee_id).toBe('NW0000282')
    expect(result.data[0]).not.toHaveProperty('availableActions')
    expect(mocks.getClaimAvailableActionsByClaimIds).not.toHaveBeenCalled()
  })

  it('slices to limit and builds the cursor from the last bounded row, matching getFinanceHistoryPaginated', async () => {
    const rows = [
      buildHydratedRow({
        id: 'a1',
        claim_id: 'c1',
        acted_at: '2026-06-30T10:00:00+00:00',
      }),
      buildHydratedRow({
        id: 'a2',
        claim_id: 'c2',
        acted_at: '2026-06-30T09:00:00+00:00',
      }),
    ]
    const supabase = buildSupabaseStub(rows)

    const result = await getFinanceHistoryPageForExport(supabase, null, 1)

    expect(result.hasNextPage).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].claim.id).toBe('c1')
    expect(result.nextCursor).not.toBeNull()
  })

  it('returns an empty page when the RPC returns no rows', async () => {
    const supabase = buildSupabaseStub([])

    const result = await getFinanceHistoryPageForExport(supabase, null, 10)

    expect(result.data).toEqual([])
    expect(result.hasNextPage).toBe(false)
    expect(result.nextCursor).toBeNull()
  })
})
```

Update the import statement at the top of the file to include the new function:

```ts
import {
  getFinanceHistoryPageForExport,
  getFinanceHistoryPaginated,
  mapHydratedHistoryRow,
} from '@/features/finance/data/repositories/finance-history.repository'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/finance/data/repositories/__tests__/finance-history.repository.test.ts`
Expected: FAIL — `getFinanceHistoryPageForExport` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/features/finance/data/repositories/finance-history.repository.ts`, replace the existing `getFinanceHistoryPaginated` function (currently lines 282–358, from `export async function getFinanceHistoryPaginated(` through its closing `}`) with the following — this extracts the RPC-fetch-and-hydrate logic into a private helper and adds the new export:

```ts
type HydratedHistoryPage = {
  rows: Pick<FinanceHistoryItem, 'claim' | 'owner' | 'action'>[]
  hasNextPage: boolean
  nextCursor: string | null
}

// RPC-call-only portion of the former getFinanceHistoryPaginated body. Shared
// by the interactive-list path (which layers availableActions on top) and the
// export path (which does not need availableActions — see
// docs/superpowers/specs/2026-07-01-csv-export-rebuild-design.md, "RPC Reuse
// Validation"). Reuses get_finance_history_page as-is; zero SQL changes.
async function fetchHydratedFinanceHistoryPage(
  supabase: SupabaseClient,
  cursor: string | null,
  limit: number,
  filters: FinanceFilters
): Promise<HydratedHistoryPage> {
  const scope = await buildFinanceHistoryFeedScope(supabase, filters)

  if (scope.isEmpty) {
    return { rows: [], hasNextPage: false, nextCursor: null }
  }

  const decoded = cursor ? decodeCursor(cursor) : null
  const { data: pageRows, error: pageError } = await supabase.rpc(
    'get_finance_history_page',
    {
      p_has_filters: scope.pHasFilters,
      ...scope.resolverArgs,
      p_feed_action_codes: scope.feedActionCodes,
      p_feed_from: scope.feedFrom,
      p_feed_to: scope.feedTo,
      p_cursor_acted_at: decoded?.created_at ?? null,
      p_cursor_id: decoded?.id ?? null,
      p_limit: limit,
    }
  )

  if (pageError) {
    throw new Error(pageError.message)
  }

  const idRows = (pageRows ?? []) as HydratedHistoryPageRow[]
  const hasNextPage = idRows.length > limit
  const pageRowsBounded = hasNextPage ? idRows.slice(0, limit) : idRows

  if (pageRowsBounded.length === 0) {
    return { rows: [], hasNextPage: false, nextCursor: null }
  }

  const rows = pageRowsBounded.map((row) => mapHydratedHistoryRow(row))
  const lastRecord = pageRowsBounded.at(-1)
  const nextCursor =
    hasNextPage && lastRecord
      ? encodeCursor({ created_at: lastRecord.acted_at, id: lastRecord.id })
      : null

  return { rows, hasNextPage, nextCursor }
}

export async function getFinanceHistoryPaginated(
  supabase: SupabaseClient,
  cursor: string | null,
  limit = 10,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<PaginatedFinanceHistory> {
  const page = await fetchHydratedFinanceHistoryPage(
    supabase,
    cursor,
    limit,
    filters
  )

  if (page.rows.length === 0) {
    return { data: [], hasNextPage: false, nextCursor: null, limit }
  }

  const claimIds = [...new Set(page.rows.map((row) => row.claim.id))]
  const availableActionsByClaimId = await getClaimAvailableActionsByClaimIds(
    supabase,
    claimIds
  )

  const history: FinanceHistoryItem[] = page.rows.map((row) => ({
    ...row,
    availableActions: availableActionsByClaimId.get(row.claim.id) ?? [],
  }))

  return {
    data: history,
    hasNextPage: page.hasNextPage,
    nextCursor: page.nextCursor,
    limit,
  }
}

// Export-only variant: same RPC, no availableActions enrichment. Used by
// finance/export and approved-history/bc-expense-export (Phases 3–4), neither
// of which reads availableActions from their CSV rows.
export async function getFinanceHistoryPageForExport(
  supabase: SupabaseClient,
  cursor: string | null,
  limit: number,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<{
  data: Pick<FinanceHistoryItem, 'claim' | 'owner' | 'action'>[]
  hasNextPage: boolean
  nextCursor: string | null
}> {
  const page = await fetchHydratedFinanceHistoryPage(
    supabase,
    cursor,
    limit,
    filters
  )

  return {
    data: page.rows,
    hasNextPage: page.hasNextPage,
    nextCursor: page.nextCursor,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/finance/data/repositories/__tests__/finance-history.repository.test.ts`
Expected: PASS — every existing test in this file (including all `getFinanceHistoryPaginated` and `mapHydratedHistoryRow` cases) still passes unmodified, plus the 3 new `getFinanceHistoryPageForExport` tests.

Also run the full finance test suite to catch any other consumer of this file:

Run: `npx vitest run src/features/finance`
Expected: PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/features/finance/data/repositories/finance-history.repository.ts src/features/finance/data/repositories/__tests__/finance-history.repository.test.ts
git commit -m "refactor(finance): extract lean export-only finance history page query"
```

---

## Phase 1 Completion Checklist

- [ ] `createCsvExportErrorResponse` added to `export-route.ts`, tested.
- [ ] `export-progress-registry.ts` created, tested (create/update/markDone/markError, employeeId scoping, TTL sweep).
- [ ] Sweep wired into `instrumentation.ts` boot + graceful shutdown.
- [ ] `run-csv-export.ts` created, tested (streaming loop, row cap, error propagation, requestId-aware progress side effects, requestId-absent no-op).
- [ ] `getFinanceHistoryPageForExport` added; `getFinanceHistoryPaginated` behavior unchanged (existing tests pass verbatim).
- [ ] No existing route's behavior has changed — `streaming-export.ts` and all 6 export routes are untouched in this phase.

**Next:** Phase 2 (`docs/superpowers/plans/2026-07-01-csv-export-rebuild-phase2-claims-approvals.md`) builds `/api/exports/start`, `/api/exports/status`, the new client component, and migrates `claims/export` + `approvals/export` onto this foundation.
