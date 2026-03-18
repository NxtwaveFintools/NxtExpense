import { describe, expect, it } from 'vitest'

import {
  normalizeApprovalHistoryFilters,
  buildApprovalHistoryCsv,
} from '@/features/approvals/utils/history-filters'

const VALID_STATUS_ID = '7a0068ba-39c3-4229-b6f5-88559ace4e77'

describe('normalizeApprovalHistoryFilters', () => {
  it('normalizes empty input to defaults', () => {
    const result = normalizeApprovalHistoryFilters({})
    expect(result.employeeName).toBeNull()
    expect(result.claimStatus).toBeNull()
    expect(result.claimDate).toBeNull()
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
      claimStatus: '',
      claimDate: '',
      hodApprovedFrom: '',
      hodApprovedTo: '',
      financeApprovedFrom: '',
      financeApprovedTo: '',
    })
    expect(result.employeeName).toBeNull()
    expect(result.claimStatus).toBeNull()
    expect(result.claimDate).toBeNull()
    expect(result.hodApprovedFrom).toBeNull()
    expect(result.hodApprovedTo).toBeNull()
    expect(result.financeApprovedFrom).toBeNull()
    expect(result.financeApprovedTo).toBeNull()
  })

  it('converts DD/MM/YYYY to ISO', () => {
    const result = normalizeApprovalHistoryFilters({
      claimDate: '01/03/2026',
    })
    expect(result.claimDate).toBe('2026-03-01')
  })

  it('preserves ISO dates', () => {
    const result = normalizeApprovalHistoryFilters({
      hodApprovedFrom: '2026-03-01',
      hodApprovedTo: '2026-03-07',
    })
    expect(result.hodApprovedFrom).toBe('2026-03-01')
    expect(result.hodApprovedTo).toBe('2026-03-07')
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
      normalizeApprovalHistoryFilters({ claimDate: '2026/03/01' })
    ).toThrow()
  })

  it('applies all filters simultaneously', () => {
    const result = normalizeApprovalHistoryFilters({
      employeeName: 'Yohan',
      claimStatus: VALID_STATUS_ID,
      claimDate: '2026-03-01',
      hodApprovedFrom: '2026-03-02',
      hodApprovedTo: '2026-03-06',
      financeApprovedFrom: '2026-03-03',
      financeApprovedTo: '2026-03-05',
    })
    expect(result.employeeName).toBe('Yohan')
    expect(result.claimStatus).toBe(VALID_STATUS_ID)
    expect(result.claimDate).toBe('2026-03-01')
    expect(result.hodApprovedFrom).toBe('2026-03-02')
    expect(result.hodApprovedTo).toBe('2026-03-06')
    expect(result.financeApprovedFrom).toBe('2026-03-03')
    expect(result.financeApprovedTo).toBe('2026-03-05')
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
        claimNumber: 'CLAIM-001',
        claimDate: '2026-03-06T00:00:00.000Z',
        workLocation: 'Field - Base Location',
        totalAmount: 300,
        claimStatusName: 'Issued',
        claimStatusDisplayColor: 'green',
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
    expect(lines[1]).toContain('CLAIM-001')
    expect(lines[1]).toContain('Yohan Mutluri')
    expect(lines[1]).toContain('Rs. 300.00')
  })

  it('escapes fields with commas', () => {
    const csv = buildApprovalHistoryCsv([
      {
        actionId: 'act-1',
        claimId: 'claim-1',
        claimNumber: 'CLAIM-001',
        claimDate: '2026-03-06T00:00:00.000Z',
        workLocation: 'Field - Base Location',
        totalAmount: 300,
        claimStatusName: 'Issued',
        claimStatusDisplayColor: 'green',
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
