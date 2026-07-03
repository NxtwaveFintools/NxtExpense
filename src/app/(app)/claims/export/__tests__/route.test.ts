import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveMyClaimsExportContext: vi.fn(),
  getMyClaimsPaginated: vi.fn(),
  runCsvExport: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/claims/server/claims-export-context', () => ({
  resolveMyClaimsExportContext: mocks.resolveMyClaimsExportContext,
}))

vi.mock('@/features/claims/data/queries', () => ({
  getMyClaimsPaginated: mocks.getMyClaimsPaginated,
}))

vi.mock('@/features/claims/utils/filters', () => ({
  MY_CLAIMS_CSV_HEADERS: ['Claim ID'],
  mapMyClaimToCsvRow: vi.fn((row: { claim_number: string }) => [
    row.claim_number,
  ]),
}))

vi.mock('@/lib/utils/run-csv-export', () => ({
  runCsvExport: mocks.runCsvExport,
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

    mocks.resolveMyClaimsExportContext.mockResolvedValue({
      ok: true,
      context: {
        employee: { id: 'emp-1' },
        filters: {
          claimStatus: null,
          workLocation: null,
          claimDateFrom: null,
          claimDateTo: null,
        },
      },
    })

    mocks.runCsvExport.mockReturnValue(
      new Response('Claim ID\nCLAIM-260306-001', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('streams the export via runCsvExport with the resolved employee/filters', async () => {
    const response = await GET(
      new Request('http://localhost:3000/claims/export')
    )

    expect(response.status).toBe(200)
    expect(mocks.runCsvExport).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: ['Claim ID'],
        filename: expect.stringContaining('my-claims-'),
      })
    )

    const [recipe] = mocks.runCsvExport.mock.calls[0]
    await recipe.fetchPage('cursor-a', 500)
    expect(mocks.getMyClaimsPaginated).toHaveBeenCalledWith(
      expect.anything(),
      'emp-1',
      'cursor-a',
      500,
      expect.anything()
    )
  })

  it('returns 401 for unauthenticated requests, with Content-Disposition set', async () => {
    mocks.resolveMyClaimsExportContext.mockResolvedValue({
      ok: false,
      status: 401,
      message: 'Unauthorized request.',
    })

    const response = await GET(
      new Request('http://localhost:3000/claims/export')
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
    expect(await response.text()).toBe('Unauthorized request.')
  })

  it('returns 403 when the context resolver rejects the designation', async () => {
    mocks.resolveMyClaimsExportContext.mockResolvedValue({
      ok: false,
      status: 403,
      message: 'CSV export is not available for your designation.',
    })

    const response = await GET(
      new Request('http://localhost:3000/claims/export')
    )

    expect(response.status).toBe(403)
  })

  it('supports POST requests and preserves the same behavior', async () => {
    const response = await POST(
      new Request('http://localhost:3000/claims/export', { method: 'POST' })
    )

    expect(response.status).toBe(200)
    expect(mocks.runCsvExport).toHaveBeenCalledTimes(1)
  })

  it('returns 400 with Content-Disposition set when the context resolver throws (e.g. invalid filter validation)', async () => {
    mocks.resolveMyClaimsExportContext.mockRejectedValue(
      new Error('Invalid claim status filter.')
    )

    const response = await GET(
      new Request('http://localhost:3000/claims/export?claimStatus=bogus')
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
    expect(await response.text()).toBe('Invalid claim status filter.')
  })
})
