import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveFinanceHistoryExportContext: vi.fn(),
  getFinanceHistoryPageForExport: vi.fn(),
  runCsvExport: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/finance/server/finance-history-export-context', () => ({
  resolveFinanceHistoryExportContext: mocks.resolveFinanceHistoryExportContext,
}))

vi.mock('@/features/finance/data/queries', () => ({
  getFinanceHistoryPageForExport: mocks.getFinanceHistoryPageForExport,
}))

vi.mock('@/features/finance/utils/filters', () => ({
  FINANCE_HISTORY_CSV_HEADERS: ['Claim Number'],
  mapFinanceHistoryToCsvRow: vi.fn(
    (row: { claim: { claim_number: string } }) => [row.claim.claim_number]
  ),
}))

vi.mock('@/lib/utils/run-csv-export', () => ({
  runCsvExport: mocks.runCsvExport,
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

    mocks.resolveFinanceHistoryExportContext.mockResolvedValue({
      ok: true,
      context: {
        employee: { id: 'finance-1' },
        filters: {
          employeeId: null,
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
      new Response('Claim Number\nCLAIM-1', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('streams via runCsvExport using getFinanceHistoryPageForExport (no availableActions call)', async () => {
    const response = await GET(
      new Request('http://localhost:3000/finance/export?requestId=req-1')
    )

    expect(response.status).toBe(200)
    expect(mocks.runCsvExport).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: ['Claim Number'],
        filename: expect.stringContaining('approved-history-'),
      }),
      'req-1'
    )

    const [recipe] = mocks.runCsvExport.mock.calls[0]
    await recipe.fetchPage('cursor-a', 500)
    expect(mocks.getFinanceHistoryPageForExport).toHaveBeenCalledWith(
      expect.anything(),
      'cursor-a',
      500,
      expect.anything()
    )
  })

  it('returns 401 with Content-Disposition set for unauthenticated requests', async () => {
    mocks.resolveFinanceHistoryExportContext.mockResolvedValue({
      ok: false,
      status: 401,
      message: 'Unauthorized request.',
    })

    const response = await GET(
      new Request('http://localhost:3000/finance/export')
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
  })

  it('returns 403 when finance access is required', async () => {
    mocks.resolveFinanceHistoryExportContext.mockResolvedValue({
      ok: false,
      status: 403,
      message: 'Finance access is required.',
    })

    const response = await GET(
      new Request('http://localhost:3000/finance/export')
    )

    expect(response.status).toBe(403)
  })

  it('supports POST requests', async () => {
    const response = await POST(
      new Request('http://localhost:3000/finance/export', { method: 'POST' })
    )
    expect(response.status).toBe(200)
  })

  it('returns 400 with Content-Disposition set when the context resolver throws (e.g. invalid filter validation)', async () => {
    mocks.resolveFinanceHistoryExportContext.mockRejectedValue(
      new Error('Invalid date range.')
    )

    const response = await GET(
      new Request('http://localhost:3000/finance/export')
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
    expect(await response.text()).toBe('Invalid date range.')
  })
})
