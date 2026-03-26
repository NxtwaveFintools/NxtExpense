import { describe, expect, it } from 'vitest'

import {
  addApprovalFiltersToParams,
  buildApprovalHistoryCsv,
  normalizeApprovalHistoryFilters,
} from '@/features/approvals/utils/history-filters'

const VALID_STATUS_ID = '3ae9b558-c006-427d-8ce6-13057d438d17'

describe('approval history filter utilities', () => {
  it('normalizes DD/MM/YYYY input into ISO dates', () => {
    const normalized = normalizeApprovalHistoryFilters({
      employeeName: '  John  ',
      claimDateFrom: '07/03/2026',
      claimDateTo: '08/03/2026',
      amountOperator: 'gte',
      amountValue: '200',
      locationType: 'base',
      claimDateSort: 'asc',
      hodApprovedFrom: '01/03/2026',
      hodApprovedTo: '02/03/2026',
      financeApprovedFrom: '03/03/2026',
      financeApprovedTo: '04/03/2026',
    })

    expect(normalized).toEqual({
      employeeName: 'John',
      claimStatus: null,
      claimDateFrom: '2026-03-07',
      claimDateTo: '2026-03-08',
      amountOperator: 'gte',
      amountValue: 200,
      locationType: 'base',
      claimDateSort: 'asc',
      hodApprovedFrom: '2026-03-01',
      hodApprovedTo: '2026-03-02',
      financeApprovedFrom: '2026-03-03',
      financeApprovedTo: '2026-03-04',
    })
  })

  it('supports ISO date input from calendar pickers', () => {
    const normalized = normalizeApprovalHistoryFilters({
      claimDateFrom: '2026-03-07',
      claimDateTo: '2026-03-08',
    })

    expect(normalized.claimDateFrom).toBe('2026-03-07')
    expect(normalized.claimDateTo).toBe('2026-03-08')
  })

  it('throws on invalid date format', () => {
    expect(() =>
      normalizeApprovalHistoryFilters({
        claimDateFrom: '03-07-2026',
      })
    ).toThrowError('Claim date from must be in DD/MM/YYYY format.')
  })

  it('adds all filter params for finance-focused filtering', () => {
    const params = addApprovalFiltersToParams(new URLSearchParams(), {
      employeeName: 'Alex',
      claimStatus: VALID_STATUS_ID,
      claimDateFrom: '2026-03-01',
      claimDateTo: '2026-03-31',
      amountOperator: 'eq',
      amountValue: 350,
      locationType: 'outstation',
      claimDateSort: 'asc',
      hodApprovedFrom: '2026-03-01',
      hodApprovedTo: '2026-03-07',
      financeApprovedFrom: '2026-03-02',
      financeApprovedTo: '2026-03-08',
    })

    expect(params.get('employeeName')).toBe('Alex')
    expect(params.get('claimStatus')).toBe(VALID_STATUS_ID)
    expect(params.get('claimDateFrom')).toBe('2026-03-01')
    expect(params.get('claimDateTo')).toBe('2026-03-31')
    expect(params.get('amountOperator')).toBe('eq')
    expect(params.get('amountValue')).toBe('350')
    expect(params.get('locationType')).toBe('outstation')
    expect(params.get('claimDateSort')).toBe('asc')
    expect(params.get('hodApprovedFrom')).toBe('2026-03-01')
    expect(params.get('hodApprovedTo')).toBe('2026-03-07')
    expect(params.get('financeApprovedFrom')).toBe('2026-03-02')
    expect(params.get('financeApprovedTo')).toBe('2026-03-08')
  })

  it('omits query params when filters are at default values', () => {
    const params = addApprovalFiltersToParams(new URLSearchParams(), {
      employeeName: null,
      claimStatus: null,
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
    })

    expect(params.toString()).toBe('')
  })

  it('builds CSV output with formatted dates and quoted values', () => {
    const csv = buildApprovalHistoryCsv([
      {
        actionId: 'action-1',
        claimId: 'claim-1',
        claimNumber: 'CLAIM-001',
        claimDate: '2026-03-07',
        workLocation: 'Field - Outstation',
        totalAmount: 850,
        claimStatusName: 'Issued',
        claimStatusDisplayColor: 'green',
        ownerName: 'Alex',
        ownerDesignation: 'State Business Head',
        actorEmail: 'finance@nxtwave.co.in',
        actorDesignation: 'Finance',
        action: 'finance_issued',
        approvalLevel: null,
        notes: null,
        actedAt: '2026-03-07T10:30:00.000Z',
        hodApprovedAt: '2026-03-07T08:00:00.000Z',
        financeApprovedAt: '2026-03-07T10:30:00.000Z',
      },
    ])

    expect(csv).toContain('"Claim ID"')
    expect(csv).toContain('"CLAIM-001"')
    expect(csv).toContain('"07/03/2026"')
    expect(csv).toContain('"finance issued"')
  })

  it('keeps defaults for omitted optional filters', () => {
    const result = normalizeApprovalHistoryFilters({})
    expect(result.employeeName).toBeNull()
    expect(result.claimStatus).toBeNull()
    expect(result.claimDateFrom).toBeNull()
    expect(result.claimDateTo).toBeNull()
    expect(result.amountOperator).toBe('lte')
    expect(result.amountValue).toBeNull()
    expect(result.locationType).toBeNull()
    expect(result.claimDateSort).toBe('desc')
  })
})
