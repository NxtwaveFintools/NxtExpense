import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEmployeeByEmail: vi.fn(),
  isFinanceTeamMember: vi.fn(),
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
}))

vi.mock('@/features/finance/permissions', () => ({
  isFinanceTeamMember: mocks.isFinanceTeamMember,
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
        claimStatus: '11111111-1111-4111-8111-111111111111',
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
  })

  it('returns { ok: true } on success', async () => {
    const result = await resolveFinancePendingExportPreflight(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result).toEqual({ ok: true })
  })
})
