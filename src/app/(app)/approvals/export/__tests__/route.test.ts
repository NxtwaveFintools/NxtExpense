import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  hasApproverAssignments: vi.fn(),
  canAccessApprovals: vi.fn(),
  getAllFilteredApprovalHistory: vi.fn(),
  getFilteredApprovalHistoryPaginated: vi.fn(),
  buildApprovalHistoryCsv: vi.fn(),
  normalizeApprovalHistoryFilters: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
  hasApproverAssignments: mocks.hasApproverAssignments,
}))

vi.mock('@/features/employees/permissions', () => ({
  canAccessApprovals: mocks.canAccessApprovals,
}))

vi.mock('@/features/approvals/queries/history-filters', () => ({
  getAllFilteredApprovalHistory: mocks.getAllFilteredApprovalHistory,
  getFilteredApprovalHistoryPaginated:
    mocks.getFilteredApprovalHistoryPaginated,
}))

vi.mock('@/features/approvals/utils/history-filters', () => ({
  buildApprovalHistoryCsv: mocks.buildApprovalHistoryCsv,
  normalizeApprovalHistoryFilters: mocks.normalizeApprovalHistoryFilters,
}))

import { GET, POST } from '@/app/(app)/approvals/export/route'

describe('approvals export route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              email: 'finance@nxtwave.co.in',
            },
          },
        }),
      },
    })

    mocks.getEmployeeByEmail.mockResolvedValue({
      employee_email: 'finance@nxtwave.co.in',
    })
    mocks.hasApproverAssignments.mockResolvedValue(true)
    mocks.canAccessApprovals.mockReturnValue(true)

    mocks.normalizeApprovalHistoryFilters.mockReturnValue({
      employeeName: null,
      actorFilter: 'all',
      claimDate: null,
      hodApprovedFrom: null,
      hodApprovedTo: null,
      financeApprovedFrom: null,
      financeApprovedTo: null,
    })

    mocks.getFilteredApprovalHistoryPaginated.mockResolvedValue({
      data: [
        {
          claimId: 'claim-1',
        },
      ],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })

    mocks.getAllFilteredApprovalHistory.mockResolvedValue([
      {
        claimId: 'claim-2',
      },
    ])

    mocks.buildApprovalHistoryCsv.mockReturnValue('col1,col2\nval1,val2')
  })

  it('exports current page CSV via GET mode=page', async () => {
    const response = await GET(
      new Request('http://localhost:3000/approvals/export?mode=page')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/csv')
    expect(await response.text()).toBe('col1,col2\nval1,val2')
    expect(mocks.getFilteredApprovalHistoryPaginated).toHaveBeenCalledWith(
      expect.anything(),
      null,
      10,
      expect.anything()
    )
  })

  it('exports all rows CSV via GET mode=all', async () => {
    const response = await GET(
      new Request('http://localhost:3000/approvals/export?mode=all')
    )

    expect(response.status).toBe(200)
    expect(mocks.getAllFilteredApprovalHistory).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything()
    )
  })

  it('supports POST requests without returning 405', async () => {
    const response = await POST(
      new Request('http://localhost:3000/approvals/export?mode=all', {
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.getAllFilteredApprovalHistory).toHaveBeenCalledTimes(1)
  })
})
