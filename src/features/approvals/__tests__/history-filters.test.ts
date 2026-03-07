import { describe, expect, it } from 'vitest'

import {
  addApprovalFiltersToParams,
  buildApprovalHistoryCsv,
  normalizeApprovalHistoryFilters,
} from '@/features/approvals/utils/history-filters'

describe('approval history filter utilities', () => {
  it('normalizes DD/MM/YYYY input into ISO dates', () => {
    const normalized = normalizeApprovalHistoryFilters({
      employeeName: '  John  ',
      actorFilter: 'finance',
      claimDateFrom: '07/03/2026',
      claimDateTo: '08/03/2026',
      hodApprovedFrom: '01/03/2026',
      hodApprovedTo: '02/03/2026',
      financeApprovedFrom: '03/03/2026',
      financeApprovedTo: '04/03/2026',
    })

    expect(normalized).toEqual({
      employeeName: 'John',
      actorFilter: 'finance',
      claimDateFrom: '2026-03-07',
      claimDateTo: '2026-03-08',
      hodApprovedFrom: '2026-03-01',
      hodApprovedTo: '2026-03-02',
      financeApprovedFrom: '2026-03-03',
      financeApprovedTo: '2026-03-04',
    })
  })

  it('supports ISO date input from calendar pickers', () => {
    const normalized = normalizeApprovalHistoryFilters({
      actorFilter: 'all',
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
      actorFilter: 'finance',
      claimDateFrom: '2026-03-01',
      claimDateTo: '2026-03-07',
      hodApprovedFrom: '2026-03-01',
      hodApprovedTo: '2026-03-07',
      financeApprovedFrom: '2026-03-02',
      financeApprovedTo: '2026-03-08',
    })

    expect(params.get('employeeName')).toBe('Alex')
    expect(params.get('actorFilter')).toBe('finance')
    expect(params.get('claimDateFrom')).toBe('2026-03-01')
    expect(params.get('claimDateTo')).toBe('2026-03-07')
    expect(params.get('hodApprovedFrom')).toBe('2026-03-01')
    expect(params.get('hodApprovedTo')).toBe('2026-03-07')
    expect(params.get('financeApprovedFrom')).toBe('2026-03-02')
    expect(params.get('financeApprovedTo')).toBe('2026-03-08')
  })

  it('builds CSV output with formatted dates and quoted values', () => {
    const csv = buildApprovalHistoryCsv([
      {
        actionId: 'action-1',
        claimId: 'claim-1',
        claimNumber: 'CLM-001',
        claimDate: '2026-03-07',
        workLocation: 'Field - Outstation',
        totalAmount: 850,
        claimStatus: 'issued',
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
    expect(csv).toContain('"CLM-001"')
    expect(csv).toContain('"07/03/2026"')
    expect(csv).toContain('"finance issued"')
  })
})
