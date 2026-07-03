import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveFinancePendingExportContext: vi.fn(),
  getFinanceQueuePaginated: vi.fn(),
  runCsvExport: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/finance/server/finance-pending-export-context', () => ({
  resolveFinancePendingExportContext: mocks.resolveFinancePendingExportContext,
}))

vi.mock('@/features/finance/data/queries', () => ({
  getFinanceQueuePaginated: mocks.getFinanceQueuePaginated,
}))

vi.mock('@/features/finance/utils/filters', () => ({
  FINANCE_PENDING_CLAIMS_CSV_HEADERS: ['Claim ID'],
  mapFinancePendingClaimToCsvRow: vi.fn((row: { claimId: string }) => [
    row.claimId,
  ]),
}))

vi.mock('@/lib/utils/run-csv-export', () => ({
  runCsvExport: mocks.runCsvExport,
  ENRICHMENT_EXPORT_CHUNK_SIZE: 500,
}))

import { GET, POST } from '@/app/(app)/finance/pending-export/route'
import { ENRICHMENT_EXPORT_CHUNK_SIZE } from '@/lib/utils/run-csv-export'

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

    mocks.resolveFinancePendingExportContext.mockResolvedValue({
      ok: true,
      context: {
        employee: { id: 'finance-1' },
        filters: {
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
        },
      },
    })

    mocks.runCsvExport.mockReturnValue(
      new Response('Claim ID\nCLAIM-1', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('streams via runCsvExport using getFinanceQueuePaginated', async () => {
    const response = await GET(
      new Request('http://localhost:3000/finance/pending-export')
    )

    expect(response.status).toBe(200)
    expect(mocks.runCsvExport).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: ['Claim ID'],
        filename: expect.stringContaining('pending-claims-'),
        chunkSize: ENRICHMENT_EXPORT_CHUNK_SIZE,
      })
    )

    const [recipe] = mocks.runCsvExport.mock.calls[0]
    await recipe.fetchPage('cursor-a', 500)
    expect(mocks.getFinanceQueuePaginated).toHaveBeenCalledWith(
      expect.anything(),
      'cursor-a',
      500,
      expect.anything()
    )
  })

  it('returns 403 when finance access is required', async () => {
    mocks.resolveFinancePendingExportContext.mockResolvedValue({
      ok: false,
      status: 403,
      message: 'Finance access is required.',
    })

    const response = await GET(
      new Request('http://localhost:3000/finance/pending-export')
    )

    expect(response.status).toBe(403)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
  })

  it('supports POST requests', async () => {
    const response = await POST(
      new Request('http://localhost:3000/finance/pending-export', {
        method: 'POST',
      })
    )
    expect(response.status).toBe(200)
  })

  it('returns 400 with Content-Disposition set when the context resolver throws (e.g. invalid filter validation)', async () => {
    mocks.resolveFinancePendingExportContext.mockRejectedValue(
      new Error('Invalid date range.')
    )

    const response = await GET(
      new Request('http://localhost:3000/finance/pending-export')
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
    expect(await response.text()).toBe('Invalid date range.')
  })
})
