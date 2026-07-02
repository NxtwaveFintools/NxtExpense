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
