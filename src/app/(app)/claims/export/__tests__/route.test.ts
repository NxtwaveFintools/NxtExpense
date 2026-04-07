import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  canAccessEmployeeClaims: vi.fn(),
  canDownloadClaimsCsv: vi.fn(),
  getMyClaimsPaginated: vi.fn(),
  normalizeMyClaimsFilters: vi.fn(),
  buildMyClaimsCsv: vi.fn(),
  createStreamingCsvResponse: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
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

vi.mock('@/features/claims/queries', () => ({
  getMyClaimsPaginated: mocks.getMyClaimsPaginated,
}))

vi.mock('@/features/claims/utils/filters', () => ({
  normalizeMyClaimsFilters: mocks.normalizeMyClaimsFilters,
  buildMyClaimsCsv: mocks.buildMyClaimsCsv,
  MY_CLAIMS_CSV_HEADERS: ['Claim ID'],
  mapMyClaimToCsvRow: vi.fn((row: { claim_number: string }) => [
    row.claim_number,
  ]),
}))

vi.mock('@/lib/utils/streaming-export', () => ({
  createStreamingCsvResponse: mocks.createStreamingCsvResponse,
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

    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'emp-1',
      employee_email: 'employee@nxtwave.co.in',
      designations: { designation_name: 'Student Relationship Officer' },
    })

    mocks.canAccessEmployeeClaims.mockResolvedValue(true)
    mocks.canDownloadClaimsCsv.mockReturnValue(true)

    mocks.normalizeMyClaimsFilters.mockReturnValue({
      claimStatus: null,
      workLocation: null,
      claimDateFrom: null,
      claimDateTo: null,
    })

    mocks.getMyClaimsPaginated.mockResolvedValue({
      data: [{ id: 'claim-1' }],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })

    mocks.buildMyClaimsCsv.mockReturnValue('Claim ID\nCLAIM-260306-001')

    mocks.createStreamingCsvResponse.mockReturnValue(
      new Response('Claim ID\nCLAIM-260306-001', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('exports current page CSV via GET mode=page', async () => {
    const response = await GET(
      new Request('http://localhost:3000/claims/export?mode=page&cursor=abc')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(await response.text()).toBe('Claim ID\nCLAIM-260306-001')
    expect(mocks.getMyClaimsPaginated).toHaveBeenCalledWith(
      expect.anything(),
      'emp-1',
      'abc',
      10,
      expect.anything()
    )
  })

  it('exports all rows CSV via GET mode=all', async () => {
    const response = await GET(
      new Request('http://localhost:3000/claims/export?mode=all')
    )

    expect(response.status).toBe(200)
    expect(mocks.createStreamingCsvResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: ['Claim ID'],
        filename: expect.stringContaining('my-claims-all-'),
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
      new Request('http://localhost:3000/claims/export')
    )

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Unauthorized request.')
  })

  it('returns 403 when employee lacks claims access', async () => {
    mocks.canAccessEmployeeClaims.mockResolvedValue(false)

    const response = await GET(
      new Request('http://localhost:3000/claims/export')
    )

    expect(response.status).toBe(403)
    expect(await response.text()).toBe('Claims access is required.')
  })

  it('returns 403 when designation is not allowed to download claims CSV', async () => {
    mocks.canDownloadClaimsCsv.mockReturnValue(false)

    const response = await GET(
      new Request('http://localhost:3000/claims/export')
    )

    expect(response.status).toBe(403)
    expect(await response.text()).toBe(
      'CSV export is not available for your designation.'
    )
  })

  it('supports POST requests and preserves auth checks', async () => {
    const response = await POST(
      new Request('http://localhost:3000/claims/export?mode=all', {
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.createStreamingCsvResponse).toHaveBeenCalledTimes(1)
  })
})
