import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveBcExpenseExportContext: vi.fn(),
  getFinanceHistoryPageForExport: vi.fn(),
  getMappedClaimItemsByClaimId: vi.fn(),
  runCsvExport: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/finance/server/bc-expense-export-context', () => ({
  resolveBcExpenseExportContext: mocks.resolveBcExpenseExportContext,
}))

vi.mock('@/features/finance/data/queries', () => ({
  getFinanceHistoryPageForExport: mocks.getFinanceHistoryPageForExport,
  getMappedClaimItemsByClaimId: mocks.getMappedClaimItemsByClaimId,
}))

vi.mock('@/lib/utils/run-csv-export', () => ({
  runCsvExport: mocks.runCsvExport,
}))

import { GET, POST } from '@/app/(app)/approved-history/bc-expense-export/route'

describe('approved-history BC expense export route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'finance@nxtwave.co.in' } },
        }),
      },
    })

    mocks.resolveBcExpenseExportContext.mockResolvedValue({
      ok: true,
      context: {
        employee: { id: 'finance-1' },
        filters: { claimStatus: null },
        exportProfile: { profile_code: 'BC_EXPENSE' },
        balAccountNoByItemType: new Map([['food', '503063']]),
        mappedExpenseItemTypes: ['food'],
        postingDate: '15/04/2026',
      },
    })

    mocks.getMappedClaimItemsByClaimId.mockResolvedValue(new Map())

    mocks.runCsvExport.mockReturnValue(
      new Response('header\nrow', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('fetches one lean history page and one claim-items lookup per chunk (2 queries, not 3)', async () => {
    mocks.getFinanceHistoryPageForExport.mockResolvedValue({
      data: [
        {
          claim: {
            id: 'claim-1',
            claim_number: 'CLAIM-1',
            total_amount: 100,
            expense_region_code: 'X',
          },
          owner: { employee_id: 'NW1' },
        },
      ],
      hasNextPage: false,
      nextCursor: null,
    })

    const response = await GET(
      new Request('http://localhost:3000/approved-history/bc-expense-export')
    )

    expect(response.status).toBe(200)

    const [recipe] = mocks.runCsvExport.mock.calls[0]
    await recipe.fetchPage('cursor-a', 500)

    expect(mocks.getFinanceHistoryPageForExport).toHaveBeenCalledWith(
      expect.anything(),
      'cursor-a',
      500,
      expect.anything()
    )
    expect(mocks.getMappedClaimItemsByClaimId).toHaveBeenCalledWith(
      expect.anything(),
      ['claim-1'],
      ['food']
    )
  })

  it('returns 400 with Content-Disposition set when mapping config is missing', async () => {
    mocks.resolveBcExpenseExportContext.mockResolvedValue({
      ok: false,
      status: 400,
      message: 'Expense type account mappings are not configured.',
    })

    const response = await GET(
      new Request('http://localhost:3000/approved-history/bc-expense-export')
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
  })

  it('returns 401 for unauthenticated requests', async () => {
    mocks.resolveBcExpenseExportContext.mockResolvedValue({
      ok: false,
      status: 401,
      message: 'Unauthorized request.',
    })

    const response = await GET(
      new Request('http://localhost:3000/approved-history/bc-expense-export')
    )

    expect(response.status).toBe(401)
  })

  it('supports POST requests', async () => {
    mocks.getFinanceHistoryPageForExport.mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
    })

    const response = await POST(
      new Request('http://localhost:3000/approved-history/bc-expense-export', {
        method: 'POST',
      })
    )
    expect(response.status).toBe(200)
  })

  it('returns 400 with Content-Disposition set when the context resolver throws (e.g. invalid filter validation)', async () => {
    mocks.resolveBcExpenseExportContext.mockRejectedValue(
      new Error('Invalid date range.')
    )

    const response = await GET(
      new Request('http://localhost:3000/approved-history/bc-expense-export')
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
    expect(await response.text()).toBe('Invalid date range.')
  })
})
