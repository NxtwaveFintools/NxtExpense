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
