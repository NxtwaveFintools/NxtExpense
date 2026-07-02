import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveApprovalHistoryExportContext: vi.fn(),
  getFilteredApprovalHistoryPaginated: vi.fn(),
  runCsvExport: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/approvals/server/approval-history-export-context', () => ({
  resolveApprovalHistoryExportContext:
    mocks.resolveApprovalHistoryExportContext,
}))

vi.mock('@/features/approvals/data/queries', () => ({
  getFilteredApprovalHistoryPaginated:
    mocks.getFilteredApprovalHistoryPaginated,
}))

vi.mock('@/features/approvals/utils/history-filters', () => ({
  APPROVAL_HISTORY_CSV_HEADERS: ['Claim Number'],
  mapApprovalHistoryToCsvRow: vi.fn((row: { claimNumber: string }) => [
    row.claimNumber,
  ]),
}))

vi.mock('@/lib/utils/run-csv-export', () => ({
  runCsvExport: mocks.runCsvExport,
  ENRICHMENT_EXPORT_CHUNK_SIZE: 500,
}))

import { GET, POST } from '@/app/(app)/approvals/export/route'
import { ENRICHMENT_EXPORT_CHUNK_SIZE } from '@/lib/utils/run-csv-export'

describe('approvals export route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'approver@nxtwave.co.in' } },
        }),
      },
    })

    mocks.resolveApprovalHistoryExportContext.mockResolvedValue({
      ok: true,
      context: {
        employee: { id: 'emp-1' },
        filters: {
          claimStatus: null,
          employeeName: null,
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
        },
      },
    })

    mocks.runCsvExport.mockReturnValue(
      new Response('Claim Number\nCLAIM-1', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('streams the export via runCsvExport with the resolved filters', async () => {
    const response = await GET(
      new Request('http://localhost:3000/approvals/export?requestId=req-1')
    )

    expect(response.status).toBe(200)
    expect(mocks.runCsvExport).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: ['Claim Number'],
        filename: expect.stringContaining('approvals-history-'),
        chunkSize: ENRICHMENT_EXPORT_CHUNK_SIZE,
      }),
      'req-1'
    )

    const [recipe] = mocks.runCsvExport.mock.calls[0]
    await recipe.fetchPage('cursor-a', 500)
    expect(mocks.getFilteredApprovalHistoryPaginated).toHaveBeenCalledWith(
      expect.anything(),
      'cursor-a',
      500,
      expect.anything()
    )
  })

  it('returns 401 with Content-Disposition set for unauthenticated requests', async () => {
    mocks.resolveApprovalHistoryExportContext.mockResolvedValue({
      ok: false,
      status: 401,
      message: 'Unauthorized request.',
    })

    const response = await GET(
      new Request('http://localhost:3000/approvals/export')
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
  })

  it('returns 403 when access is denied', async () => {
    mocks.resolveApprovalHistoryExportContext.mockResolvedValue({
      ok: false,
      status: 403,
      message: 'Access denied.',
    })

    const response = await GET(
      new Request('http://localhost:3000/approvals/export')
    )

    expect(response.status).toBe(403)
  })

  it('supports POST requests', async () => {
    const response = await POST(
      new Request('http://localhost:3000/approvals/export', {
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
  })

  it('returns 400 with Content-Disposition set when the context resolver throws (e.g. invalid filter validation)', async () => {
    mocks.resolveApprovalHistoryExportContext.mockRejectedValue(
      new Error('Invalid date range.')
    )

    const response = await GET(
      new Request('http://localhost:3000/approvals/export')
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
    expect(await response.text()).toBe('Invalid date range.')
  })
})
