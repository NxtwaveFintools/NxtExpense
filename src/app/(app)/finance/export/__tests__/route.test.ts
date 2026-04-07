import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  isFinanceTeamMember: vi.fn(),
  getFinanceHistoryPaginated: vi.fn(),
  normalizeFinanceFilters: vi.fn(),
  buildFinanceHistoryCsv: vi.fn(),
  createStreamingCsvResponse: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
}))

vi.mock('@/features/finance/permissions', () => ({
  isFinanceTeamMember: mocks.isFinanceTeamMember,
}))

vi.mock('@/features/finance/queries', () => ({
  getFinanceHistoryPaginated: mocks.getFinanceHistoryPaginated,
}))

vi.mock('@/features/finance/utils/filters', () => ({
  normalizeFinanceFilters: mocks.normalizeFinanceFilters,
  buildFinanceHistoryCsv: mocks.buildFinanceHistoryCsv,
  FINANCE_HISTORY_CSV_HEADERS: ['Claim ID'],
  mapFinanceHistoryToCsvRow: vi.fn((row: { claimId: string }) => [row.claimId]),
}))

vi.mock('@/lib/utils/streaming-export', () => ({
  createStreamingCsvResponse: mocks.createStreamingCsvResponse,
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

    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'finance-1',
      employee_email: 'finance@nxtwave.co.in',
    })

    mocks.isFinanceTeamMember.mockResolvedValue(true)

    mocks.normalizeFinanceFilters.mockReturnValue({
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
    })

    mocks.getFinanceHistoryPaginated.mockResolvedValue({
      data: [{ claimId: 'CLAIM-260306-001' }],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })

    mocks.buildFinanceHistoryCsv.mockReturnValue('Claim ID\nCLAIM-260306-001')

    mocks.createStreamingCsvResponse.mockReturnValue(
      new Response('Claim ID\nCLAIM-260306-001', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('exports current page CSV via GET mode=page', async () => {
    const response = await GET(
      new Request(
        'http://localhost:3000/finance/export?mode=page&historyCursor=cursor-1&pageSize=25'
      )
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('Claim ID\nCLAIM-260306-001')
    expect(mocks.getFinanceHistoryPaginated).toHaveBeenCalledWith(
      expect.anything(),
      'cursor-1',
      25,
      expect.objectContaining({
        claimStatus: null,
      })
    )
  })

  it('exports all rows CSV via GET mode=all', async () => {
    const response = await GET(
      new Request('http://localhost:3000/finance/export?mode=all')
    )

    expect(response.status).toBe(200)
    expect(mocks.createStreamingCsvResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: ['Claim ID'],
        filename: expect.stringContaining('approved-history-all-'),
      })
    )
  })

  it('returns 401 for unauthenticated requests', async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    const response = await GET(
      new Request('http://localhost:3000/finance/export')
    )

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Unauthorized request.')
  })

  it('returns 403 when requester is not in finance team', async () => {
    mocks.isFinanceTeamMember.mockResolvedValue(false)

    const response = await GET(
      new Request('http://localhost:3000/finance/export')
    )

    expect(response.status).toBe(403)
    expect(await response.text()).toBe('Finance access is required.')
  })

  it('supports POST requests and all-mode streaming', async () => {
    const response = await POST(
      new Request('http://localhost:3000/finance/export?mode=all', {
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.createStreamingCsvResponse).toHaveBeenCalledTimes(1)
  })
})
