import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolvePaymentJournalsExportContext: vi.fn(),
  getFinancePaymentJournalTotals: vi.fn(),
  runCsvExport: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/finance/server/payment-journals-export-context', () => ({
  resolvePaymentJournalsExportContext:
    mocks.resolvePaymentJournalsExportContext,
}))

vi.mock('@/features/finance/data/queries', () => ({
  getFinancePaymentJournalTotals: mocks.getFinancePaymentJournalTotals,
}))

vi.mock('@/lib/utils/run-csv-export', () => ({
  runCsvExport: mocks.runCsvExport,
}))

import {
  GET,
  POST,
} from '@/app/(app)/approved-history/payment-journals-export/route'

const DEFAULTS = {
  documentType: 'Payment',
  accountType: 'Employee',
  employeeTransactionType: 'ADVANCE',
  cashFlowOptions: 'Petty cash & Reimbursements',
  typeOfPayment: '100% Payment after Service / Goods delivery',
  description: 'Reimbursements',
  paymentMethodCode: 'IMPS',
  balAccountType: 'Bank Account',
  balAccountNo: 'IDFC 2012',
  programCode: 'NIAT',
  subProductCode: 'NIAT362',
  responsibleDepCode: 'PRE-SALES',
  beneficiaryDepCode: 'PRE-SALES',
}

describe('approved-history Payment Journals export route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'finance@nxtwave.co.in' } },
        }),
      },
    })

    mocks.resolvePaymentJournalsExportContext.mockResolvedValue({
      ok: true,
      context: {
        employee: { id: 'finance-1' },
        filters: { claimStatus: null },
        defaults: DEFAULTS,
      },
    })

    mocks.getFinancePaymentJournalTotals.mockResolvedValue(
      new Map([['NW0004545', 3450.5]])
    )

    mocks.runCsvExport.mockReturnValue(
      new Response('header\nrow', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    )
  })

  it('streams one row per employee from the DB-aggregated totals in a single fetchPage call', async () => {
    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export?requestId=req-1'
      )
    )

    expect(response.status).toBe(200)
    expect(mocks.runCsvExport).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.stringContaining('payment-journals-'),
      }),
      'req-1'
    )

    const [recipe] = mocks.runCsvExport.mock.calls[0]
    const page = await recipe.fetchPage(null, 500)

    expect(page.hasNextPage).toBe(false)
    expect(page.data).toEqual([
      [
        '',
        'Payment',
        '',
        '',
        'Employee',
        'NW0004545',
        '0',
        '0',
        'ADVANCE',
        'Petty cash & Reimbursements',
        '100% Payment after Service / Goods delivery',
        '',
        '0',
        'Reimbursements',
        'IMPS',
        '3450.50',
        'Bank Account',
        'IDFC 2012',
        'NIAT',
        'NIAT362',
        'PRE-SALES',
        'PRE-SALES',
      ],
    ])
    expect(mocks.getFinancePaymentJournalTotals).toHaveBeenCalledTimes(1)
  })

  it('returns 400 with Content-Disposition set when the export profile is missing', async () => {
    mocks.resolvePaymentJournalsExportContext.mockResolvedValue({
      ok: false,
      status: 400,
      message: 'Payment Journals export profile is not configured.',
    })

    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export'
      )
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
  })

  it('returns 401 for unauthenticated requests', async () => {
    mocks.resolvePaymentJournalsExportContext.mockResolvedValue({
      ok: false,
      status: 401,
      message: 'Unauthorized request.',
    })

    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export'
      )
    )

    expect(response.status).toBe(401)
  })

  it('supports POST requests', async () => {
    const response = await POST(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export',
        { method: 'POST' }
      )
    )
    expect(response.status).toBe(200)
  })

  it('returns 400 with Content-Disposition set when the context resolver throws (e.g. invalid filter validation)', async () => {
    mocks.resolvePaymentJournalsExportContext.mockRejectedValue(
      new Error('Invalid date range.')
    )

    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export'
      )
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
    expect(await response.text()).toBe('Invalid date range.')
  })
})
