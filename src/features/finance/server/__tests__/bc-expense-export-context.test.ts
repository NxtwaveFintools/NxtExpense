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
