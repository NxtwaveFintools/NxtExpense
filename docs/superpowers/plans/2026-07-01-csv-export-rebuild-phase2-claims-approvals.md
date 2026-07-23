# CSV Export Rebuild — Phase 2: Preflight/Status Routes, New Client Button, Claims + Approvals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `POST /api/exports/start` and `GET /api/exports/status`, build the new native-download + polling client button, and migrate the two lowest-risk exports (`claims/export`, `approvals/export` — neither has a query change from Phase 1) onto the new pipeline end-to-end.

**Prerequisite:** Phase 1 (`docs/superpowers/plans/2026-07-01-csv-export-rebuild-phase1-foundation.md`) is complete — `run-csv-export.ts`, `export-progress-registry.ts`, and `createCsvExportErrorResponse` all exist and are tested.

**Architecture:** See `docs/superpowers/specs/2026-07-01-csv-export-rebuild-design.md`. Each export type gets a small `resolve<Feature>ExportContext` (shared by its GET route and its preflight handler, so auth/filter logic is written once) plus a `resolve<Feature>ExportPreflight` (context + count query) registered in `/api/exports/start`'s handler map.

**Tech Stack:** Next.js route handlers, Supabase JS client, React (client component), Vitest, Testing Library, MSW.

---

### Task 1: Shared export-preflight types

**Files:**

- Create: `src/lib/utils/export-preflight.ts`

No test needed — this file contains only type declarations, nothing executable.

- [ ] **Step 1: Create the file**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type ExportPreflightResult =
  | { ok: true; employeeId: string; estimatedTotalRows: number | null }
  | { ok: false; status: number; message: string }

export type ExportPreflightHandler = (
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
) => Promise<ExportPreflightResult>
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/export-preflight.ts
git commit -m "feat(export): add shared export preflight types"
```

---

### Task 2: Claims export context + preflight resolver

**Files:**

- Create: `src/features/claims/server/claims-export-context.ts`
- Test: `src/features/claims/server/__tests__/claims-export-context.test.ts`

Extracts the auth/permission/filter logic currently inline in `claims/export/route.ts` so both the route and `/api/exports/start` call the exact same function — no duplicated logic.

- [ ] **Step 1: Write the failing test**

Create `src/features/claims/server/__tests__/claims-export-context.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEmployeeByEmail: vi.fn(),
  canAccessEmployeeClaims: vi.fn(),
  canDownloadClaimsCsv: vi.fn(),
  getMyClaimsTotalCount: vi.fn(),
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
}))

vi.mock('@/features/employees/permissions', () => ({
  canAccessEmployeeClaims: mocks.canAccessEmployeeClaims,
}))

vi.mock('@/features/claims/utils/export-permissions', () => ({
  canDownloadClaimsCsv: mocks.canDownloadClaimsCsv,
}))

vi.mock('@/features/claims/data/repositories/claims.repository', () => ({
  getMyClaimsTotalCount: mocks.getMyClaimsTotalCount,
}))

import {
  resolveMyClaimsExportContext,
  resolveMyClaimsExportPreflight,
} from '@/features/claims/server/claims-export-context'

const supabase = {} as import('@supabase/supabase-js').SupabaseClient

describe('resolveMyClaimsExportContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'emp-1',
      employee_email: 'employee@nxtwave.co.in',
      designations: { designation_name: 'Student Relationship Officer' },
    })
    mocks.canAccessEmployeeClaims.mockResolvedValue(true)
    mocks.canDownloadClaimsCsv.mockReturnValue(true)
  })

  it('returns 401 when there is no authenticated user', async () => {
    const result = await resolveMyClaimsExportContext(
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

  it('returns 403 when the employee lacks claims access', async () => {
    mocks.canAccessEmployeeClaims.mockResolvedValue(false)

    const result = await resolveMyClaimsExportContext(
      supabase,
      { email: 'employee@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result).toEqual({
      ok: false,
      status: 403,
      message: 'Claims access is required.',
    })
  })

  it('returns 403 when the designation cannot download CSV', async () => {
    mocks.canDownloadClaimsCsv.mockReturnValue(false)

    const result = await resolveMyClaimsExportContext(
      supabase,
      { email: 'employee@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result).toEqual({
      ok: false,
      status: 403,
      message: 'CSV export is not available for your designation.',
    })
  })

  it('returns the employee and normalized filters on success', async () => {
    const result = await resolveMyClaimsExportContext(
      supabase,
      { email: 'employee@nxtwave.co.in' },
      new URLSearchParams({ claimStatus: 'approved', workLocation: 'wl-1' })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.context.employee.id).toBe('emp-1')
    expect(result.context.filters.claimStatus).toBe('approved')
    expect(result.context.filters.workLocation).toBe('wl-1')
  })
})

describe('resolveMyClaimsExportPreflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'emp-1',
      employee_email: 'employee@nxtwave.co.in',
      designations: { designation_name: 'Student Relationship Officer' },
    })
    mocks.canAccessEmployeeClaims.mockResolvedValue(true)
    mocks.canDownloadClaimsCsv.mockReturnValue(true)
    mocks.getMyClaimsTotalCount.mockResolvedValue(42)
  })

  it('propagates a context failure without calling the count query', async () => {
    mocks.canAccessEmployeeClaims.mockResolvedValue(false)

    const result = await resolveMyClaimsExportPreflight(
      supabase,
      { email: 'employee@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result).toEqual({
      ok: false,
      status: 403,
      message: 'Claims access is required.',
    })
    expect(mocks.getMyClaimsTotalCount).not.toHaveBeenCalled()
  })

  it('returns employeeId and the estimated total row count on success', async () => {
    const result = await resolveMyClaimsExportPreflight(
      supabase,
      { email: 'employee@nxtwave.co.in' },
      new URLSearchParams({ claimStatus: 'approved' })
    )

    expect(result).toEqual({
      ok: true,
      employeeId: 'emp-1',
      estimatedTotalRows: 42,
    })
    expect(mocks.getMyClaimsTotalCount).toHaveBeenCalledWith(
      supabase,
      'emp-1',
      expect.objectContaining({ claimStatus: 'approved' })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/claims/server/__tests__/claims-export-context.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/claims/server/claims-export-context.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

import { canAccessEmployeeClaims } from '@/features/employees/permissions'
import {
  getEmployeeByEmail,
  type EmployeeRow,
} from '@/lib/services/employee-service'
import { canDownloadClaimsCsv } from '@/features/claims/utils/export-permissions'
import { getMyClaimsTotalCount } from '@/features/claims/data/repositories/claims.repository'
import {
  normalizeMyClaimsFilters,
  type MyClaimsFilters,
} from '@/features/claims/utils/filters'
import type { ExportPreflightResult } from '@/lib/utils/export-preflight'

export type MyClaimsExportContext = {
  employee: EmployeeRow
  filters: MyClaimsFilters
}

export type MyClaimsExportContextResult =
  | { ok: true; context: MyClaimsExportContext }
  | { ok: false; status: number; message: string }

export async function resolveMyClaimsExportContext(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<MyClaimsExportContextResult> {
  if (!user?.email) {
    return { ok: false, status: 401, message: 'Unauthorized request.' }
  }

  const employee = await getEmployeeByEmail(supabase, user.email)

  if (!employee || !(await canAccessEmployeeClaims(supabase, employee))) {
    return { ok: false, status: 403, message: 'Claims access is required.' }
  }

  if (!canDownloadClaimsCsv(employee.designations?.designation_name)) {
    return {
      ok: false,
      status: 403,
      message: 'CSV export is not available for your designation.',
    }
  }

  const filters = normalizeMyClaimsFilters({
    claimStatus: searchParams.get('claimStatus') ?? undefined,
    workLocation: searchParams.get('workLocation') ?? undefined,
    claimDateFrom: searchParams.get('claimDateFrom') ?? undefined,
    claimDateTo: searchParams.get('claimDateTo') ?? undefined,
  })

  return { ok: true, context: { employee, filters } }
}

export async function resolveMyClaimsExportPreflight(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<ExportPreflightResult> {
  const resolved = await resolveMyClaimsExportContext(
    supabase,
    user,
    searchParams
  )

  if (!resolved.ok) {
    return resolved
  }

  const { employee, filters } = resolved.context
  const estimatedTotalRows = await getMyClaimsTotalCount(
    supabase,
    employee.id,
    filters
  )

  return { ok: true, employeeId: employee.id, estimatedTotalRows }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/claims/server/__tests__/claims-export-context.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/claims/server/claims-export-context.ts src/features/claims/server/__tests__/claims-export-context.test.ts
git commit -m "feat(claims): extract shared export context + preflight resolver"
```

---

### Task 3: Approval history export context + preflight resolver

**Files:**

- Create: `src/features/approvals/server/approval-history-export-context.ts`
- Test: `src/features/approvals/server/__tests__/approval-history-export-context.test.ts`

Same shape as Task 2, for `approvals/export`.

- [ ] **Step 1: Write the failing test**

Create `src/features/approvals/server/__tests__/approval-history-export-context.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEmployeeByEmail: vi.fn(),
  hasApproverAssignments: vi.fn(),
  canAccessApprovals: vi.fn(),
  getFilteredApprovalHistoryCount: vi.fn(),
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
  hasApproverAssignments: mocks.hasApproverAssignments,
}))

vi.mock('@/features/employees/permissions', () => ({
  canAccessApprovals: mocks.canAccessApprovals,
}))

vi.mock('@/features/approvals/data/queries', () => ({
  getFilteredApprovalHistoryCount: mocks.getFilteredApprovalHistoryCount,
}))

import {
  resolveApprovalHistoryExportContext,
  resolveApprovalHistoryExportPreflight,
} from '@/features/approvals/server/approval-history-export-context'

const supabase = {} as import('@supabase/supabase-js').SupabaseClient

describe('resolveApprovalHistoryExportContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'emp-1',
      employee_email: 'approver@nxtwave.co.in',
    })
    mocks.hasApproverAssignments.mockResolvedValue(true)
    mocks.canAccessApprovals.mockReturnValue(true)
  })

  it('returns 401 when there is no authenticated user', async () => {
    const result = await resolveApprovalHistoryExportContext(
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

  it('returns 403 when the employee has no approver profile', async () => {
    mocks.getEmployeeByEmail.mockResolvedValue(null)

    const result = await resolveApprovalHistoryExportContext(
      supabase,
      { email: 'approver@nxtwave.co.in' },
      new URLSearchParams()
    )
    expect(result).toEqual({
      ok: false,
      status: 403,
      message: 'Approver profile not found.',
    })
  })

  it('returns 403 when the employee lacks approver access', async () => {
    mocks.canAccessApprovals.mockReturnValue(false)

    const result = await resolveApprovalHistoryExportContext(
      supabase,
      { email: 'approver@nxtwave.co.in' },
      new URLSearchParams()
    )
    expect(result).toEqual({
      ok: false,
      status: 403,
      message: 'Access denied.',
    })
  })

  it('returns the employee and normalized filters on success', async () => {
    const result = await resolveApprovalHistoryExportContext(
      supabase,
      { email: 'approver@nxtwave.co.in' },
      new URLSearchParams({ employeeName: 'Jane' })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.context.employee.id).toBe('emp-1')
    expect(result.context.filters.employeeName).toBe('Jane')
  })
})

describe('resolveApprovalHistoryExportPreflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'emp-1',
      employee_email: 'approver@nxtwave.co.in',
    })
    mocks.hasApproverAssignments.mockResolvedValue(true)
    mocks.canAccessApprovals.mockReturnValue(true)
    mocks.getFilteredApprovalHistoryCount.mockResolvedValue(17)
  })

  it('propagates a context failure without calling the count query', async () => {
    mocks.canAccessApprovals.mockReturnValue(false)

    const result = await resolveApprovalHistoryExportPreflight(
      supabase,
      { email: 'approver@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result).toEqual({
      ok: false,
      status: 403,
      message: 'Access denied.',
    })
    expect(mocks.getFilteredApprovalHistoryCount).not.toHaveBeenCalled()
  })

  it('returns employeeId and the estimated total row count on success', async () => {
    const result = await resolveApprovalHistoryExportPreflight(
      supabase,
      { email: 'approver@nxtwave.co.in' },
      new URLSearchParams({ employeeName: 'Jane' })
    )

    expect(result).toEqual({
      ok: true,
      employeeId: 'emp-1',
      estimatedTotalRows: 17,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/approvals/server/__tests__/approval-history-export-context.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/approvals/server/approval-history-export-context.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

import { canAccessApprovals } from '@/features/employees/permissions'
import {
  getEmployeeByEmail,
  hasApproverAssignments,
  type EmployeeRow,
} from '@/lib/services/employee-service'
import { getFilteredApprovalHistoryCount } from '@/features/approvals/data/queries'
import {
  normalizeApprovalHistoryFilters,
  type ApprovalHistoryFilters,
} from '@/features/approvals/utils/history-filters'
import type { ExportPreflightResult } from '@/lib/utils/export-preflight'

export type ApprovalHistoryExportContext = {
  employee: EmployeeRow
  filters: ApprovalHistoryFilters
}

export type ApprovalHistoryExportContextResult =
  | { ok: true; context: ApprovalHistoryExportContext }
  | { ok: false; status: number; message: string }

function buildFiltersFromSearchParams(
  searchParams: URLSearchParams
): ApprovalHistoryFilters {
  return normalizeApprovalHistoryFilters({
    claimStatus: searchParams.get('claimStatus') ?? undefined,
    employeeName: searchParams.get('employeeName') ?? undefined,
    claimDateFrom: searchParams.get('claimDateFrom') ?? undefined,
    claimDateTo: searchParams.get('claimDateTo') ?? undefined,
    amountOperator: searchParams.get('amountOperator') ?? undefined,
    amountValue: searchParams.get('amountValue') ?? undefined,
    locationType: searchParams.get('locationType') ?? undefined,
    claimDateSort: searchParams.get('claimDateSort') ?? undefined,
    hodApprovedFrom: searchParams.get('hodApprovedFrom') ?? undefined,
    hodApprovedTo: searchParams.get('hodApprovedTo') ?? undefined,
    financeApprovedFrom: searchParams.get('financeApprovedFrom') ?? undefined,
    financeApprovedTo: searchParams.get('financeApprovedTo') ?? undefined,
  })
}

export async function resolveApprovalHistoryExportContext(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<ApprovalHistoryExportContextResult> {
  if (!user?.email) {
    return { ok: false, status: 401, message: 'Unauthorized request.' }
  }

  const employee = await getEmployeeByEmail(supabase, user.email)

  if (!employee) {
    return { ok: false, status: 403, message: 'Approver profile not found.' }
  }

  const approverAccess = await hasApproverAssignments(
    supabase,
    employee.employee_email
  )

  if (!canAccessApprovals(approverAccess)) {
    return { ok: false, status: 403, message: 'Access denied.' }
  }

  return {
    ok: true,
    context: { employee, filters: buildFiltersFromSearchParams(searchParams) },
  }
}

export async function resolveApprovalHistoryExportPreflight(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<ExportPreflightResult> {
  const resolved = await resolveApprovalHistoryExportContext(
    supabase,
    user,
    searchParams
  )

  if (!resolved.ok) {
    return resolved
  }

  const { employee, filters } = resolved.context
  const estimatedTotalRows = await getFilteredApprovalHistoryCount(
    supabase,
    filters
  )

  return { ok: true, employeeId: employee.id, estimatedTotalRows }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/approvals/server/__tests__/approval-history-export-context.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/approvals/server/approval-history-export-context.ts src/features/approvals/server/__tests__/approval-history-export-context.test.ts
git commit -m "feat(approvals): extract shared export context + preflight resolver"
```

---

### Task 4: `POST /api/exports/start`

**Files:**

- Create: `src/app/api/exports/start/route.ts`
- Test: `src/app/api/exports/start/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/exports/start/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveMyClaimsExportPreflight: vi.fn(),
  resolveApprovalHistoryExportPreflight: vi.fn(),
  createExportProgress: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/claims/server/claims-export-context', () => ({
  resolveMyClaimsExportPreflight: mocks.resolveMyClaimsExportPreflight,
}))

vi.mock('@/features/approvals/server/approval-history-export-context', () => ({
  resolveApprovalHistoryExportPreflight:
    mocks.resolveApprovalHistoryExportPreflight,
}))

vi.mock('@/lib/utils/export-progress-registry', () => ({
  createExportProgress: mocks.createExportProgress,
}))

import { POST } from '@/app/api/exports/start/route'

describe('POST /api/exports/start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { email: 'a@nxtwave.co.in' } } }),
      },
    })
  })

  it('returns 400 for an unknown export type', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: JSON.stringify({ exportType: 'not-a-real-type', query: '' }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Unknown export type.' })
  })

  it('returns 400 for an invalid JSON body', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: 'not json',
      })
    )

    expect(response.status).toBe(400)
  })

  it('propagates a preflight failure as { error, status }', async () => {
    mocks.resolveMyClaimsExportPreflight.mockResolvedValue({
      ok: false,
      status: 403,
      message: 'Claims access is required.',
    })

    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: JSON.stringify({ exportType: 'my-claims', query: '' }),
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'Claims access is required.',
    })
    expect(mocks.createExportProgress).not.toHaveBeenCalled()
  })

  it('creates a progress entry and returns a requestId on success', async () => {
    mocks.resolveMyClaimsExportPreflight.mockResolvedValue({
      ok: true,
      employeeId: 'emp-1',
      estimatedTotalRows: 42,
    })
    mocks.createExportProgress.mockReturnValue('req-abc')

    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: JSON.stringify({
          exportType: 'my-claims',
          query: '?claimStatus=approved',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ requestId: 'req-abc' })
    expect(mocks.createExportProgress).toHaveBeenCalledWith('emp-1', 42)

    const [, , searchParamsArg] =
      mocks.resolveMyClaimsExportPreflight.mock.calls[0]
    expect(searchParamsArg.get('claimStatus')).toBe('approved')
  })

  it('routes approval-history exports to the approvals preflight resolver', async () => {
    mocks.resolveApprovalHistoryExportPreflight.mockResolvedValue({
      ok: true,
      employeeId: 'emp-2',
      estimatedTotalRows: 5,
    })
    mocks.createExportProgress.mockReturnValue('req-xyz')

    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: JSON.stringify({ exportType: 'approval-history', query: '' }),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.resolveApprovalHistoryExportPreflight).toHaveBeenCalledTimes(1)
    expect(mocks.resolveMyClaimsExportPreflight).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/exports/start/__tests__/route.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/api/exports/start/route.ts`:

```ts
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createExportProgress } from '@/lib/utils/export-progress-registry'
import type { ExportPreflightHandler } from '@/lib/utils/export-preflight'
import { resolveMyClaimsExportPreflight } from '@/features/claims/server/claims-export-context'
import { resolveApprovalHistoryExportPreflight } from '@/features/approvals/server/approval-history-export-context'

const EXPORT_PREFLIGHT_HANDLERS: Record<string, ExportPreflightHandler> = {
  'my-claims': resolveMyClaimsExportPreflight,
  'approval-history': resolveApprovalHistoryExportPreflight,
}

type StartRequestBody = {
  exportType?: string
  query?: string
}

export async function POST(request: Request): Promise<Response> {
  let body: StartRequestBody

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const handler = body.exportType
    ? EXPORT_PREFLIGHT_HANDLERS[body.exportType]
    : undefined

  if (!handler) {
    return Response.json({ error: 'Unknown export type.' }, { status: 400 })
  }

  const searchParams = new URLSearchParams(body.query ?? '')
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const result = await handler(
    supabase,
    user?.email ? { email: user.email } : null,
    searchParams
  )

  if (!result.ok) {
    return Response.json({ error: result.message }, { status: result.status })
  }

  const requestId = createExportProgress(
    result.employeeId,
    result.estimatedTotalRows
  )

  return Response.json({ requestId })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/exports/start/__tests__/route.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/exports/start/route.ts src/app/api/exports/start/__tests__/route.test.ts
git commit -m "feat(export): add POST /api/exports/start preflight endpoint"
```

---

### Task 5: `GET /api/exports/status`

**Files:**

- Create: `src/app/api/exports/status/route.ts`
- Test: `src/app/api/exports/status/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/exports/status/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  getExportProgress: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
}))

vi.mock('@/lib/utils/export-progress-registry', () => ({
  getExportProgress: mocks.getExportProgress,
}))

import { GET } from '@/app/api/exports/status/route'

describe('GET /api/exports/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { email: 'a@nxtwave.co.in' } } }),
      },
    })
    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'emp-1' })
  })

  it('returns 400 when requestId is missing', async () => {
    const response = await GET(
      new Request('http://localhost:3000/api/exports/status')
    )
    expect(response.status).toBe(400)
  })

  it('returns 401 when there is no authenticated user', async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    const response = await GET(
      new Request('http://localhost:3000/api/exports/status?requestId=x')
    )
    expect(response.status).toBe(401)
  })

  it('returns 404 when the progress entry is not found or belongs to another employee', async () => {
    mocks.getExportProgress.mockReturnValue(null)

    const response = await GET(
      new Request('http://localhost:3000/api/exports/status?requestId=x')
    )
    expect(response.status).toBe(404)
  })

  it('returns the progress entry fields on success', async () => {
    mocks.getExportProgress.mockReturnValue({
      employeeId: 'emp-1',
      status: 'streaming',
      rowsSent: 12,
      estimatedTotalRows: 100,
      errorMessage: null,
      updatedAt: Date.now(),
    })

    const response = await GET(
      new Request('http://localhost:3000/api/exports/status?requestId=x')
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'streaming',
      rowsSent: 12,
      estimatedTotalRows: 100,
      errorMessage: null,
    })
    expect(mocks.getExportProgress).toHaveBeenCalledWith('x', 'emp-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/exports/status/__tests__/route.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/api/exports/status/route.ts`:

```ts
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { getExportProgress } from '@/lib/utils/export-progress-registry'

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const requestId = url.searchParams.get('requestId')

  if (!requestId) {
    return Response.json({ error: 'requestId is required.' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return Response.json({ error: 'Unauthorized request.' }, { status: 401 })
  }

  const employee = await getEmployeeByEmail(supabase, user.email)

  if (!employee) {
    return Response.json({ error: 'Not found.' }, { status: 404 })
  }

  const entry = getExportProgress(requestId, employee.id)

  if (!entry) {
    return Response.json({ error: 'Not found.' }, { status: 404 })
  }

  return Response.json({
    status: entry.status,
    rowsSent: entry.rowsSent,
    estimatedTotalRows: entry.estimatedTotalRows,
    errorMessage: entry.errorMessage,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/exports/status/__tests__/route.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/exports/status/route.ts src/app/api/exports/status/__tests__/route.test.ts
git commit -m "feat(export): add GET /api/exports/status polling endpoint"
```

---

### Task 6: New client component — `CsvExportButton`

**Files:**

- Create: `src/components/ui/csv-export-button.tsx`
- Test: `src/components/ui/__tests__/csv-export-button.test.tsx`

Replaces the raw-anchor-click + fake-progress pattern in `csv-export-actions.tsx` / `approved-history-export-actions.tsx` (deleted in Phase 5 once every route no longer references them).

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/__tests__/csv-export-button.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'

import { mswServer } from '@/test/msw/server'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import { toast } from 'sonner'
import { CsvExportButton } from '@/components/ui/csv-export-button'

describe('CsvExportButton', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    vi.useFakeTimers()
  })

  afterEach(() => {
    clickSpy.mockRestore()
    vi.useRealTimers()
  })

  it('renders the idle label', () => {
    render(
      <CsvExportButton
        exportType="my-claims"
        href="/claims/export?claimStatus=approved"
        label="Export CSV"
      />
    )

    expect(screen.getByRole('button', { name: 'Export CSV' })).not.toBeNull()
  })

  it('posts to /api/exports/start with the export type and query, then downloads with the returned requestId', async () => {
    let capturedBody: unknown = null

    mswServer.use(
      http.post('*/api/exports/start', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ requestId: 'req-1' })
      }),
      http.get('*/api/exports/status', () =>
        HttpResponse.json({
          status: 'streaming',
          rowsSent: 0,
          estimatedTotalRows: 10,
          errorMessage: null,
        })
      )
    )

    render(
      <CsvExportButton
        exportType="my-claims"
        href="/claims/export?claimStatus=approved"
        label="Export CSV"
      />
    )

    await act(async () => {
      screen.getByRole('button', { name: 'Export CSV' }).click()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(capturedBody).toEqual({
      exportType: 'my-claims',
      query: '?claimStatus=approved',
    })
    expect(clickSpy).toHaveBeenCalledTimes(1)

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.href).toContain('claimStatus=approved')
    expect(anchor.href).toContain('requestId=req-1')
  })

  it('shows an error toast and never downloads when the preflight fails', async () => {
    mswServer.use(
      http.post('*/api/exports/start', () =>
        HttpResponse.json(
          { error: 'Finance access is required.' },
          { status: 403 }
        )
      )
    )

    render(
      <CsvExportButton
        exportType="finance-history"
        href="/finance/export"
        label="Export CSV"
      />
    )

    await act(async () => {
      screen.getByRole('button', { name: 'Export CSV' }).click()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(toast.error).toHaveBeenCalledWith('Finance access is required.')
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('updates progress from streaming polls, then resets after done', async () => {
    let pollCount = 0

    mswServer.use(
      http.post('*/api/exports/start', () =>
        HttpResponse.json({ requestId: 'req-2' })
      ),
      http.get('*/api/exports/status', () => {
        pollCount += 1
        if (pollCount === 1) {
          return HttpResponse.json({
            status: 'streaming',
            rowsSent: 5,
            estimatedTotalRows: 10,
            errorMessage: null,
          })
        }
        return HttpResponse.json({
          status: 'done',
          rowsSent: 10,
          estimatedTotalRows: 10,
          errorMessage: null,
        })
      })
    )

    render(
      <CsvExportButton
        exportType="my-claims"
        href="/claims/export"
        label="Export CSV"
      />
    )

    await act(async () => {
      screen.getByRole('button', { name: 'Export CSV' }).click()
      await vi.advanceTimersByTimeAsync(0)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750)
    })
    expect(screen.getByRole('button').textContent).toContain('Exporting 50%')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750)
    })
    expect(screen.getByRole('button').textContent).toContain('Done')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(screen.getByRole('button').textContent).toContain('Export CSV')
  })

  it('shows the incomplete-file toast and resets when polling reports an error', async () => {
    mswServer.use(
      http.post('*/api/exports/start', () =>
        HttpResponse.json({ requestId: 'req-3' })
      ),
      http.get('*/api/exports/status', () =>
        HttpResponse.json({
          status: 'error',
          rowsSent: 3,
          estimatedTotalRows: 10,
          errorMessage: 'DB connection lost.',
        })
      )
    )

    render(
      <CsvExportButton
        exportType="my-claims"
        href="/claims/export"
        label="Export CSV"
      />
    )

    await act(async () => {
      screen.getByRole('button', { name: 'Export CSV' }).click()
      await vi.advanceTimersByTimeAsync(0)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750)
    })

    expect(toast.error).toHaveBeenCalledWith(
      'Export failed partway through — the downloaded file may be incomplete. Please delete it and retry.'
    )
    expect(screen.getByRole('button').textContent).toContain('Export CSV')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/__tests__/csv-export-button.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/ui/csv-export-button.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

const POLL_INTERVAL_MS = 750
const POLL_TIMEOUT_MS = 10 * 60 * 1000
const DONE_RESET_DELAY_MS = 1200

type ButtonState = 'idle' | 'starting' | 'exporting' | 'done'

type StartResponse = { requestId: string } | { error: string }

type StatusResponse =
  | {
      status: 'streaming' | 'done' | 'error'
      rowsSent: number
      estimatedTotalRows: number | null
      errorMessage: string | null
    }
  | { error: string }

export type CsvExportButtonProps = {
  exportType: string
  href: string
  label: string
  className?: string
}

function mergeClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

function triggerNativeDownload(href: string) {
  const link = document.createElement('a')
  link.href = href
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
}

export function CsvExportButton({
  exportType,
  href,
  label,
  className,
}: CsvExportButtonProps) {
  const [state, setState] = useState<ButtonState>('idle')
  const [percent, setPercent] = useState<number | null>(null)

  const pollTimerRef = useRef<number | null>(null)
  const resetTimerRef = useRef<number | null>(null)
  const pollStartedAtRef = useRef<number>(0)

  useEffect(() => {
    return () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current)
      }
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  function stopPolling() {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  function scheduleReset() {
    resetTimerRef.current = window.setTimeout(() => {
      setState('idle')
      setPercent(null)
      resetTimerRef.current = null
    }, DONE_RESET_DELAY_MS)
  }

  async function pollStatus(requestId: string) {
    if (Date.now() - pollStartedAtRef.current > POLL_TIMEOUT_MS) {
      stopPolling()
      setState('idle')
      setPercent(null)
      return
    }

    let data: StatusResponse

    try {
      const response = await fetch(
        `/api/exports/status?requestId=${encodeURIComponent(requestId)}`
      )
      data = await response.json()

      if (!response.ok || 'error' in data) {
        stopPolling()
        setState('idle')
        setPercent(null)
        return
      }
    } catch {
      // Transient network hiccup while polling — keep trying until timeout.
      return
    }

    if (data.status === 'streaming') {
      setState('exporting')
      setPercent(
        data.estimatedTotalRows
          ? Math.min(
              99,
              Math.round((data.rowsSent / data.estimatedTotalRows) * 100)
            )
          : null
      )
      return
    }

    if (data.status === 'done') {
      stopPolling()
      setState('done')
      setPercent(100)
      scheduleReset()
      return
    }

    stopPolling()
    setState('idle')
    setPercent(null)
    toast.error(
      'Export failed partway through — the downloaded file may be incomplete. Please delete it and retry.'
    )
  }

  async function handleClick() {
    if (state !== 'idle') {
      return
    }

    setState('starting')

    const url = new URL(href, window.location.origin)

    let data: StartResponse

    try {
      const response = await fetch('/api/exports/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportType, query: url.search }),
      })
      data = await response.json()

      if (!response.ok || 'error' in data) {
        setState('idle')
        toast.error('error' in data ? data.error : 'Unable to start export.')
        return
      }
    } catch {
      setState('idle')
      toast.error('Unable to start export.')
      return
    }

    const { requestId } = data
    url.searchParams.set('requestId', requestId)
    triggerNativeDownload(url.toString())

    setState('exporting')
    setPercent(0)
    pollStartedAtRef.current = Date.now()
    pollTimerRef.current = window.setInterval(() => {
      void pollStatus(requestId)
    }, POLL_INTERVAL_MS)
  }

  const isBusy = state !== 'idle'
  const displayLabel =
    state === 'starting'
      ? 'Starting…'
      : state === 'exporting'
        ? percent !== null
          ? `Exporting ${percent}%`
          : 'Exporting…'
        : state === 'done'
          ? 'Done'
          : label

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isBusy}
      aria-busy={isBusy}
      className={mergeClassNames(
        'inline-flex items-center gap-1.5 border border-border bg-surface px-3 py-2.5 text-xs font-medium shadow-xs transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70',
        className
      )}
    >
      <Download className="size-3.5" />
      {displayLabel}
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/__tests__/csv-export-button.test.tsx`
Expected: PASS (all 5 tests). If the "updates progress" test is flaky on timer/microtask ordering, adjust the `vi.advanceTimersByTimeAsync` calls to include an extra `await vi.advanceTimersByTimeAsync(0)` after each — this is expected tuning, not a design problem.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/csv-export-button.tsx src/components/ui/__tests__/csv-export-button.test.tsx
git commit -m "feat(export): add CsvExportButton (native download + preflight + progress polling)"
```

---

### Task 7: Migrate `claims/export/route.ts`

**Files:**

- Modify: `src/app/(app)/claims/export/route.ts`
- Modify: `src/app/(app)/claims/export/__tests__/route.test.ts`

Removes the `mode=page|all` split (single unified export), uses the shared context resolver from Task 2, and streams via `runCsvExport`.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/app/(app)/claims/export/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveMyClaimsExportContext: vi.fn(),
  getMyClaimsPaginated: vi.fn(),
  runCsvExport: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/claims/server/claims-export-context', () => ({
  resolveMyClaimsExportContext: mocks.resolveMyClaimsExportContext,
}))

vi.mock('@/features/claims/data/queries', () => ({
  getMyClaimsPaginated: mocks.getMyClaimsPaginated,
}))

vi.mock('@/features/claims/utils/filters', () => ({
  MY_CLAIMS_CSV_HEADERS: ['Claim ID'],
  mapMyClaimToCsvRow: vi.fn((row: { claim_number: string }) => [
    row.claim_number,
  ]),
}))

vi.mock('@/lib/utils/run-csv-export', () => ({
  runCsvExport: mocks.runCsvExport,
}))

import { GET, POST } from '@/app/(app)/claims/export/route'

describe('claims export route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'employee@nxtwave.co.in' } },
        }),
      },
    })

    mocks.resolveMyClaimsExportContext.mockResolvedValue({
      ok: true,
      context: {
        employee: { id: 'emp-1' },
        filters: {
          claimStatus: null,
          workLocation: null,
          claimDateFrom: null,
          claimDateTo: null,
        },
      },
    })

    mocks.runCsvExport.mockReturnValue(
      new Response('Claim ID\nCLAIM-260306-001', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('streams the export via runCsvExport with the resolved employee/filters', async () => {
    const response = await GET(
      new Request('http://localhost:3000/claims/export?requestId=req-1')
    )

    expect(response.status).toBe(200)
    expect(mocks.runCsvExport).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: ['Claim ID'],
        filename: expect.stringContaining('my-claims-'),
      }),
      'req-1'
    )

    const [recipe] = mocks.runCsvExport.mock.calls[0]
    await recipe.fetchPage('cursor-a', 500)
    expect(mocks.getMyClaimsPaginated).toHaveBeenCalledWith(
      expect.anything(),
      'emp-1',
      'cursor-a',
      500,
      expect.anything()
    )
  })

  it('passes null requestId to runCsvExport when the query param is absent', async () => {
    await GET(new Request('http://localhost:3000/claims/export'))

    expect(mocks.runCsvExport).toHaveBeenCalledWith(expect.anything(), null)
  })

  it('returns 401 for unauthenticated requests, with Content-Disposition set', async () => {
    mocks.resolveMyClaimsExportContext.mockResolvedValue({
      ok: false,
      status: 401,
      message: 'Unauthorized request.',
    })

    const response = await GET(
      new Request('http://localhost:3000/claims/export')
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
    expect(await response.text()).toBe('Unauthorized request.')
  })

  it('returns 403 when the context resolver rejects the designation', async () => {
    mocks.resolveMyClaimsExportContext.mockResolvedValue({
      ok: false,
      status: 403,
      message: 'CSV export is not available for your designation.',
    })

    const response = await GET(
      new Request('http://localhost:3000/claims/export')
    )

    expect(response.status).toBe(403)
  })

  it('supports POST requests and preserves the same behavior', async () => {
    const response = await POST(
      new Request('http://localhost:3000/claims/export', { method: 'POST' })
    )

    expect(response.status).toBe(200)
    expect(mocks.runCsvExport).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/(app)/claims/export/__tests__/route.test.ts`
Expected: FAIL — route still uses the old mode-based implementation.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/app/(app)/claims/export/route.ts`:

```ts
import { resolveMyClaimsExportContext } from '@/features/claims/server/claims-export-context'
import { getMyClaimsPaginated } from '@/features/claims/data/queries'
import {
  MY_CLAIMS_CSV_HEADERS,
  mapMyClaimToCsvRow,
} from '@/features/claims/utils/filters'
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

  const resolved = await resolveMyClaimsExportContext(
    supabase,
    user?.email ? { email: user.email } : null,
    url.searchParams
  )

  if (!resolved.ok) {
    return createCsvExportErrorResponse(resolved.message, resolved.status)
  }

  const { employee, filters } = resolved.context
  const filename = buildDatedCsvFilename('my-claims')

  return runCsvExport(
    {
      fetchPage: (cursor, limit) =>
        getMyClaimsPaginated(supabase, employee.id, cursor, limit, filters),
      headers: MY_CLAIMS_CSV_HEADERS,
      mapRow: mapMyClaimToCsvRow,
      filename,
    },
    requestId
  )
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
```

Note: `buildDatedCsvFilename` currently takes a `mode` argument (`'page' | 'all'`) — this call site now needs it to work without a mode. Update `src/lib/utils/export-route.ts`'s `buildDatedCsvFilename` to accept an optional mode (default omits the mode segment), keeping the function backward compatible for the not-yet-migrated routes still calling it with a mode in Phases 3–4:

```ts
export function buildDatedCsvFilename(
  prefix: string,
  mode?: ExportMode
): string {
  const dateStamp = new Date().toISOString().slice(0, 10)
  return mode
    ? `${prefix}-${mode}-${dateStamp}.csv`
    : `${prefix}-${dateStamp}.csv`
}
```

Update the existing `export-route.test.ts` filename test to also cover the no-mode call (add this case alongside the existing one, do not remove the existing one since `finance/export` and others still call it with a mode until Phase 3/4 migrate them):

```ts
it('builds a dated CSV filename without a mode segment when mode is omitted', () => {
  const filename = buildDatedCsvFilename('my-claims')
  expect(filename).toMatch(/^my-claims-\d{4}-\d{2}-\d{2}\.csv$/)
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/(app)/claims/export/__tests__/route.test.ts src/lib/utils/__tests__/export-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/claims/export/route.ts src/app/\(app\)/claims/export/__tests__/route.test.ts src/lib/utils/export-route.ts src/lib/utils/__tests__/export-route.test.ts
git commit -m "feat(claims): migrate claims/export onto the shared CSV export pipeline"
```

---

### Task 8: Update the Claims filters bar and page to use `CsvExportButton`

**Files:**

- Modify: `src/features/claims/components/claims-filters-bar.tsx`
- Modify: `src/app/(app)/claims/page.tsx`

No dedicated test for these two files today (none exists currently); verify manually per Step 3.

- [ ] **Step 1: Update `claims-filters-bar.tsx`**

In `src/features/claims/components/claims-filters-bar.tsx`, replace the import and prop type:

```ts
import { CsvExportButton } from '@/components/ui/csv-export-button'
```

Replace the props type (drop `exportCurrentPageHref`, rename `exportAllHref` to `exportHref`):

```ts
type ClaimsFiltersBarProps = {
  filters: MyClaimsFilters
  statusCatalog: ClaimStatusCatalogItem[]
  workLocationOptions: WorkLocationOption[]
  exportHref: string
  canExportCsv: boolean
  validationError?: string | null
}
```

Update the destructured props and the render:

```ts
export function ClaimsFiltersBar({
  filters,
  statusCatalog,
  workLocationOptions,
  exportHref,
  canExportCsv,
  validationError,
}: ClaimsFiltersBarProps) {
```

```tsx
{
  canExportCsv ? (
    <CsvExportButton
      exportType="my-claims"
      href={exportHref}
      label="Export CSV"
      className="rounded-xl"
    />
  ) : null
}
```

- [ ] **Step 2: Update `claims/page.tsx`**

In `src/app/(app)/claims/page.tsx`, replace the CSV-params block (currently building `currentPageCsvParams` and `exportCurrentPageHref` in addition to `allRowsCsvParams`/`exportAllHref`):

```ts
const exportCsvParams = addMyClaimsFiltersToParams(
  new URLSearchParams(),
  normalizedFilters
)

const exportHref = `/claims/export?${exportCsvParams.toString()}`
const canExportCsv = canDownloadClaimsCsv(
  employee.designations?.designation_name
)
```

Update the `ClaimsFiltersBar` usage:

```tsx
<ClaimsFiltersBar
  filters={filterFormValues}
  statusCatalog={statusCatalog}
  workLocationOptions={workLocationOptions}
  exportHref={exportHref}
  canExportCsv={canExportCsv}
  validationError={filterValidationError}
/>
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, sign in as an employee who can access `/claims`, click "Export CSV". Confirm: the button shows "Starting…" then "Exporting NN%" then "Done" briefly, a CSV file downloads, and the browser's Network tab (filter set to "All", not just Fetch/XHR) shows the `POST /api/exports/start` call followed by a `GET /claims/export?...&requestId=...` download and repeated `GET /api/exports/status` polls.

Also confirm the regression check: temporarily revoke claims access for the test account (or stop the dev server's DB connection) and click Export — verify a toast appears and the app does **not** navigate away.

- [ ] **Step 4: Commit**

```bash
git add src/features/claims/components/claims-filters-bar.tsx "src/app/(app)/claims/page.tsx"
git commit -m "feat(claims): wire claims page onto CsvExportButton, drop page/all mode split"
```

---

### Task 9: Migrate `approvals/export/route.ts`

**Files:**

- Modify: `src/app/(app)/approvals/export/route.ts`
- Modify: `src/app/(app)/approvals/export/__tests__/route.test.ts`

Same shape as Task 7.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/app/(app)/approvals/export/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveApprovalHistoryExportContext: vi.fn(),
  getFilteredApprovalHistoryPaginated: vi.fn(),
  runCsvExport: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/approvals/server/approval-history-export-context', () => ({
  resolveApprovalHistoryExportContext:
    mocks.resolveApprovalHistoryExportContext,
}))

vi.mock('@/features/approvals/data/queries', () => ({
  getFilteredApprovalHistoryPaginated:
    mocks.getFilteredApprovalHistoryPaginated,
}))

vi.mock('@/features/approvals/utils/history-filters', () => ({
  APPROVAL_HISTORY_CSV_HEADERS: ['Claim Number'],
  mapApprovalHistoryToCsvRow: vi.fn((row: { claimNumber: string }) => [
    row.claimNumber,
  ]),
}))

vi.mock('@/lib/utils/run-csv-export', () => ({
  runCsvExport: mocks.runCsvExport,
}))

import { GET, POST } from '@/app/(app)/approvals/export/route'

describe('approvals export route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'approver@nxtwave.co.in' } },
        }),
      },
    })

    mocks.resolveApprovalHistoryExportContext.mockResolvedValue({
      ok: true,
      context: {
        employee: { id: 'emp-1' },
        filters: {
          claimStatus: null,
          employeeName: null,
          claimDateFrom: null,
          claimDateTo: null,
          amountOperator: 'lte',
          amountValue: null,
          locationType: null,
          claimDateSort: 'desc',
          hodApprovedFrom: null,
          hodApprovedTo: null,
          financeApprovedFrom: null,
          financeApprovedTo: null,
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

  it('streams the export via runCsvExport with the resolved filters', async () => {
    const response = await GET(
      new Request('http://localhost:3000/approvals/export?requestId=req-1')
    )

    expect(response.status).toBe(200)
    expect(mocks.runCsvExport).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: ['Claim Number'],
        filename: expect.stringContaining('approvals-history-'),
      }),
      'req-1'
    )

    const [recipe] = mocks.runCsvExport.mock.calls[0]
    await recipe.fetchPage('cursor-a', 500)
    expect(mocks.getFilteredApprovalHistoryPaginated).toHaveBeenCalledWith(
      expect.anything(),
      'cursor-a',
      500,
      expect.anything()
    )
  })

  it('returns 401 with Content-Disposition set for unauthenticated requests', async () => {
    mocks.resolveApprovalHistoryExportContext.mockResolvedValue({
      ok: false,
      status: 401,
      message: 'Unauthorized request.',
    })

    const response = await GET(
      new Request('http://localhost:3000/approvals/export')
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
  })

  it('returns 403 when access is denied', async () => {
    mocks.resolveApprovalHistoryExportContext.mockResolvedValue({
      ok: false,
      status: 403,
      message: 'Access denied.',
    })

    const response = await GET(
      new Request('http://localhost:3000/approvals/export')
    )

    expect(response.status).toBe(403)
  })

  it('supports POST requests', async () => {
    const response = await POST(
      new Request('http://localhost:3000/approvals/export', {
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/(app)/approvals/export/__tests__/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/app/(app)/approvals/export/route.ts`:

```ts
import { resolveApprovalHistoryExportContext } from '@/features/approvals/server/approval-history-export-context'
import { getFilteredApprovalHistoryPaginated } from '@/features/approvals/data/queries'
import {
  APPROVAL_HISTORY_CSV_HEADERS,
  mapApprovalHistoryToCsvRow,
} from '@/features/approvals/utils/history-filters'
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

  const resolved = await resolveApprovalHistoryExportContext(
    supabase,
    user?.email ? { email: user.email } : null,
    url.searchParams
  )

  if (!resolved.ok) {
    return createCsvExportErrorResponse(resolved.message, resolved.status)
  }

  const { filters } = resolved.context
  const filename = buildDatedCsvFilename('approvals-history')

  return runCsvExport(
    {
      fetchPage: (cursor, limit) =>
        getFilteredApprovalHistoryPaginated(supabase, cursor, limit, filters),
      headers: APPROVAL_HISTORY_CSV_HEADERS,
      mapRow: mapApprovalHistoryToCsvRow,
      filename,
    },
    requestId
  )
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/(app)/approvals/export/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/approvals/export/route.ts" "src/app/(app)/approvals/export/__tests__/route.test.ts"
git commit -m "feat(approvals): migrate approvals/export onto the shared CSV export pipeline"
```

---

### Task 10: Update the Approvals filters bar and page to use `CsvExportButton`

**Files:**

- Modify: `src/features/approvals/components/approval-filters-bar.tsx`
- Modify: `src/app/(app)/approvals/page.tsx`

- [ ] **Step 1: Update `approval-filters-bar.tsx`**

Replace the import:

```ts
import { CsvExportButton } from '@/components/ui/csv-export-button'
```

Replace the props type (drop `exportCurrentPageHref`, rename `exportAllHref` to `exportHref`):

```ts
type ApprovalFiltersBarProps = {
  filters: ApprovalHistoryFilters
  statusCatalog: ClaimStatusCatalogItem[]
  validationError?: string | null
  exportHref: string
}
```

Update the destructured props:

```ts
export function ApprovalFiltersBar({
  filters,
  statusCatalog,
  validationError,
  exportHref,
}: ApprovalFiltersBarProps) {
```

Replace the render call:

```tsx
<CsvExportButton
  exportType="approval-history"
  href={exportHref}
  label="Export CSV"
  className="rounded-md"
/>
```

- [ ] **Step 2: Update `approvals/page.tsx`**

Replace the CSV-params block (currently building `currentPageCsvParams`/`exportCurrentPageHref` in addition to `allRowsCsvParams`/`exportAllHref`):

```ts
const exportCsvParams = addApprovalFiltersToParams(
  new URLSearchParams(),
  normalizedFilters
)

const exportHref = `/approvals/export?${exportCsvParams.toString()}`
```

Update the `ApprovalFiltersBar` usage:

```tsx
<ApprovalFiltersBar
  key={toSortedQueryString(
    addApprovalFiltersToParams(new URLSearchParams(), normalizedFilters)
  )}
  filters={normalizedFilters}
  statusCatalog={statusCatalog}
  validationError={filterValidationError}
  exportHref={exportHref}
/>
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, sign in as an approver, visit `/approvals`, click "Export CSV" in the Approval History section. Confirm the same behavior verified in Task 8 Step 3 (real progress, toast on failure, no navigation).

- [ ] **Step 4: Commit**

```bash
git add src/features/approvals/components/approval-filters-bar.tsx "src/app/(app)/approvals/page.tsx"
git commit -m "feat(approvals): wire approvals page onto CsvExportButton, drop page/all mode split"
```

---

## Phase 2 Completion Checklist

- [ ] `/api/exports/start` resolves `my-claims` and `approval-history`, returns `{requestId}` or `{error}`.
- [ ] `/api/exports/status` returns scoped progress by `employeeId`, 404s for unknown/foreign requestId.
- [ ] `CsvExportButton` replaces the old anchor-click pattern for Claims and Approvals: real progress, toast-based errors, no page navigation on failure.
- [ ] `claims/export` and `approvals/export` no longer support `mode=page|all` — single unified export per click.
- [ ] All existing and new tests pass: `npx vitest run`.
- [ ] `streaming-export.ts`, `csv-export-actions.tsx`, and `approved-history-export-actions.tsx` still exist and are still used by the not-yet-migrated routes (finance/export, finance/pending-export, bc-expense-export, payment-journals-export) — do not delete them yet.

**Next:** Phase 3 (`docs/superpowers/plans/2026-07-01-csv-export-rebuild-phase3-finance.md`) migrates `finance/export` and `finance/pending-export`, extending the `/api/exports/start` handler map with `finance-history` and `finance-pending`.
