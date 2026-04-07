import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  isFinanceTeamMember: vi.fn(),
  getFinanceQueuePaginated: vi.fn(),
  normalizeFinanceFilters: vi.fn(),
  buildFinancePendingClaimsCsv: vi.fn(),
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
  getFinanceQueuePaginated: mocks.getFinanceQueuePaginated,
}))

vi.mock('@/features/finance/utils/filters', () => ({
  normalizeFinanceFilters: mocks.normalizeFinanceFilters,
  buildFinancePendingClaimsCsv: mocks.buildFinancePendingClaimsCsv,
  FINANCE_PENDING_CLAIMS_CSV_HEADERS: ['Claim ID'],
  mapFinancePendingClaimToCsvRow: vi.fn((row: { claimId: string }) => [
    row.claimId,
  ]),
}))

vi.mock('@/lib/utils/streaming-export', () => ({
  createStreamingCsvResponse: mocks.createStreamingCsvResponse,
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

    mocks.getFinanceQueuePaginated.mockResolvedValue({
      data: [{ claimId: 'CLAIM-260306-001' }],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })

    mocks.buildFinancePendingClaimsCsv.mockReturnValue(
      'Claim ID\nCLAIM-260306-001'
    )

    mocks.createStreamingCsvResponse.mockReturnValue(
      new Response('Claim ID\nCLAIM-260306-001', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('falls back forged unsupported date filter field to claim_date', async () => {
    const response = await GET(
      new Request(
        'http://localhost:3000/finance/pending-export?mode=page&dateFilterField=issued_at'
      )
    )

    expect(response.status).toBe(200)
    expect(mocks.getFinanceQueuePaginated).toHaveBeenCalledWith(
      expect.anything(),
      null,
      10,
      expect.objectContaining({
        dateFilterField: 'claim_date',
      })
    )
  })

  it('allows whitelisted date filter values', async () => {
    mocks.normalizeFinanceFilters.mockReturnValueOnce({
      employeeName: null,
      claimNumber: null,
      ownerDesignation: null,
      hodApproverEmployeeId: null,
      claimStatus: null,
      workLocation: null,
      actionFilter: null,
      dateFilterField: 'submitted_at',
      dateFrom: null,
      dateTo: null,
    })

    await GET(
      new Request(
        'http://localhost:3000/finance/pending-export?mode=page&dateFilterField=submitted_at'
      )
    )

    expect(mocks.getFinanceQueuePaginated).toHaveBeenCalledWith(
      expect.anything(),
      null,
      10,
      expect.objectContaining({
        dateFilterField: 'submitted_at',
      })
    )
  })

  it('supports all-mode streaming exports', async () => {
    const response = await GET(
      new Request('http://localhost:3000/finance/pending-export?mode=all')
    )

    expect(response.status).toBe(200)
    expect(mocks.createStreamingCsvResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: ['Claim ID'],
        filename: expect.stringContaining('pending-claims-all-'),
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
      new Request('http://localhost:3000/finance/pending-export')
    )

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Unauthorized request.')
  })

  it('returns 403 when requester is not finance', async () => {
    mocks.isFinanceTeamMember.mockResolvedValue(false)

    const response = await POST(
      new Request('http://localhost:3000/finance/pending-export', {
        method: 'POST',
      })
    )

    expect(response.status).toBe(403)
    expect(await response.text()).toBe('Finance access is required.')
  })
})
