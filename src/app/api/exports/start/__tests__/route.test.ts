import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resolveMyClaimsExportPreflight: vi.fn(),
  resolveApprovalHistoryExportPreflight: vi.fn(),
  resolveFinanceHistoryExportPreflight: vi.fn(),
  resolveFinancePendingExportPreflight: vi.fn(),
  resolveBcExpenseExportPreflight: vi.fn(),
  resolvePaymentJournalsExportPreflight: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/claims/server/claims-export-context', () => ({
  resolveMyClaimsExportPreflight: mocks.resolveMyClaimsExportPreflight,
}))

vi.mock('@/features/approvals/server/approval-history-export-context', () => ({
  resolveApprovalHistoryExportPreflight:
    mocks.resolveApprovalHistoryExportPreflight,
}))

vi.mock('@/features/finance/server/finance-history-export-context', () => ({
  resolveFinanceHistoryExportPreflight:
    mocks.resolveFinanceHistoryExportPreflight,
}))

vi.mock('@/features/finance/server/finance-pending-export-context', () => ({
  resolveFinancePendingExportPreflight:
    mocks.resolveFinancePendingExportPreflight,
}))

vi.mock('@/features/finance/server/bc-expense-export-context', () => ({
  resolveBcExpenseExportPreflight: mocks.resolveBcExpenseExportPreflight,
}))

vi.mock('@/features/finance/server/payment-journals-export-context', () => ({
  resolvePaymentJournalsExportPreflight:
    mocks.resolvePaymentJournalsExportPreflight,
}))

import { POST } from '@/app/api/exports/start/route'

describe('POST /api/exports/start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { email: 'a@nxtwave.co.in' } } }),
      },
    })
  })

  it('returns 400 for an unknown export type', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: JSON.stringify({ exportType: 'not-a-real-type', query: '' }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Unknown export type.' })
  })

  it('returns 400 for an invalid JSON body', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: 'not json',
      })
    )

    expect(response.status).toBe(400)
  })

  it('propagates a preflight failure as { error, status }', async () => {
    mocks.resolveMyClaimsExportPreflight.mockResolvedValue({
      ok: false,
      status: 403,
      message: 'Claims access is required.',
    })

    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: JSON.stringify({ exportType: 'my-claims', query: '' }),
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'Claims access is required.',
    })
  })

  it('returns { ok: true } on success', async () => {
    mocks.resolveMyClaimsExportPreflight.mockResolvedValue({ ok: true })

    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: JSON.stringify({
          exportType: 'my-claims',
          query: '?claimStatus=approved',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })

    const [, , searchParamsArg] =
      mocks.resolveMyClaimsExportPreflight.mock.calls[0]
    expect(searchParamsArg.get('claimStatus')).toBe('approved')
  })

  it('routes approval-history exports to the approvals preflight resolver', async () => {
    mocks.resolveApprovalHistoryExportPreflight.mockResolvedValue({
      ok: true,
    })

    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: JSON.stringify({ exportType: 'approval-history', query: '' }),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.resolveApprovalHistoryExportPreflight).toHaveBeenCalledTimes(1)
    expect(mocks.resolveMyClaimsExportPreflight).not.toHaveBeenCalled()
  })

  it('routes finance-history exports to the finance-history preflight resolver', async () => {
    mocks.resolveFinanceHistoryExportPreflight.mockResolvedValue({ ok: true })

    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: JSON.stringify({ exportType: 'finance-history', query: '' }),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.resolveFinanceHistoryExportPreflight).toHaveBeenCalledTimes(1)
  })

  it('routes finance-pending exports to the finance-pending preflight resolver', async () => {
    mocks.resolveFinancePendingExportPreflight.mockResolvedValue({ ok: true })

    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: JSON.stringify({ exportType: 'finance-pending', query: '' }),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.resolveFinancePendingExportPreflight).toHaveBeenCalledTimes(1)
  })

  it('routes bc-expense exports to the bc-expense preflight resolver', async () => {
    mocks.resolveBcExpenseExportPreflight.mockResolvedValue({ ok: true })

    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: JSON.stringify({ exportType: 'bc-expense', query: '' }),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.resolveBcExpenseExportPreflight).toHaveBeenCalledTimes(1)
  })

  it('routes payment-journals exports to the payment-journals preflight resolver', async () => {
    mocks.resolvePaymentJournalsExportPreflight.mockResolvedValue({
      ok: true,
    })

    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: JSON.stringify({ exportType: 'payment-journals', query: '' }),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.resolvePaymentJournalsExportPreflight).toHaveBeenCalledTimes(1)
  })

  it('returns a clean 400 JSON error instead of crashing when a preflight resolver throws (e.g. invalid filter validation)', async () => {
    mocks.resolveMyClaimsExportPreflight.mockRejectedValue(
      new Error('Invalid claim status filter.')
    )

    const response = await POST(
      new Request('http://localhost:3000/api/exports/start', {
        method: 'POST',
        body: JSON.stringify({
          exportType: 'my-claims',
          query: '?claimStatus=bogus',
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Invalid claim status filter.',
    })
  })
})
