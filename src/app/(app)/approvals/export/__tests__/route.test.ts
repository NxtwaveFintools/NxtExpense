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
  createStreamingCsvResponse: vi.fn(),
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
  APPROVAL_HISTORY_CSV_HEADERS: ['col1', 'col2'],
  mapApprovalHistoryToCsvRow: vi.fn(),
}))

vi.mock('@/lib/utils/streaming-export', () => ({
  createStreamingCsvResponse: mocks.createStreamingCsvResponse,
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
      claimStatus: null,
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

    mocks.createStreamingCsvResponse.mockReturnValue(
      new Response('col1,col2\nval1,val2', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('exports current page CSV via GET mode=page', async () => {
    const response = await GET(
      new Request(
        'http://localhost:3000/approvals/export?mode=page&actorFilter=finance'
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/csv')
    expect(await response.text()).toBe('col1,col2\nval1,val2')
    const normalizeInput =
      mocks.normalizeApprovalHistoryFilters.mock.calls[0]?.[0]
    expect(normalizeInput.amountOperator).toBeUndefined()
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
    expect(mocks.createStreamingCsvResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: ['col1', 'col2'],
        filename: expect.stringContaining('approvals-history-all-'),
      })
    )
  })

  it('supports POST requests without returning 405', async () => {
    const response = await POST(
      new Request('http://localhost:3000/approvals/export?mode=all', {
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.createStreamingCsvResponse).toHaveBeenCalledTimes(1)
  })

  it('returns 401 when request is unauthenticated', async () => {
    mocks.createSupabaseServerClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    const response = await GET(
      new Request('http://localhost:3000/approvals/export?mode=page')
    )

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Unauthorized request.')
  })

  it('returns 403 when approver profile is missing', async () => {
    mocks.getEmployeeByEmail.mockResolvedValueOnce(null)

    const response = await GET(
      new Request('http://localhost:3000/approvals/export?mode=page')
    )

    expect(response.status).toBe(403)
    expect(await response.text()).toBe('Approver profile not found.')
  })

  it('returns 403 when user has no approval access', async () => {
    mocks.hasApproverAssignments.mockResolvedValueOnce(false)
    mocks.canAccessApprovals.mockReturnValueOnce(false)

    const response = await POST(
      new Request('http://localhost:3000/approvals/export?mode=all', {
        method: 'POST',
      })
    )

    expect(response.status).toBe(403)
    expect(await response.text()).toBe('Access denied.')
  })
})
