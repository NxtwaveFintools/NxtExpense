# CSV Export Rebuild — Phase 3: Finance History + Finance Pending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `finance/export` (which also serves `/approved-history/export` — that route is a re-export barrel of the same handler, confirmed in codebase) and `finance/pending-export` onto the shared pipeline, wiring `finance/export` to the lean `getFinanceHistoryPageForExport` from Phase 1 (dropping the wasted available-actions call).

**Prerequisite:** Phases 1 and 2 complete.

**Architecture:** See `docs/superpowers/specs/2026-07-01-csv-export-rebuild-design.md`. Both routes get a `resolve*ExportContext`/`resolve*ExportPreflight` pair following the Phase 2 pattern, registered into `/api/exports/start`'s handler map.

**Important — do not confuse with Phase 4:** `bc-expense-export` and `payment-journals-export` are NOT touched in this phase. `finance-filters-bar.tsx` renders `ApprovedHistoryExportActions` for those two on the `/approved-history` page — this phase trims that component down to just those two buttons (removing the "All CSV" button it used to render, since that's now a separate `CsvExportButton`), but does not change its BC-Expense/Payment-Journals internals.

**Tech Stack:** Next.js route handlers, Supabase JS client, React, Vitest, Testing Library.

---

### Task 1: Finance history export context + preflight resolver

**Files:**

- Create: `src/features/finance/server/finance-history-export-context.ts`
- Test: `src/features/finance/server/__tests__/finance-history-export-context.test.ts`

Preserves the existing behavior of `finance/export/route.ts` exactly: force-nulls `claimStatus` (this export never supports status filtering, matching the Approved History page).

- [ ] **Step 1: Write the failing test**

Create `src/features/finance/server/__tests__/finance-history-export-context.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEmployeeByEmail: vi.fn(),
  isFinanceTeamMember: vi.fn(),
  getFinanceHistoryTotalCount: vi.fn(),
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
}))

vi.mock('@/features/finance/permissions', () => ({
  isFinanceTeamMember: mocks.isFinanceTeamMember,
}))

vi.mock('@/features/finance/data/queries', () => ({
  getFinanceHistoryTotalCount: mocks.getFinanceHistoryTotalCount,
}))

import {
  resolveFinanceHistoryExportContext,
  resolveFinanceHistoryExportPreflight,
} from '@/features/finance/server/finance-history-export-context'

const supabase = {} as import('@supabase/supabase-js').SupabaseClient

describe('resolveFinanceHistoryExportContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'emp-1' })
    mocks.isFinanceTeamMember.mockResolvedValue(true)
  })

  it('returns 401 when there is no authenticated user', async () => {
    const result = await resolveFinanceHistoryExportContext(
      supabase,
      null,
      new URLSearchParams()
    )
    expect(result).toEqual({
      ok: false,
      status: 401,
      message: 'Unauthorized request.',
    })
  })

  it('returns 403 when the employee is not a finance team member', async () => {
    mocks.isFinanceTeamMember.mockResolvedValue(false)

    const result = await resolveFinanceHistoryExportContext(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )
    expect(result).toEqual({
      ok: false,
      status: 403,
      message: 'Finance access is required.',
    })
  })

  it('force-nulls claimStatus regardless of the query param', async () => {
    const result = await resolveFinanceHistoryExportContext(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams({ claimStatus: 'approved', employeeName: 'Jane' })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.context.filters.claimStatus).toBeNull()
    expect(result.context.filters.employeeName).toBe('Jane')
  })
})

describe('resolveFinanceHistoryExportPreflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'emp-1' })
    mocks.isFinanceTeamMember.mockResolvedValue(true)
    mocks.getFinanceHistoryTotalCount.mockResolvedValue(99)
  })

  it('returns employeeId and the estimated total on success', async () => {
    const result = await resolveFinanceHistoryExportPreflight(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result).toEqual({
      ok: true,
      employeeId: 'emp-1',
      estimatedTotalRows: 99,
    })
  })

  it('propagates a context failure without calling the count query', async () => {
    mocks.isFinanceTeamMember.mockResolvedValue(false)

    const result = await resolveFinanceHistoryExportPreflight(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result.ok).toBe(false)
    expect(mocks.getFinanceHistoryTotalCount).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/finance/server/__tests__/finance-history-export-context.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/finance/server/finance-history-export-context.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

import { isFinanceTeamMember } from '@/features/finance/permissions'
import {
  getEmployeeByEmail,
  type EmployeeRow,
} from '@/lib/services/employee-service'
import { getFinanceHistoryTotalCount } from '@/features/finance/data/queries'
import {
  normalizeFinanceFilters,
  type FinanceFilters,
} from '@/features/finance/utils/filters'
import type { ExportPreflightResult } from '@/lib/utils/export-preflight'

export type FinanceHistoryExportContext = {
  employee: EmployeeRow
  filters: FinanceFilters
}

export type FinanceHistoryExportContextResult =
  | { ok: true; context: FinanceHistoryExportContext }
  | { ok: false; status: number; message: string }

function buildFinanceHistoryExportFilters(
  searchParams: URLSearchParams
): FinanceFilters {
  const filters = normalizeFinanceFilters({
    employeeId: searchParams.get('employeeId') ?? undefined,
    employeeName: searchParams.get('employeeName') ?? undefined,
    claimNumber: searchParams.get('claimNumber') ?? undefined,
    ownerDesignation: searchParams.get('ownerDesignation') ?? undefined,
    hodApproverEmployeeId:
      searchParams.get('hodApproverEmployeeId') ?? undefined,
    workLocation: searchParams.get('workLocation') ?? undefined,
    actionFilter: searchParams.get('actionFilter') ?? undefined,
    dateFilterField: searchParams.get('dateFilterField') ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
  })

  // finance/export (also served at /approved-history/export) never supports
  // status filtering — matches the Approved History page's own filter scope.
  return { ...filters, claimStatus: null }
}

export async function resolveFinanceHistoryExportContext(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<FinanceHistoryExportContextResult> {
  if (!user?.email) {
    return { ok: false, status: 401, message: 'Unauthorized request.' }
  }

  const employee = await getEmployeeByEmail(supabase, user.email)

  if (!employee || !(await isFinanceTeamMember(supabase, employee))) {
    return { ok: false, status: 403, message: 'Finance access is required.' }
  }

  return {
    ok: true,
    context: {
      employee,
      filters: buildFinanceHistoryExportFilters(searchParams),
    },
  }
}

export async function resolveFinanceHistoryExportPreflight(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<ExportPreflightResult> {
  const resolved = await resolveFinanceHistoryExportContext(
    supabase,
    user,
    searchParams
  )

  if (!resolved.ok) {
    return resolved
  }

  const { employee, filters } = resolved.context
  const estimatedTotalRows = await getFinanceHistoryTotalCount(
    supabase,
    filters
  )

  return { ok: true, employeeId: employee.id, estimatedTotalRows }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/finance/server/__tests__/finance-history-export-context.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/finance/server/finance-history-export-context.ts src/features/finance/server/__tests__/finance-history-export-context.test.ts
git commit -m "feat(finance): extract shared finance-history export context + preflight resolver"
```

---

### Task 2: Finance pending export context + preflight resolver

**Files:**

- Create: `src/features/finance/server/finance-pending-export-context.ts`
- Test: `src/features/finance/server/__tests__/finance-pending-export-context.test.ts`

Moves the existing (currently route-local) `getPendingClaimsExportFilters` logic from `finance/pending-export/route.ts` into a shared, testable function.

- [ ] **Step 1: Write the failing test**

Create `src/features/finance/server/__tests__/finance-pending-export-context.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEmployeeByEmail: vi.fn(),
  isFinanceTeamMember: vi.fn(),
  getFinanceQueueTotalCount: vi.fn(),
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
}))

vi.mock('@/features/finance/permissions', () => ({
  isFinanceTeamMember: mocks.isFinanceTeamMember,
}))

vi.mock('@/features/finance/data/queries', () => ({
  getFinanceQueueTotalCount: mocks.getFinanceQueueTotalCount,
}))

import {
  resolveFinancePendingExportContext,
  resolveFinancePendingExportPreflight,
} from '@/features/finance/server/finance-pending-export-context'

const supabase = {} as import('@supabase/supabase-js').SupabaseClient

describe('resolveFinancePendingExportContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'emp-1' })
    mocks.isFinanceTeamMember.mockResolvedValue(true)
  })

  it('returns 401 when there is no authenticated user', async () => {
    const result = await resolveFinancePendingExportContext(
      supabase,
      null,
      new URLSearchParams()
    )
    expect(result).toEqual({
      ok: false,
      status: 401,
      message: 'Unauthorized request.',
    })
  })

  it('returns 403 when the employee is not a finance team member', async () => {
    mocks.isFinanceTeamMember.mockResolvedValue(false)

    const result = await resolveFinancePendingExportContext(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )
    expect(result).toEqual({
      ok: false,
      status: 403,
      message: 'Finance access is required.',
    })
  })

  it('zeroes hodApproverEmployeeId/claimStatus/actionFilter and defaults dateFilterField to claim_date when out of range', async () => {
    const result = await resolveFinancePendingExportContext(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams({
        hodApproverEmployeeId: 'hod-1',
        claimStatus: 'approved',
        actionFilter: 'x',
        dateFilterField: 'finance_approved_date',
      })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.context.filters.hodApproverEmployeeId).toBeNull()
    expect(result.context.filters.claimStatus).toBeNull()
    expect(result.context.filters.actionFilter).toBeNull()
    expect(result.context.filters.dateFilterField).toBe('claim_date')
  })

  it('keeps an in-range dateFilterField (submitted_at)', async () => {
    const result = await resolveFinancePendingExportContext(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams({ dateFilterField: 'submitted_at' })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.context.filters.dateFilterField).toBe('submitted_at')
  })
})

describe('resolveFinancePendingExportPreflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'emp-1' })
    mocks.isFinanceTeamMember.mockResolvedValue(true)
    mocks.getFinanceQueueTotalCount.mockResolvedValue(7)
  })

  it('returns employeeId and the estimated total on success', async () => {
    const result = await resolveFinancePendingExportPreflight(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result).toEqual({
      ok: true,
      employeeId: 'emp-1',
      estimatedTotalRows: 7,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/finance/server/__tests__/finance-pending-export-context.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/finance/server/finance-pending-export-context.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

import { isFinanceTeamMember } from '@/features/finance/permissions'
import {
  getEmployeeByEmail,
  type EmployeeRow,
} from '@/lib/services/employee-service'
import { getFinanceQueueTotalCount } from '@/features/finance/data/queries'
import {
  normalizeFinanceFilters,
  type FinanceFilters,
} from '@/features/finance/utils/filters'
import type { FinanceDateFilterField } from '@/features/finance/types'
import type { ExportPreflightResult } from '@/lib/utils/export-preflight'

export type FinancePendingExportContext = {
  employee: EmployeeRow
  filters: FinanceFilters
}

export type FinancePendingExportContextResult =
  | { ok: true; context: FinancePendingExportContext }
  | { ok: false; status: number; message: string }

const PENDING_CLAIMS_DATE_FILTER_OPTIONS: FinanceDateFilterField[] = [
  'claim_date',
  'submitted_at',
  'hod_approved_date',
]

const PENDING_CLAIMS_DATE_FILTER_OPTION_SET = new Set(
  PENDING_CLAIMS_DATE_FILTER_OPTIONS
)

function buildFinancePendingExportFilters(
  searchParams: URLSearchParams
): FinanceFilters {
  const normalizedFilters = normalizeFinanceFilters({
    employeeName: searchParams.get('employeeName') ?? undefined,
    claimNumber: searchParams.get('claimNumber') ?? undefined,
    ownerDesignation: searchParams.get('ownerDesignation') ?? undefined,
    claimStatus: searchParams.get('claimStatus') ?? undefined,
    workLocation: searchParams.get('workLocation') ?? undefined,
    dateFilterField: searchParams.get('dateFilterField') ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
  })

  return {
    ...normalizedFilters,
    // Pending claims page does not use these filters.
    hodApproverEmployeeId: null,
    claimStatus: null,
    actionFilter: null,
    dateFilterField: PENDING_CLAIMS_DATE_FILTER_OPTION_SET.has(
      normalizedFilters.dateFilterField
    )
      ? normalizedFilters.dateFilterField
      : 'claim_date',
  }
}

export async function resolveFinancePendingExportContext(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<FinancePendingExportContextResult> {
  if (!user?.email) {
    return { ok: false, status: 401, message: 'Unauthorized request.' }
  }

  const employee = await getEmployeeByEmail(supabase, user.email)

  if (!employee || !(await isFinanceTeamMember(supabase, employee))) {
    return { ok: false, status: 403, message: 'Finance access is required.' }
  }

  return {
    ok: true,
    context: {
      employee,
      filters: buildFinancePendingExportFilters(searchParams),
    },
  }
}

export async function resolveFinancePendingExportPreflight(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<ExportPreflightResult> {
  const resolved = await resolveFinancePendingExportContext(
    supabase,
    user,
    searchParams
  )

  if (!resolved.ok) {
    return resolved
  }

  const { employee, filters } = resolved.context
  const estimatedTotalRows = await getFinanceQueueTotalCount(supabase, filters)

  return { ok: true, employeeId: employee.id, estimatedTotalRows }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/finance/server/__tests__/finance-pending-export-context.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/finance/server/finance-pending-export-context.ts src/features/finance/server/__tests__/finance-pending-export-context.test.ts
git commit -m "feat(finance): extract shared finance-pending export context + preflight resolver"
```

---

### Task 3: Register both export types in `/api/exports/start`

**Files:**

- Modify: `src/app/api/exports/start/route.ts`
- Modify: `src/app/api/exports/start/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/app/api/exports/start/__tests__/route.test.ts`: add two more hoisted mocks and mock modules, then two more `it` cases.

Add to the `vi.hoisted` block:

```ts
  resolveFinanceHistoryExportPreflight: vi.fn(),
  resolveFinancePendingExportPreflight: vi.fn(),
```

Add two more `vi.mock` calls alongside the existing ones:

```ts
vi.mock('@/features/finance/server/finance-history-export-context', () => ({
  resolveFinanceHistoryExportPreflight:
    mocks.resolveFinanceHistoryExportPreflight,
}))

vi.mock('@/features/finance/server/finance-pending-export-context', () => ({
  resolveFinancePendingExportPreflight:
    mocks.resolveFinancePendingExportPreflight,
}))
```

Add two new test cases inside the existing `describe` block:

```ts
it('routes finance-history exports to the finance-history preflight resolver', async () => {
  mocks.resolveFinanceHistoryExportPreflight.mockResolvedValue({
    ok: true,
    employeeId: 'emp-3',
    estimatedTotalRows: 8,
  })
  mocks.createExportProgress.mockReturnValue('req-fh')

  const response = await POST(
    new Request('http://localhost:3000/api/exports/start', {
      method: 'POST',
      body: JSON.stringify({ exportType: 'finance-history', query: '' }),
    })
  )

  expect(response.status).toBe(200)
  expect(mocks.resolveFinanceHistoryExportPreflight).toHaveBeenCalledTimes(1)
})

it('routes finance-pending exports to the finance-pending preflight resolver', async () => {
  mocks.resolveFinancePendingExportPreflight.mockResolvedValue({
    ok: true,
    employeeId: 'emp-4',
    estimatedTotalRows: 3,
  })
  mocks.createExportProgress.mockReturnValue('req-fp')

  const response = await POST(
    new Request('http://localhost:3000/api/exports/start', {
      method: 'POST',
      body: JSON.stringify({ exportType: 'finance-pending', query: '' }),
    })
  )

  expect(response.status).toBe(200)
  expect(mocks.resolveFinancePendingExportPreflight).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/exports/start/__tests__/route.test.ts`
Expected: FAIL — `finance-history`/`finance-pending` are not registered yet, so both new tests get a 400 "Unknown export type." response.

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/exports/start/route.ts`, add the two imports and two map entries:

```ts
import { resolveFinanceHistoryExportPreflight } from '@/features/finance/server/finance-history-export-context'
import { resolveFinancePendingExportPreflight } from '@/features/finance/server/finance-pending-export-context'
```

```ts
const EXPORT_PREFLIGHT_HANDLERS: Record<string, ExportPreflightHandler> = {
  'my-claims': resolveMyClaimsExportPreflight,
  'approval-history': resolveApprovalHistoryExportPreflight,
  'finance-history': resolveFinanceHistoryExportPreflight,
  'finance-pending': resolveFinancePendingExportPreflight,
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/exports/start/__tests__/route.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/exports/start/route.ts src/app/api/exports/start/__tests__/route.test.ts
git commit -m "feat(export): register finance-history and finance-pending in /api/exports/start"
```

---

### Task 4: Migrate `finance/export/route.ts`

**Files:**

- Modify: `src/app/(app)/finance/export/route.ts`
- Modify: `src/app/(app)/finance/export/__tests__/route.test.ts`

Switches to `getFinanceHistoryPageForExport` (Phase 1) — this is the change that removes the wasted available-actions RPC call. Drops `mode=page|all`.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/app/(app)/finance/export/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveFinanceHistoryExportContext: vi.fn(),
  getFinanceHistoryPageForExport: vi.fn(),
  runCsvExport: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/finance/server/finance-history-export-context', () => ({
  resolveFinanceHistoryExportContext: mocks.resolveFinanceHistoryExportContext,
}))

vi.mock('@/features/finance/data/queries', () => ({
  getFinanceHistoryPageForExport: mocks.getFinanceHistoryPageForExport,
}))

vi.mock('@/features/finance/utils/filters', () => ({
  FINANCE_HISTORY_CSV_HEADERS: ['Claim Number'],
  mapFinanceHistoryToCsvRow: vi.fn(
    (row: { claim: { claim_number: string } }) => [row.claim.claim_number]
  ),
}))

vi.mock('@/lib/utils/run-csv-export', () => ({
  runCsvExport: mocks.runCsvExport,
}))

import { GET, POST } from '@/app/(app)/finance/export/route'

describe('finance export route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'finance@nxtwave.co.in' } },
        }),
      },
    })

    mocks.resolveFinanceHistoryExportContext.mockResolvedValue({
      ok: true,
      context: {
        employee: { id: 'finance-1' },
        filters: {
          employeeId: null,
          employeeName: null,
          claimNumber: null,
          ownerDesignation: null,
          hodApproverEmployeeId: null,
          claimStatus: null,
          workLocation: null,
          actionFilter: null,
          dateFilterField: 'claim_date',
          dateFrom: null,
          dateTo: null,
        },
      },
    })

    mocks.runCsvExport.mockReturnValue(
      new Response('Claim Number\nCLAIM-1', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('streams via runCsvExport using getFinanceHistoryPageForExport (no availableActions call)', async () => {
    const response = await GET(
      new Request('http://localhost:3000/finance/export?requestId=req-1')
    )

    expect(response.status).toBe(200)
    expect(mocks.runCsvExport).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: ['Claim Number'],
        filename: expect.stringContaining('approved-history-'),
      }),
      'req-1'
    )

    const [recipe] = mocks.runCsvExport.mock.calls[0]
    await recipe.fetchPage('cursor-a', 500)
    expect(mocks.getFinanceHistoryPageForExport).toHaveBeenCalledWith(
      expect.anything(),
      'cursor-a',
      500,
      expect.anything()
    )
  })

  it('returns 401 with Content-Disposition set for unauthenticated requests', async () => {
    mocks.resolveFinanceHistoryExportContext.mockResolvedValue({
      ok: false,
      status: 401,
      message: 'Unauthorized request.',
    })

    const response = await GET(
      new Request('http://localhost:3000/finance/export')
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
  })

  it('returns 403 when finance access is required', async () => {
    mocks.resolveFinanceHistoryExportContext.mockResolvedValue({
      ok: false,
      status: 403,
      message: 'Finance access is required.',
    })

    const response = await GET(
      new Request('http://localhost:3000/finance/export')
    )

    expect(response.status).toBe(403)
  })

  it('supports POST requests', async () => {
    const response = await POST(
      new Request('http://localhost:3000/finance/export', { method: 'POST' })
    )
    expect(response.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/(app)/finance/export/__tests__/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/app/(app)/finance/export/route.ts`:

```ts
import { resolveFinanceHistoryExportContext } from '@/features/finance/server/finance-history-export-context'
import { getFinanceHistoryPageForExport } from '@/features/finance/data/queries'
import {
  FINANCE_HISTORY_CSV_HEADERS,
  mapFinanceHistoryToCsvRow,
} from '@/features/finance/utils/filters'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  buildDatedCsvFilename,
  createCsvExportErrorResponse,
  createExportRouteHandlers,
} from '@/lib/utils/export-route'
import { runCsvExport } from '@/lib/utils/run-csv-export'

async function handleExportRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const requestId = url.searchParams.get('requestId')

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const resolved = await resolveFinanceHistoryExportContext(
    supabase,
    user?.email ? { email: user.email } : null,
    url.searchParams
  )

  if (!resolved.ok) {
    return createCsvExportErrorResponse(resolved.message, resolved.status)
  }

  const { filters } = resolved.context
  const filename = buildDatedCsvFilename('approved-history')

  return runCsvExport(
    {
      fetchPage: (cursor, limit) =>
        getFinanceHistoryPageForExport(supabase, cursor, limit, filters),
      headers: FINANCE_HISTORY_CSV_HEADERS,
      mapRow: mapFinanceHistoryToCsvRow,
      filename,
    },
    requestId
  )
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/(app)/finance/export/__tests__/route.test.ts "src/app/(app)/approved-history/export/__tests__/route.test.ts"`
Expected: PASS. The `approved-history/export` test re-exports the same handler, so it should continue passing unmodified — if it mocks `@/app/(app)/finance/export/route` directly (per the barrel pattern), no change is needed there at all.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/finance/export/route.ts" "src/app/(app)/finance/export/__tests__/route.test.ts"
git commit -m "feat(finance): migrate finance/export onto the shared pipeline, drop wasted availableActions call"
```

---

### Task 5: Migrate `finance/pending-export/route.ts`

**Files:**

- Modify: `src/app/(app)/finance/pending-export/route.ts`
- Modify: `src/app/(app)/finance/pending-export/__tests__/route.test.ts`

No query change (per spec — this route's second query is necessary, not wasted). Just moves onto the shared pipeline and drops `mode=page|all`.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/app/(app)/finance/pending-export/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveFinancePendingExportContext: vi.fn(),
  getFinanceQueuePaginated: vi.fn(),
  runCsvExport: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/finance/server/finance-pending-export-context', () => ({
  resolveFinancePendingExportContext: mocks.resolveFinancePendingExportContext,
}))

vi.mock('@/features/finance/data/queries', () => ({
  getFinanceQueuePaginated: mocks.getFinanceQueuePaginated,
}))

vi.mock('@/features/finance/utils/filters', () => ({
  FINANCE_PENDING_CLAIMS_CSV_HEADERS: ['Claim ID'],
  mapFinancePendingClaimToCsvRow: vi.fn((row: { claimId: string }) => [
    row.claimId,
  ]),
}))

vi.mock('@/lib/utils/run-csv-export', () => ({
  runCsvExport: mocks.runCsvExport,
}))

import { GET, POST } from '@/app/(app)/finance/pending-export/route'

describe('finance pending export route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'finance@nxtwave.co.in' } },
        }),
      },
    })

    mocks.resolveFinancePendingExportContext.mockResolvedValue({
      ok: true,
      context: {
        employee: { id: 'finance-1' },
        filters: {
          employeeName: null,
          claimNumber: null,
          ownerDesignation: null,
          hodApproverEmployeeId: null,
          claimStatus: null,
          workLocation: null,
          actionFilter: null,
          dateFilterField: 'claim_date',
          dateFrom: null,
          dateTo: null,
        },
      },
    })

    mocks.runCsvExport.mockReturnValue(
      new Response('Claim ID\nCLAIM-1', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('streams via runCsvExport using getFinanceQueuePaginated', async () => {
    const response = await GET(
      new Request(
        'http://localhost:3000/finance/pending-export?requestId=req-1'
      )
    )

    expect(response.status).toBe(200)
    expect(mocks.runCsvExport).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: ['Claim ID'],
        filename: expect.stringContaining('pending-claims-'),
      }),
      'req-1'
    )

    const [recipe] = mocks.runCsvExport.mock.calls[0]
    await recipe.fetchPage('cursor-a', 500)
    expect(mocks.getFinanceQueuePaginated).toHaveBeenCalledWith(
      expect.anything(),
      'cursor-a',
      500,
      expect.anything()
    )
  })

  it('returns 403 when finance access is required', async () => {
    mocks.resolveFinancePendingExportContext.mockResolvedValue({
      ok: false,
      status: 403,
      message: 'Finance access is required.',
    })

    const response = await GET(
      new Request('http://localhost:3000/finance/pending-export')
    )

    expect(response.status).toBe(403)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
  })

  it('supports POST requests', async () => {
    const response = await POST(
      new Request('http://localhost:3000/finance/pending-export', {
        method: 'POST',
      })
    )
    expect(response.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/(app)/finance/pending-export/__tests__/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/app/(app)/finance/pending-export/route.ts`:

```ts
import { resolveFinancePendingExportContext } from '@/features/finance/server/finance-pending-export-context'
import { getFinanceQueuePaginated } from '@/features/finance/data/queries'
import {
  FINANCE_PENDING_CLAIMS_CSV_HEADERS,
  mapFinancePendingClaimToCsvRow,
} from '@/features/finance/utils/filters'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  buildDatedCsvFilename,
  createCsvExportErrorResponse,
  createExportRouteHandlers,
} from '@/lib/utils/export-route'
import { runCsvExport } from '@/lib/utils/run-csv-export'

async function handleExportRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const requestId = url.searchParams.get('requestId')

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const resolved = await resolveFinancePendingExportContext(
    supabase,
    user?.email ? { email: user.email } : null,
    url.searchParams
  )

  if (!resolved.ok) {
    return createCsvExportErrorResponse(resolved.message, resolved.status)
  }

  const { filters } = resolved.context
  const filename = buildDatedCsvFilename('pending-claims')

  return runCsvExport(
    {
      fetchPage: (cursor, limit) =>
        getFinanceQueuePaginated(supabase, cursor, limit, filters),
      headers: FINANCE_PENDING_CLAIMS_CSV_HEADERS,
      mapRow: mapFinancePendingClaimToCsvRow,
      filename,
    },
    requestId
  )
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/(app)/finance/pending-export/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/finance/pending-export/route.ts" "src/app/(app)/finance/pending-export/__tests__/route.test.ts"
git commit -m "feat(finance): migrate finance/pending-export onto the shared pipeline"
```

---

### Task 6: Trim `ApprovedHistoryExportActions` to BC-Expense + Payment Journals only

**Files:**

- Modify: `src/features/finance/components/approved-history-export-actions.tsx`

Removes the "All CSV" button (now a separate `CsvExportButton`, wired in Task 7). BC-Expense and Payment Journals stay on the old raw-anchor pattern until Phase 4 migrates them.

- [ ] **Step 1: Replace the full contents**

Replace `src/features/finance/components/approved-history-export-actions.tsx` in full:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'

type ApprovedHistoryExportActionsProps = {
  exportBcExpenseHref: string
  exportPaymentJournalsHref: string
  buttonClassName?: string
  containerClassName?: string
}

type ExportMode = 'bc' | 'payment-journals'

function mergeClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

function triggerDownload(href: string) {
  const link = document.createElement('a')
  link.href = href
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
}

export function ApprovedHistoryExportActions({
  exportBcExpenseHref,
  exportPaymentJournalsHref,
  buttonClassName,
  containerClassName,
}: ApprovedHistoryExportActionsProps) {
  const [activeMode, setActiveMode] = useState<ExportMode | null>(null)
  const resetTimerRef = useRef<number | null>(null)

  const isExporting = activeMode !== null

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  async function handleDownload(mode: ExportMode, href: string) {
    if (isExporting) {
      return
    }

    setActiveMode(mode)

    try {
      triggerDownload(href)
    } finally {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }

      resetTimerRef.current = window.setTimeout(() => {
        setActiveMode(null)
        resetTimerRef.current = null
      }, 500)
    }
  }

  const baseButtonClassName =
    'inline-flex items-center gap-1.5 border border-border bg-surface px-3 py-2.5 text-xs font-medium shadow-xs transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70'

  return (
    <div
      className={mergeClassNames(
        'ml-auto flex items-center gap-2',
        containerClassName
      )}
    >
      <button
        type="button"
        onClick={() => void handleDownload('bc', exportBcExpenseHref)}
        disabled={isExporting}
        className={mergeClassNames(baseButtonClassName, buttonClassName)}
      >
        <FileSpreadsheet className="size-3.5" />
        {activeMode === 'bc' ? 'Exporting...' : 'BC Expense'}
      </button>

      <button
        type="button"
        disabled={isExporting}
        onClick={() =>
          void handleDownload('payment-journals', exportPaymentJournalsHref)
        }
        className={mergeClassNames(baseButtonClassName, buttonClassName)}
      >
        {activeMode === 'payment-journals'
          ? 'Exporting...'
          : 'Payment Journals'}
      </button>
    </div>
  )
}
```

No dedicated test file exists for this component today (confirmed: there is no `approved-history-export-actions.test.tsx` anywhere in the repo) — no test changes are needed for this step.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: errors only at this component's call site in `finance-filters-bar.tsx` (fixed in the next task) — no other errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/finance/components/approved-history-export-actions.tsx
git commit -m "refactor(finance): trim ApprovedHistoryExportActions to BC-Expense + Payment Journals only"
```

---

### Task 7: Update `finance-filters-bar.tsx` to use `CsvExportButton`

**Files:**

- Modify: `src/features/finance/components/finance-filters-bar.tsx`

This component is shared by both `/finance` (pending queue, single export button) and `/approved-history` (finance-history export + the trimmed BC-Expense/Payment-Journals pair).

- [ ] **Step 1: Update imports and props type**

Replace the import block:

```ts
import { CsvExportButton } from '@/components/ui/csv-export-button'
import { EmployeeNameSuggestionInput } from '@/components/ui/employee-name-suggestion-input'
import { ApprovedHistoryExportActions } from '@/features/finance/components/approved-history-export-actions'
import { getFinanceEmployeeNameSuggestionsAction } from '@/features/finance/server/actions'
```

Replace the props type:

```ts
type FinanceFiltersBarProps = {
  pathname: string
  heading?: string
  filters: FinanceFilters
  options: FinanceFilterOptions
  showEmployeeIdFilter?: boolean
  showHodApproverFilter?: boolean
  showClaimStatusFilter?: boolean
  showActionFilter?: boolean
  showDateFilter?: boolean
  dateFilterOptions?: FinanceDateFilterField[]
  exportHref?: string
  financeHistoryExportHref?: string
  approvedHistoryBcExpenseHref?: string
  approvedHistoryPaymentJournalsHref?: string
}
```

Update the destructured props (in the `export function FinanceFiltersBar({ ... })` signature):

```ts
export function FinanceFiltersBar({
  pathname,
  heading = 'Finance Filters',
  filters,
  options,
  showEmployeeIdFilter = false,
  showHodApproverFilter = true,
  showClaimStatusFilter = true,
  showActionFilter = true,
  showDateFilter = true,
  dateFilterOptions = DEFAULT_DATE_FILTER_OPTIONS,
  exportHref,
  financeHistoryExportHref,
  approvedHistoryBcExpenseHref,
  approvedHistoryPaymentJournalsHref,
}: FinanceFiltersBarProps) {
```

- [ ] **Step 2: Update the render block**

Replace the export-buttons block at the end of the `<form>`:

```tsx
{
  financeHistoryExportHref &&
  approvedHistoryBcExpenseHref &&
  approvedHistoryPaymentJournalsHref ? (
    <>
      <CsvExportButton
        exportType="finance-history"
        href={financeHistoryExportHref}
        label="All CSV"
        className="rounded-md"
      />
      <ApprovedHistoryExportActions
        exportBcExpenseHref={approvedHistoryBcExpenseHref}
        exportPaymentJournalsHref={approvedHistoryPaymentJournalsHref}
        buttonClassName="rounded-md"
      />
    </>
  ) : exportHref ? (
    <CsvExportButton
      exportType="finance-pending"
      href={exportHref}
      label="Export CSV"
      className="rounded-md"
    />
  ) : null
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: errors only at the two page call sites (`finance/page.tsx`, `approved-history/page.tsx`), fixed in Tasks 8–9.

- [ ] **Step 4: Commit**

```bash
git add src/features/finance/components/finance-filters-bar.tsx
git commit -m "feat(finance): wire finance-filters-bar onto CsvExportButton"
```

---

### Task 8: Update `finance/page.tsx` (pending queue)

**Files:**

- Modify: `src/app/(app)/finance/page.tsx`

- [ ] **Step 1: Replace the CSV-params block**

Replace the block that currently builds `currentPageCsvParams`/`exportCurrentPageHref` and `allRowsCsvParams`/`exportAllHref`:

```ts
const exportCsvParams = addFinanceFiltersToParams(
  new URLSearchParams(),
  effectiveFilters
)

const exportHref = `/finance/pending-export?${exportCsvParams.toString()}`
```

Update the `FinanceFiltersBar` usage:

```tsx
<FinanceFiltersBar
  key={toSortedQueryString(
    addFinanceFiltersToParams(new URLSearchParams(), effectiveFilters)
  )}
  pathname="/finance"
  heading="Pending Claims Filters"
  filters={effectiveFilters}
  options={filterOptions}
  showHodApproverFilter={false}
  showClaimStatusFilter={false}
  showActionFilter={false}
  dateFilterOptions={PENDING_CLAIMS_DATE_FILTER_OPTIONS}
  exportHref={exportHref}
/>
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev`, sign in as a finance team member, visit `/finance`, click "Export CSV". Confirm real progress, no navigation on a simulated failure (e.g. temporarily break the DB connection), and a correct CSV download.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/finance/page.tsx"
git commit -m "feat(finance): wire finance pending-queue page onto CsvExportButton"
```

---

### Task 9: Update `approved-history/page.tsx`

**Files:**

- Modify: `src/app/(app)/approved-history/page.tsx`

- [ ] **Step 1: Replace the CSV-params block**

Replace the block that currently builds `allRowsCsvParams` (with `mode=all`) and the three hrefs:

```ts
const exportParams = addFinanceFiltersToParams(
  new URLSearchParams(),
  effectiveFilters
)

const financeHistoryExportHref = `/approved-history/export?${exportParams.toString()}`
const exportBcExpenseHref = `/approved-history/bc-expense-export?${exportParams.toString()}`
const exportPaymentJournalsHref = `/approved-history/payment-journals-export?${exportParams.toString()}`
```

Update the `FinanceFiltersBar` usage:

```tsx
<FinanceFiltersBar
  key={toSortedQueryString(
    addFinanceFiltersToParams(new URLSearchParams(), effectiveFilters)
  )}
  pathname="/approved-history"
  heading="Approved History Filters"
  filters={effectiveFilters}
  options={filterOptions}
  showEmployeeIdFilter
  showHodApproverFilter={false}
  showClaimStatusFilter={false}
  financeHistoryExportHref={financeHistoryExportHref}
  approvedHistoryBcExpenseHref={exportBcExpenseHref}
  approvedHistoryPaymentJournalsHref={exportPaymentJournalsHref}
/>
```

Note: `financeHistoryExportHref` points at `/approved-history/export` (the barrel re-export confirmed to point at the same `finance/export/route.ts` handler) rather than `/finance/export` directly — either URL works identically since they resolve to the same handler; keeping `/approved-history/export` here matches the page's existing convention and avoids an unrelated URL change.

- [ ] **Step 2: Verify manually**

Run: `npm run dev`, sign in as finance, visit `/approved-history`, click "All CSV". Confirm real progress and correct download. Confirm "BC Expense" and "Payment Journals" buttons still work exactly as before (unchanged in this phase — still the old raw-anchor pattern, migrated in Phase 4).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/approved-history/page.tsx"
git commit -m "feat(finance): wire approved-history page onto CsvExportButton for the All CSV export"
```

---

## Phase 3 Completion Checklist

- [ ] `/api/exports/start` resolves all 4 of: `my-claims`, `approval-history`, `finance-history`, `finance-pending`.
- [ ] `finance/export` (and its `/approved-history/export` barrel) uses `getFinanceHistoryPageForExport` — zero calls to the available-actions RPC, verified by test.
- [ ] `finance/pending-export` migrated onto the shared pipeline, behavior unchanged (2 queries/chunk, both used).
- [ ] `/approved-history` page shows: `CsvExportButton` for "All CSV" (real progress) + still-unmigrated raw-anchor BC-Expense/Payment-Journals buttons.
- [ ] `/finance` page shows a single `CsvExportButton` for the pending-queue export.
- [ ] All tests pass: `npx vitest run`.
- [ ] `streaming-export.ts`, `csv-export-actions.tsx` still exist (only `csv-export-actions.tsx`'s last remaining consumers, if any, should be checked — by this point Claims/Approvals/Finance-pending have all moved to `CsvExportButton`; if `csv-export-actions.tsx` has zero remaining imports, that's expected and fine, it gets deleted in Phase 5, not this phase).

**Next:** Phase 4 (`docs/superpowers/plans/2026-07-01-csv-export-rebuild-phase4-bc-payment.md`) migrates `bc-expense-export` (closing the 3-queries-to-2 N+1 fix) and `payment-journals-export`, and fully retires `ApprovedHistoryExportActions`.
