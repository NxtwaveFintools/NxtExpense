import { describe, expect, it } from 'vitest'

import {
  normalizeApprovalHistoryFilters,
  getDefaultApprovalActorFilter,
  buildApprovalHistoryCsv,
} from '@/features/approvals/utils/history-filters'

describe('normalizeApprovalHistoryFilters', () => {
  it('normalizes empty input to defaults', () => {
    const result = normalizeApprovalHistoryFilters({})
    expect(result.employeeName).toBeNull()
    expect(result.actorFilter).toBe('all')
    expect(result.claimDateFrom).toBeNull()
    expect(result.claimDateTo).toBeNull()
    expect(result.hodApprovedFrom).toBeNull()
    expect(result.hodApprovedTo).toBeNull()
    expect(result.financeApprovedFrom).toBeNull()
    expect(result.financeApprovedTo).toBeNull()
  })

  it('trims employee name', () => {
    const result = normalizeApprovalHistoryFilters({
      employeeName: '  Bhargavraj  ',
    })
    expect(result.employeeName).toBe('Bhargavraj')
  })

  it('normalizes empty strings to null', () => {
    const result = normalizeApprovalHistoryFilters({
      employeeName: '',
      claimDateFrom: '',
      claimDateTo: '',
      hodApprovedFrom: '',
      hodApprovedTo: '',
      financeApprovedFrom: '',
      financeApprovedTo: '',
    })
    expect(result.employeeName).toBeNull()
    expect(result.claimDateFrom).toBeNull()
    expect(result.claimDateTo).toBeNull()
    expect(result.hodApprovedFrom).toBeNull()
    expect(result.hodApprovedTo).toBeNull()
    expect(result.financeApprovedFrom).toBeNull()
    expect(result.financeApprovedTo).toBeNull()
  })

  it('converts DD/MM/YYYY to ISO', () => {
    const result = normalizeApprovalHistoryFilters({
      claimDateFrom: '01/03/2026',
      claimDateTo: '07/03/2026',
    })
    expect(result.claimDateFrom).toBe('2026-03-01')
    expect(result.claimDateTo).toBe('2026-03-07')
  })

  it('preserves ISO dates', () => {
    const result = normalizeApprovalHistoryFilters({
      hodApprovedFrom: '2026-03-01',
      hodApprovedTo: '2026-03-07',
    })
    expect(result.hodApprovedFrom).toBe('2026-03-01')
    expect(result.hodApprovedTo).toBe('2026-03-07')
  })

  it('defaults actorFilter to "all" when empty string', () => {
    const result = normalizeApprovalHistoryFilters({ actorFilter: '' })
    expect(result.actorFilter).toBe('all')
  })

  it('accepts valid actorFilter values', () => {
    for (const value of ['all', 'sbh', 'hod', 'finance'] as const) {
      const result = normalizeApprovalHistoryFilters({ actorFilter: value })
      expect(result.actorFilter).toBe(value)
    }
  })

  it('throws on inverted claim date range', () => {
    expect(() =>
      normalizeApprovalHistoryFilters({
        claimDateFrom: '2026-03-08',
        claimDateTo: '2026-03-01',
      })
    ).toThrow()
  })

  it('throws on inverted HOD date range', () => {
    expect(() =>
      normalizeApprovalHistoryFilters({
        hodApprovedFrom: '2026-03-08',
        hodApprovedTo: '2026-03-01',
      })
    ).toThrow()
  })

  it('throws on inverted finance date range', () => {
    expect(() =>
      normalizeApprovalHistoryFilters({
        financeApprovedFrom: '2026-03-08',
        financeApprovedTo: '2026-03-01',
      })
    ).toThrow()
  })

  it('throws on invalid date format', () => {
    expect(() =>
      normalizeApprovalHistoryFilters({ claimDateFrom: '2026/03/01' })
    ).toThrow()
  })

  it('applies all filters simultaneously', () => {
    const result = normalizeApprovalHistoryFilters({
      employeeName: 'Yohan',
      actorFilter: 'sbh',
      claimDateFrom: '2026-03-01',
      claimDateTo: '2026-03-07',
      hodApprovedFrom: '2026-03-02',
      hodApprovedTo: '2026-03-06',
      financeApprovedFrom: '2026-03-03',
      financeApprovedTo: '2026-03-05',
    })
    expect(result.employeeName).toBe('Yohan')
    expect(result.actorFilter).toBe('sbh')
    expect(result.claimDateFrom).toBe('2026-03-01')
    expect(result.claimDateTo).toBe('2026-03-07')
    expect(result.hodApprovedFrom).toBe('2026-03-02')
    expect(result.hodApprovedTo).toBe('2026-03-06')
    expect(result.financeApprovedFrom).toBe('2026-03-03')
    expect(result.financeApprovedTo).toBe('2026-03-05')
  })
})

describe('getDefaultApprovalActorFilter', () => {
  it('returns "sbh" for State Business Head', () => {
    expect(getDefaultApprovalActorFilter('State Business Head')).toBe('sbh')
  })

  it('returns "hod" for Program Manager', () => {
    expect(getDefaultApprovalActorFilter('Program Manager')).toBe('hod')
  })

  it('returns "hod" for Zonal Business Head', () => {
    expect(getDefaultApprovalActorFilter('Zonal Business Head')).toBe('hod')
  })

  it('returns "finance" for Finance', () => {
    expect(getDefaultApprovalActorFilter('Finance')).toBe('finance')
  })

  it('returns "all" for SRO', () => {
    expect(getDefaultApprovalActorFilter('Student Relationship Officer')).toBe(
      'all'
    )
  })

  it('returns "all" for BOA', () => {
    expect(getDefaultApprovalActorFilter('Business Operation Associate')).toBe(
      'all'
    )
  })

  it('returns "all" for ABH', () => {
    expect(getDefaultApprovalActorFilter('Area Business Head')).toBe('all')
  })

  it('returns "all" for null designation', () => {
    expect(getDefaultApprovalActorFilter(null)).toBe('all')
  })

  it('returns "all" for undefined designation', () => {
    expect(getDefaultApprovalActorFilter(undefined)).toBe('all')
  })
})

describe('buildApprovalHistoryCsv', () => {
  it('returns headers only for empty data', () => {
    const csv = buildApprovalHistoryCsv([])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('Claim ID')
    expect(lines[0]).toContain('Employee')
    expect(lines[0]).toContain('Total Amount')
    expect(lines[0]).toContain('Current Status')
  })

  it('generates correct CSV row with all fields', () => {
    const csv = buildApprovalHistoryCsv([
      {
        actionId: 'act-1',
        claimId: 'claim-1',
        claimNumber: 'CLM-001',
        claimDate: '2026-03-06T00:00:00.000Z',
        workLocation: 'Field - Base Location',
        totalAmount: 300,
        claimStatus: 'issued',
        ownerName: 'Yohan Mutluri',
        ownerDesignation: 'Student Relationship Officer',
        actorEmail: 'nagaraju.madugula@nxtwave.co.in',
        actorDesignation: 'State Business Head',
        action: 'approved',
        approvalLevel: 1,
        notes: 'OK',
        actedAt: '2026-03-06T09:00:00.000Z',
        hodApprovedAt: '2026-03-06T10:00:00.000Z',
        financeApprovedAt: '2026-03-07T10:00:00.000Z',
      },
    ])

    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('CLM-001')
    expect(lines[1]).toContain('Yohan Mutluri')
    expect(lines[1]).toContain('Rs. 300.00')
  })

  it('escapes fields with commas', () => {
    const csv = buildApprovalHistoryCsv([
      {
        actionId: 'act-1',
        claimId: 'claim-1',
        claimNumber: 'CLM-001',
        claimDate: '2026-03-06T00:00:00.000Z',
        workLocation: 'Field - Base Location',
        totalAmount: 300,
        claimStatus: 'issued',
        ownerName: 'User, With Comma',
        ownerDesignation: 'SRO',
        actorEmail: 'test@nxtwave.co.in',
        actorDesignation: null,
        action: 'approved',
        approvalLevel: 1,
        notes: null,
        actedAt: '2026-03-06T09:00:00.000Z',
        hodApprovedAt: null,
        financeApprovedAt: null,
      },
    ])

    // The name with comma should be properly escaped in quotes
    expect(csv).toContain('"User, With Comma"')
  })
})
