# CSV Export Rebuild — Phase 4: BC-Expense + Payment Journals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the two accounting exports. This is the phase that closes the original "why are ids returned and sent back to the DB in a POST" complaint: `bc-expense-export` drops from 3 queries/chunk (history page + wasted available-actions + claim items) to 2 (lean history page + claim items), and both routes stop using their own ad-hoc local `createStreamingCsvResponse` copies.

**Prerequisite:** Phases 1–3 complete.

**Architecture:** See `docs/superpowers/specs/2026-07-01-csv-export-rebuild-design.md`. Same context-resolver + preflight pattern as prior phases, extended with the export-profile/mapping validation these two routes need before they can run at all.

**Tech Stack:** Next.js route handlers, Supabase JS client, React, Vitest.

---

### Task 1: BC-Expense export context + preflight resolver

**Files:**

- Create: `src/features/finance/server/bc-expense-export-context.ts`
- Test: `src/features/finance/server/__tests__/bc-expense-export-context.test.ts`

Note: unlike `finance-history-export-context.ts` (Phase 3), this resolver does **not** force-null `claimStatus` — the existing `bc-expense-export/route.ts` never applied that override, and this migration preserves that exact existing behavior (verified by the existing route test's "keeps status scope unset" cases, carried forward into Task 3 below).

- [ ] **Step 1: Write the failing test**

Create `src/features/finance/server/__tests__/bc-expense-export-context.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEmployeeByEmail: vi.fn(),
  isFinanceTeamMember: vi.fn(),
  getFinanceExportProfileByCode: vi.fn(),
  getActiveExpenseTypeAccountMappings: vi.fn(),
  getFinanceHistoryTotalCount: vi.fn(),
  formatDate: vi.fn(),
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
}))

vi.mock('@/features/finance/permissions', () => ({
  isFinanceTeamMember: mocks.isFinanceTeamMember,
}))

vi.mock('@/lib/services/finance-export-config-service', () => ({
  getFinanceExportProfileByCode: mocks.getFinanceExportProfileByCode,
  getActiveExpenseTypeAccountMappings:
    mocks.getActiveExpenseTypeAccountMappings,
}))

vi.mock('@/features/finance/data/queries', () => ({
  getFinanceHistoryTotalCount: mocks.getFinanceHistoryTotalCount,
}))

vi.mock('@/lib/utils/date', () => ({
  formatDate: mocks.formatDate,
}))

import {
  resolveBcExpenseExportContext,
  resolveBcExpenseExportPreflight,
} from '@/features/finance/server/bc-expense-export-context'

const supabase = {} as import('@supabase/supabase-js').SupabaseClient

const PROFILE = {
  profile_code: 'BC_EXPENSE',
  account_type: 'Employee',
  employee_transaction_type: 'ADVANCE',
  bal_account_type: 'G/L Account',
  default_document_no: '',
  program_code: 'NIAT',
  sub_product_code: 'NIAT362',
  responsible_dep_code: 'PRE-SALES',
  beneficiary_dep_code: 'PRE-SALES',
  is_active: true,
}

describe('resolveBcExpenseExportContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'emp-1' })
    mocks.isFinanceTeamMember.mockResolvedValue(true)
    mocks.getFinanceExportProfileByCode.mockResolvedValue(PROFILE)
    mocks.getActiveExpenseTypeAccountMappings.mockResolvedValue([
      { expense_item_type: 'food', bal_account_no: '503063', is_active: true },
      { expense_item_type: 'fuel', bal_account_no: '535002', is_active: true },
    ])
    mocks.formatDate.mockReturnValue('15/04/2026')
  })

  it('returns 401 when there is no authenticated user', async () => {
    const result = await resolveBcExpenseExportContext(
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

    const result = await resolveBcExpenseExportContext(
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

  it('returns 400 when the export profile is missing', async () => {
    mocks.getFinanceExportProfileByCode.mockResolvedValue(null)

    const result = await resolveBcExpenseExportContext(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )
    expect(result).toEqual({
      ok: false,
      status: 400,
      message: 'BC export profile is not configured.',
    })
  })

  it('returns 400 when there are no active expense type mappings', async () => {
    mocks.getActiveExpenseTypeAccountMappings.mockResolvedValue([])

    const result = await resolveBcExpenseExportContext(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )
    expect(result).toEqual({
      ok: false,
      status: 400,
      message: 'Expense type account mappings are not configured.',
    })
  })

  it('does not force-null claimStatus (preserves existing bc-expense behavior)', async () => {
    const result = await resolveBcExpenseExportContext(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams({ actionFilter: 'finance_rejected' })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.context.filters.claimStatus).toBeNull()
    expect(result.context.filters.actionFilter).toBe('finance_rejected')
  })

  it('builds balAccountNoByItemType and mappedExpenseItemTypes from the active mappings', async () => {
    const result = await resolveBcExpenseExportContext(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.context.balAccountNoByItemType.get('food')).toBe('503063')
    expect(result.context.mappedExpenseItemTypes.sort()).toEqual([
      'food',
      'fuel',
    ])
    expect(result.context.postingDate).toBe('15/04/2026')
  })
})

describe('resolveBcExpenseExportPreflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'emp-1' })
    mocks.isFinanceTeamMember.mockResolvedValue(true)
    mocks.getFinanceExportProfileByCode.mockResolvedValue(PROFILE)
    mocks.getActiveExpenseTypeAccountMappings.mockResolvedValue([
      { expense_item_type: 'food', bal_account_no: '503063', is_active: true },
    ])
    mocks.formatDate.mockReturnValue('15/04/2026')
    mocks.getFinanceHistoryTotalCount.mockResolvedValue(60)
  })

  it('returns employeeId and an approximate estimated total (history-row proxy)', async () => {
    const result = await resolveBcExpenseExportPreflight(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result).toEqual({
      ok: true,
      employeeId: 'emp-1',
      estimatedTotalRows: 60,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/finance/server/__tests__/bc-expense-export-context.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/finance/server/bc-expense-export-context.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

import { isFinanceTeamMember } from '@/features/finance/permissions'
import {
  getEmployeeByEmail,
  type EmployeeRow,
} from '@/lib/services/employee-service'
import {
  getActiveExpenseTypeAccountMappings,
  getFinanceExportProfileByCode,
  type FinanceExportProfile,
} from '@/lib/services/finance-export-config-service'
import { getFinanceHistoryTotalCount } from '@/features/finance/data/queries'
import {
  normalizeFinanceFilters,
  type FinanceFilters,
} from '@/features/finance/utils/filters'
import { formatDate } from '@/lib/utils/date'
import type { ExportPreflightResult } from '@/lib/utils/export-preflight'

const BC_EXPORT_PROFILE_CODE = 'BC_EXPENSE'

export type BcExpenseExportContext = {
  employee: EmployeeRow
  filters: FinanceFilters
  exportProfile: FinanceExportProfile
  balAccountNoByItemType: Map<string, string>
  mappedExpenseItemTypes: string[]
  postingDate: string
}

export type BcExpenseExportContextResult =
  | { ok: true; context: BcExpenseExportContext }
  | { ok: false; status: number; message: string }

function buildBcExpenseExportFilters(
  searchParams: URLSearchParams
): FinanceFilters {
  return normalizeFinanceFilters({
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
}

export async function resolveBcExpenseExportContext(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<BcExpenseExportContextResult> {
  if (!user?.email) {
    return { ok: false, status: 401, message: 'Unauthorized request.' }
  }

  const employee = await getEmployeeByEmail(supabase, user.email)

  if (!employee || !(await isFinanceTeamMember(supabase, employee))) {
    return { ok: false, status: 403, message: 'Finance access is required.' }
  }

  const [exportProfile, mappings] = await Promise.all([
    getFinanceExportProfileByCode(supabase, BC_EXPORT_PROFILE_CODE),
    getActiveExpenseTypeAccountMappings(supabase),
  ])

  if (!exportProfile) {
    return {
      ok: false,
      status: 400,
      message: 'BC export profile is not configured.',
    }
  }

  if (mappings.length === 0) {
    return {
      ok: false,
      status: 400,
      message: 'Expense type account mappings are not configured.',
    }
  }

  const balAccountNoByItemType = new Map(
    mappings.map((row) => [row.expense_item_type, row.bal_account_no])
  )

  return {
    ok: true,
    context: {
      employee,
      filters: buildBcExpenseExportFilters(searchParams),
      exportProfile,
      balAccountNoByItemType,
      mappedExpenseItemTypes: [...balAccountNoByItemType.keys()],
      postingDate: formatDate(new Date()),
    },
  }
}

export async function resolveBcExpenseExportPreflight(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<ExportPreflightResult> {
  const resolved = await resolveBcExpenseExportContext(
    supabase,
    user,
    searchParams
  )

  if (!resolved.ok) {
    return resolved
  }

  const { employee, filters } = resolved.context
  // Approximate: counts source history rows, not final CSV lines (BC-Expense
  // can emit 0, 1, or several CSV rows per history row via item-splitting).
  // See design spec's Client section for how the 99%-until-done cap absorbs this.
  const estimatedTotalRows = await getFinanceHistoryTotalCount(
    supabase,
    filters
  )

  return { ok: true, employeeId: employee.id, estimatedTotalRows }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/finance/server/__tests__/bc-expense-export-context.test.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/finance/server/bc-expense-export-context.ts src/features/finance/server/__tests__/bc-expense-export-context.test.ts
git commit -m "feat(finance): extract shared bc-expense export context + preflight resolver"
```

---

### Task 2: Payment Journals export context + preflight resolver

**Files:**

- Create: `src/features/finance/server/payment-journals-export-context.ts`
- Test: `src/features/finance/server/__tests__/payment-journals-export-context.test.ts`

No count query here — matches the spec's "single fast call, indeterminate spinner" for this export type.

- [ ] **Step 1: Write the failing test**

Create `src/features/finance/server/__tests__/payment-journals-export-context.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEmployeeByEmail: vi.fn(),
  isFinanceTeamMember: vi.fn(),
  getFinanceExportProfileByCode: vi.fn(),
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
}))

vi.mock('@/features/finance/permissions', () => ({
  isFinanceTeamMember: mocks.isFinanceTeamMember,
}))

vi.mock('@/lib/services/finance-export-config-service', () => ({
  getFinanceExportProfileByCode: mocks.getFinanceExportProfileByCode,
}))

import {
  resolvePaymentJournalsExportContext,
  resolvePaymentJournalsExportPreflight,
} from '@/features/finance/server/payment-journals-export-context'

const supabase = {} as import('@supabase/supabase-js').SupabaseClient

const PAYMENT_PROFILE = {
  profile_code: 'PAYMENT_JOURNALS',
  account_type: 'Employee',
  employee_transaction_type: 'ADVANCE',
  bal_account_type: 'Bank Account',
  default_document_no: '',
  program_code: 'NIAT',
  sub_product_code: 'NIAT362',
  responsible_dep_code: 'PRE-SALES',
  beneficiary_dep_code: 'PRE-SALES',
  document_type: 'Payment',
  cash_flow_options: 'Petty cash & Reimbursements',
  type_of_payment: '100% Payment after Service / Goods delivery',
  description: 'Reimbursements',
  payment_method_code: 'IMPS',
  bal_account_no: 'IDFC 2012',
  is_active: true,
}

describe('resolvePaymentJournalsExportContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'emp-1' })
    mocks.isFinanceTeamMember.mockResolvedValue(true)
    mocks.getFinanceExportProfileByCode.mockResolvedValue(PAYMENT_PROFILE)
  })

  it('returns 401 when there is no authenticated user', async () => {
    const result = await resolvePaymentJournalsExportContext(
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

    const result = await resolvePaymentJournalsExportContext(
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

  it('returns 400 when the export profile is missing', async () => {
    mocks.getFinanceExportProfileByCode.mockResolvedValue(null)

    const result = await resolvePaymentJournalsExportContext(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )
    expect(result).toEqual({
      ok: false,
      status: 400,
      message: 'Payment Journals export profile is not configured.',
    })
  })

  it('resolves filters and defaults on success', async () => {
    const result = await resolvePaymentJournalsExportContext(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams({ actionFilter: 'finance_rejected' })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.context.filters.claimStatus).toBeNull()
    expect(result.context.filters.actionFilter).toBe('finance_rejected')
    expect(result.context.defaults.balAccountNo).toBe('IDFC 2012')
  })
})

describe('resolvePaymentJournalsExportPreflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'emp-1' })
    mocks.isFinanceTeamMember.mockResolvedValue(true)
    mocks.getFinanceExportProfileByCode.mockResolvedValue(PAYMENT_PROFILE)
  })

  it('returns employeeId with a null estimated total (no count query for this export)', async () => {
    const result = await resolvePaymentJournalsExportPreflight(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result).toEqual({
      ok: true,
      employeeId: 'emp-1',
      estimatedTotalRows: null,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/finance/server/__tests__/payment-journals-export-context.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/finance/server/payment-journals-export-context.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

import { isFinanceTeamMember } from '@/features/finance/permissions'
import {
  getEmployeeByEmail,
  type EmployeeRow,
} from '@/lib/services/employee-service'
import { getFinanceExportProfileByCode } from '@/lib/services/finance-export-config-service'
import {
  normalizeFinanceFilters,
  type FinanceFilters,
} from '@/features/finance/utils/filters'
import { resolvePaymentJournalsDefaults } from '@/features/finance/utils/payment-journals-export'
import type { ExportPreflightResult } from '@/lib/utils/export-preflight'

const PAYMENT_JOURNALS_EXPORT_PROFILE_CODE = 'PAYMENT_JOURNALS'

export type PaymentJournalsExportContext = {
  employee: EmployeeRow
  filters: FinanceFilters
  defaults: ReturnType<typeof resolvePaymentJournalsDefaults>
}

export type PaymentJournalsExportContextResult =
  | { ok: true; context: PaymentJournalsExportContext }
  | { ok: false; status: number; message: string }

function buildPaymentJournalsExportFilters(
  searchParams: URLSearchParams
): FinanceFilters {
  return normalizeFinanceFilters({
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
}

export async function resolvePaymentJournalsExportContext(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<PaymentJournalsExportContextResult> {
  if (!user?.email) {
    return { ok: false, status: 401, message: 'Unauthorized request.' }
  }

  const employee = await getEmployeeByEmail(supabase, user.email)

  if (!employee || !(await isFinanceTeamMember(supabase, employee))) {
    return { ok: false, status: 403, message: 'Finance access is required.' }
  }

  const profile = await getFinanceExportProfileByCode(
    supabase,
    PAYMENT_JOURNALS_EXPORT_PROFILE_CODE
  )

  if (!profile) {
    return {
      ok: false,
      status: 400,
      message: 'Payment Journals export profile is not configured.',
    }
  }

  return {
    ok: true,
    context: {
      employee,
      filters: buildPaymentJournalsExportFilters(searchParams),
      defaults: resolvePaymentJournalsDefaults(profile),
    },
  }
}

export async function resolvePaymentJournalsExportPreflight(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<ExportPreflightResult> {
  const resolved = await resolvePaymentJournalsExportContext(
    supabase,
    user,
    searchParams
  )

  if (!resolved.ok) {
    return resolved
  }

  return {
    ok: true,
    employeeId: resolved.context.employee.id,
    estimatedTotalRows: null,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/finance/server/__tests__/payment-journals-export-context.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/finance/server/payment-journals-export-context.ts src/features/finance/server/__tests__/payment-journals-export-context.test.ts
git commit -m "feat(finance): extract shared payment-journals export context + preflight resolver"
```

---

### Task 3: Register `bc-expense` and `payment-journals` in `/api/exports/start`

**Files:**

- Modify: `src/app/api/exports/start/route.ts`
- Modify: `src/app/api/exports/start/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Add two more hoisted mocks, two more `vi.mock` calls, and two more `it` cases to `src/app/api/exports/start/__tests__/route.test.ts`, following the exact pattern used for `finance-history`/`finance-pending` in Phase 3 Task 3:

```ts
  resolveBcExpenseExportPreflight: vi.fn(),
  resolvePaymentJournalsExportPreflight: vi.fn(),
```

```ts
vi.mock('@/features/finance/server/bc-expense-export-context', () => ({
  resolveBcExpenseExportPreflight: mocks.resolveBcExpenseExportPreflight,
}))

vi.mock('@/features/finance/server/payment-journals-export-context', () => ({
  resolvePaymentJournalsExportPreflight:
    mocks.resolvePaymentJournalsExportPreflight,
}))
```

```ts
it('routes bc-expense exports to the bc-expense preflight resolver', async () => {
  mocks.resolveBcExpenseExportPreflight.mockResolvedValue({
    ok: true,
    employeeId: 'emp-5',
    estimatedTotalRows: 30,
  })
  mocks.createExportProgress.mockReturnValue('req-bc')

  const response = await POST(
    new Request('http://localhost:3000/api/exports/start', {
      method: 'POST',
      body: JSON.stringify({ exportType: 'bc-expense', query: '' }),
    })
  )

  expect(response.status).toBe(200)
  expect(mocks.resolveBcExpenseExportPreflight).toHaveBeenCalledTimes(1)
})

it('routes payment-journals exports to the payment-journals preflight resolver', async () => {
  mocks.resolvePaymentJournalsExportPreflight.mockResolvedValue({
    ok: true,
    employeeId: 'emp-6',
    estimatedTotalRows: null,
  })
  mocks.createExportProgress.mockReturnValue('req-pj')

  const response = await POST(
    new Request('http://localhost:3000/api/exports/start', {
      method: 'POST',
      body: JSON.stringify({ exportType: 'payment-journals', query: '' }),
    })
  )

  expect(response.status).toBe(200)
  expect(mocks.resolvePaymentJournalsExportPreflight).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/exports/start/__tests__/route.test.ts`
Expected: FAIL — both new export types unregistered.

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/exports/start/route.ts`, add the two imports and two map entries:

```ts
import { resolveBcExpenseExportPreflight } from '@/features/finance/server/bc-expense-export-context'
import { resolvePaymentJournalsExportPreflight } from '@/features/finance/server/payment-journals-export-context'
```

```ts
const EXPORT_PREFLIGHT_HANDLERS: Record<string, ExportPreflightHandler> = {
  'my-claims': resolveMyClaimsExportPreflight,
  'approval-history': resolveApprovalHistoryExportPreflight,
  'finance-history': resolveFinanceHistoryExportPreflight,
  'finance-pending': resolveFinancePendingExportPreflight,
  'bc-expense': resolveBcExpenseExportPreflight,
  'payment-journals': resolvePaymentJournalsExportPreflight,
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/exports/start/__tests__/route.test.ts`
Expected: PASS (all 9 tests). All 6 export types are now registered.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/exports/start/route.ts src/app/api/exports/start/__tests__/route.test.ts
git commit -m "feat(export): register bc-expense and payment-journals in /api/exports/start"
```

---

### Task 4: Narrow `buildBcExpenseRows`'s input type

**Files:**

- Modify: `src/features/finance/utils/bc-expense-export.ts`

`buildBcExpenseRows` only ever reads `.claim` and `.owner` off each history row (verified during spec design). Narrowing its parameter type lets the migrated route pass the lean `getFinanceHistoryPageForExport` result directly, with no cast. This is a type-only change — no runtime behavior changes, so the existing `src/features/finance/__tests__/bc-expense-export.test.ts` needs no modification (its fixtures already satisfy the narrower type; TypeScript's excess-property rules only restrict object literals passed inline, not already-constructed variables).

- [ ] **Step 1: Make the change**

In `src/features/finance/utils/bc-expense-export.ts`, update the import and the `BuildRowsInput` type:

```ts
import type { FinanceHistoryItem } from '@/features/finance/types'
```

becomes:

```ts
import type { FinanceHistoryItem } from '@/features/finance/types'

type BcExpenseHistoryRow = Pick<FinanceHistoryItem, 'claim' | 'owner'>
```

And the `BuildRowsInput` type's `historyRows` field:

```ts
type BuildRowsInput = {
  historyRows: BcExpenseHistoryRow[]
  claimItemsByClaimId: Map<string, ClaimExpenseItemRow[]>
  balAccountNoByItemType: Map<string, string>
  postingDate: string
  exportProfile: FinanceExportProfile
}
```

(Only the `historyRows` field's type changes, from `FinanceHistoryItem[]` to `BcExpenseHistoryRow[]`; everything else in the file is unchanged.)

- [ ] **Step 2: Run existing tests to verify no regression**

Run: `npx vitest run src/features/finance/__tests__/bc-expense-export.test.ts`
Expected: PASS, unmodified — confirms the narrowing is source-compatible.

Run: `npx tsc --noEmit`
Expected: no new type errors (the only caller, `bc-expense-export/route.ts`, is rewritten in Task 5 to pass the narrower shape).

- [ ] **Step 3: Commit**

```bash
git add src/features/finance/utils/bc-expense-export.ts
git commit -m "refactor(finance): narrow buildBcExpenseRows input to claim+owner only"
```

---

### Task 5: Migrate `bc-expense-export/route.ts`

**Files:**

- Modify: `src/app/(app)/approved-history/bc-expense-export/route.ts`
- Modify: `src/app/(app)/approved-history/bc-expense-export/__tests__/route.test.ts`

Drops the local `createStreamingCsvResponse` and the wasted available-actions call (3 queries/chunk → 2).

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/app/(app)/approved-history/bc-expense-export/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveBcExpenseExportContext: vi.fn(),
  getFinanceHistoryPageForExport: vi.fn(),
  getMappedClaimItemsByClaimId: vi.fn(),
  runCsvExport: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/finance/server/bc-expense-export-context', () => ({
  resolveBcExpenseExportContext: mocks.resolveBcExpenseExportContext,
}))

vi.mock('@/features/finance/data/queries', () => ({
  getFinanceHistoryPageForExport: mocks.getFinanceHistoryPageForExport,
  getMappedClaimItemsByClaimId: mocks.getMappedClaimItemsByClaimId,
}))

vi.mock('@/lib/utils/run-csv-export', () => ({
  runCsvExport: mocks.runCsvExport,
}))

import { GET, POST } from '@/app/(app)/approved-history/bc-expense-export/route'

describe('approved-history BC expense export route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'finance@nxtwave.co.in' } },
        }),
      },
    })

    mocks.resolveBcExpenseExportContext.mockResolvedValue({
      ok: true,
      context: {
        employee: { id: 'finance-1' },
        filters: { claimStatus: null },
        exportProfile: { profile_code: 'BC_EXPENSE' },
        balAccountNoByItemType: new Map([['food', '503063']]),
        mappedExpenseItemTypes: ['food'],
        postingDate: '15/04/2026',
      },
    })

    mocks.getMappedClaimItemsByClaimId.mockResolvedValue(new Map())

    mocks.runCsvExport.mockReturnValue(
      new Response('header\nrow', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('fetches one lean history page and one claim-items lookup per chunk (2 queries, not 3)', async () => {
    mocks.getFinanceHistoryPageForExport.mockResolvedValue({
      data: [
        {
          claim: {
            id: 'claim-1',
            claim_number: 'CLAIM-1',
            total_amount: 100,
            expense_region_code: 'X',
          },
          owner: { employee_id: 'NW1' },
        },
      ],
      hasNextPage: false,
      nextCursor: null,
    })

    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/bc-expense-export?requestId=req-1'
      )
    )

    expect(response.status).toBe(200)

    const [recipe] = mocks.runCsvExport.mock.calls[0]
    await recipe.fetchPage('cursor-a', 500)

    expect(mocks.getFinanceHistoryPageForExport).toHaveBeenCalledWith(
      expect.anything(),
      'cursor-a',
      500,
      expect.anything()
    )
    expect(mocks.getMappedClaimItemsByClaimId).toHaveBeenCalledWith(
      expect.anything(),
      ['claim-1'],
      ['food']
    )
  })

  it('passes the runCsvExport requestId through', async () => {
    mocks.getFinanceHistoryPageForExport.mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
    })

    await GET(
      new Request(
        'http://localhost:3000/approved-history/bc-expense-export?requestId=req-2'
      )
    )

    expect(mocks.runCsvExport).toHaveBeenCalledWith(expect.anything(), 'req-2')
  })

  it('returns 400 with Content-Disposition set when mapping config is missing', async () => {
    mocks.resolveBcExpenseExportContext.mockResolvedValue({
      ok: false,
      status: 400,
      message: 'Expense type account mappings are not configured.',
    })

    const response = await GET(
      new Request('http://localhost:3000/approved-history/bc-expense-export')
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
  })

  it('returns 401 for unauthenticated requests', async () => {
    mocks.resolveBcExpenseExportContext.mockResolvedValue({
      ok: false,
      status: 401,
      message: 'Unauthorized request.',
    })

    const response = await GET(
      new Request('http://localhost:3000/approved-history/bc-expense-export')
    )

    expect(response.status).toBe(401)
  })

  it('supports POST requests', async () => {
    mocks.getFinanceHistoryPageForExport.mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
    })

    const response = await POST(
      new Request('http://localhost:3000/approved-history/bc-expense-export', {
        method: 'POST',
      })
    )
    expect(response.status).toBe(200)
  })
})
```

Note: the detailed CSV-content assertions (food/fuel split, KM travel mapping, reconciliation rows) that existed in the old version of this test file are **not** duplicated here — they already have dedicated coverage in `src/features/finance/__tests__/bc-expense-export.test.ts`, which tests `buildBcExpenseRows` directly and is untouched by this migration (Task 4 confirmed it still passes). This route test now only verifies wiring: which queries run, with what arguments, and how errors/requestId propagate.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/(app)/approved-history/bc-expense-export/__tests__/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/app/(app)/approved-history/bc-expense-export/route.ts`:

```ts
import { resolveBcExpenseExportContext } from '@/features/finance/server/bc-expense-export-context'
import {
  getFinanceHistoryPageForExport,
  getMappedClaimItemsByClaimId,
} from '@/features/finance/data/queries'
import {
  buildBcExpenseRows,
  BC_EXPENSE_CSV_HEADERS,
} from '@/features/finance/utils/bc-expense-export'
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

  const resolved = await resolveBcExpenseExportContext(
    supabase,
    user?.email ? { email: user.email } : null,
    url.searchParams
  )

  if (!resolved.ok) {
    return createCsvExportErrorResponse(resolved.message, resolved.status)
  }

  const {
    filters,
    exportProfile,
    balAccountNoByItemType,
    mappedExpenseItemTypes,
    postingDate,
  } = resolved.context
  const filename = buildDatedCsvFilename('bc-expense')

  return runCsvExport(
    {
      fetchPage: async (cursor, limit) => {
        const historyPage = await getFinanceHistoryPageForExport(
          supabase,
          cursor,
          limit,
          filters
        )

        const claimIds = [
          ...new Set(historyPage.data.map((row) => row.claim.id)),
        ]

        const claimItemsByClaimId = await getMappedClaimItemsByClaimId(
          supabase,
          claimIds,
          mappedExpenseItemTypes
        )

        const rows = buildBcExpenseRows({
          historyRows: historyPage.data,
          claimItemsByClaimId,
          balAccountNoByItemType,
          postingDate,
          exportProfile,
        })

        return {
          data: rows,
          hasNextPage: historyPage.hasNextPage,
          nextCursor: historyPage.nextCursor,
        }
      },
      headers: BC_EXPENSE_CSV_HEADERS,
      mapRow: (row: string[]) => row,
      filename,
    },
    requestId
  )
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/(app)/approved-history/bc-expense-export/__tests__/route.test.ts src/features/finance/__tests__/bc-expense-export.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/approved-history/bc-expense-export/route.ts" "src/app/(app)/approved-history/bc-expense-export/__tests__/route.test.ts"
git commit -m "feat(finance): migrate bc-expense-export onto the shared pipeline, drop wasted availableActions call"
```

---

### Task 6: Migrate `payment-journals-export/route.ts`

**Files:**

- Modify: `src/app/(app)/approved-history/payment-journals-export/route.ts`
- Modify: `src/app/(app)/approved-history/payment-journals-export/__tests__/route.test.ts`

No query change (already a single aggregate query) — just moves onto the shared pipeline. `fetchPage` here ignores `cursor`/`limit` and returns everything in one call, matching today's already-non-paginated behavior.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/app/(app)/approved-history/payment-journals-export/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolvePaymentJournalsExportContext: vi.fn(),
  getFinancePaymentJournalTotals: vi.fn(),
  runCsvExport: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/finance/server/payment-journals-export-context', () => ({
  resolvePaymentJournalsExportContext:
    mocks.resolvePaymentJournalsExportContext,
}))

vi.mock('@/features/finance/data/queries', () => ({
  getFinancePaymentJournalTotals: mocks.getFinancePaymentJournalTotals,
}))

vi.mock('@/lib/utils/run-csv-export', () => ({
  runCsvExport: mocks.runCsvExport,
}))

import {
  GET,
  POST,
} from '@/app/(app)/approved-history/payment-journals-export/route'

const DEFAULTS = {
  documentType: 'Payment',
  accountType: 'Employee',
  employeeTransactionType: 'ADVANCE',
  cashFlowOptions: 'Petty cash & Reimbursements',
  typeOfPayment: '100% Payment after Service / Goods delivery',
  description: 'Reimbursements',
  paymentMethodCode: 'IMPS',
  balAccountType: 'Bank Account',
  balAccountNo: 'IDFC 2012',
  programCode: 'NIAT',
  subProductCode: 'NIAT362',
  responsibleDepCode: 'PRE-SALES',
  beneficiaryDepCode: 'PRE-SALES',
}

describe('approved-history Payment Journals export route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'finance@nxtwave.co.in' } },
        }),
      },
    })

    mocks.resolvePaymentJournalsExportContext.mockResolvedValue({
      ok: true,
      context: {
        employee: { id: 'finance-1' },
        filters: { claimStatus: null },
        defaults: DEFAULTS,
      },
    })

    mocks.getFinancePaymentJournalTotals.mockResolvedValue(
      new Map([['NW0004545', 3450.5]])
    )

    mocks.runCsvExport.mockReturnValue(
      new Response('header\nrow', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('streams one row per employee from the DB-aggregated totals in a single fetchPage call', async () => {
    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export?requestId=req-1'
      )
    )

    expect(response.status).toBe(200)
    expect(mocks.runCsvExport).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.stringContaining('payment-journals-'),
      }),
      'req-1'
    )

    const [recipe] = mocks.runCsvExport.mock.calls[0]
    const page = await recipe.fetchPage(null, 500)

    expect(page.hasNextPage).toBe(false)
    expect(page.data).toEqual([
      [
        '',
        'Payment',
        '',
        '',
        'Employee',
        'NW0004545',
        '0',
        '0',
        'ADVANCE',
        'Petty cash & Reimbursements',
        '100% Payment after Service / Goods delivery',
        '',
        '0',
        'Reimbursements',
        'IMPS',
        '3450.50',
        'Bank Account',
        'IDFC 2012',
        'NIAT',
        'NIAT362',
        'PRE-SALES',
        'PRE-SALES',
      ],
    ])
    expect(mocks.getFinancePaymentJournalTotals).toHaveBeenCalledTimes(1)
  })

  it('returns 400 with Content-Disposition set when the export profile is missing', async () => {
    mocks.resolvePaymentJournalsExportContext.mockResolvedValue({
      ok: false,
      status: 400,
      message: 'Payment Journals export profile is not configured.',
    })

    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export'
      )
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
  })

  it('returns 401 for unauthenticated requests', async () => {
    mocks.resolvePaymentJournalsExportContext.mockResolvedValue({
      ok: false,
      status: 401,
      message: 'Unauthorized request.',
    })

    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export'
      )
    )

    expect(response.status).toBe(401)
  })

  it('supports POST requests', async () => {
    const response = await POST(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export',
        { method: 'POST' }
      )
    )
    expect(response.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(app)/approved-history/payment-journals-export/__tests__/route.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/app/(app)/approved-history/payment-journals-export/route.ts`:

```ts
import { resolvePaymentJournalsExportContext } from '@/features/finance/server/payment-journals-export-context'
import { getFinancePaymentJournalTotals } from '@/features/finance/data/queries'
import {
  buildPaymentJournalsRows,
  PAYMENT_JOURNALS_CSV_HEADERS,
} from '@/features/finance/utils/payment-journals-export'
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

  const resolved = await resolvePaymentJournalsExportContext(
    supabase,
    user?.email ? { email: user.email } : null,
    url.searchParams
  )

  if (!resolved.ok) {
    return createCsvExportErrorResponse(resolved.message, resolved.status)
  }

  const { filters, defaults } = resolved.context
  const filename = buildDatedCsvFilename('payment-journals')

  return runCsvExport(
    {
      fetchPage: async () => {
        const totalsByEmployeeId = await getFinancePaymentJournalTotals(
          supabase,
          filters
        )

        const rows = buildPaymentJournalsRows({ totalsByEmployeeId, defaults })

        return { data: rows, hasNextPage: false, nextCursor: null }
      },
      headers: PAYMENT_JOURNALS_CSV_HEADERS,
      mapRow: (row: string[]) => row,
      filename,
    },
    requestId
  )
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(app)/approved-history/payment-journals-export/__tests__/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/approved-history/payment-journals-export/route.ts" "src/app/(app)/approved-history/payment-journals-export/__tests__/route.test.ts"
git commit -m "feat(finance): migrate payment-journals-export onto the shared pipeline"
```

---

### Task 7: Retire `ApprovedHistoryExportActions`, finish `finance-filters-bar.tsx`

**Files:**

- Modify: `src/features/finance/components/finance-filters-bar.tsx`
- Modify: `src/app/(app)/approved-history/page.tsx`

BC-Expense and Payment Journals become `CsvExportButton` instances too. `ApprovedHistoryExportActions` has no remaining callers after this task — its file deletion is handled in Phase 5 alongside the other now-dead files, so every phase stays independently revertible.

- [ ] **Step 1: Update `finance-filters-bar.tsx`**

Remove the import:

```ts
import { ApprovedHistoryExportActions } from '@/features/finance/components/approved-history-export-actions'
```

Replace the export-buttons render block:

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
      <CsvExportButton
        exportType="bc-expense"
        href={approvedHistoryBcExpenseHref}
        label="BC Expense"
        className="rounded-md"
      />
      <CsvExportButton
        exportType="payment-journals"
        href={approvedHistoryPaymentJournalsHref}
        label="Payment Journals"
        className="rounded-md"
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

- [ ] **Step 2: Verify manually**

Run: `npm run dev`, visit `/approved-history` as a finance team member. Confirm all three buttons ("All CSV", "BC Expense", "Payment Journals") show real progress, complete successfully, and download correct files. Confirm a simulated failure (e.g. temporarily rename the `finance_export_profiles` row's `profile_code` in a test DB) surfaces as a toast, not a navigation.

- [ ] **Step 3: Commit**

```bash
git add src/features/finance/components/finance-filters-bar.tsx
git commit -m "feat(finance): migrate BC-Expense and Payment Journals buttons onto CsvExportButton"
```

---

## Phase 4 Completion Checklist

- [ ] All 6 export types registered in `/api/exports/start`.
- [ ] `bc-expense-export` fetches 2 queries/chunk (lean history page + claim items), not 3 — the original N+1 complaint is closed.
- [ ] `payment-journals-export` unchanged query-wise, now on the shared pipeline.
- [ ] `ApprovedHistoryExportActions` and `csv-export-actions.tsx` have zero remaining call sites (verify: `grep -r "csv-export-actions\|approved-history-export-actions" src --include=*.tsx -l` should only show the component files themselves, no importers).
- [ ] `npx vitest run` passes in full.
- [ ] `npx tsc --noEmit` passes with no errors.

**Next:** Phase 5 (`docs/superpowers/plans/2026-07-01-csv-export-rebuild-phase5-cleanup.md`) deletes `streaming-export.ts`, `csv-export-actions.tsx`, `approved-history-export-actions.tsx`, and the `mode=page|all` remnants in `export-route.ts`, then runs full verification.
