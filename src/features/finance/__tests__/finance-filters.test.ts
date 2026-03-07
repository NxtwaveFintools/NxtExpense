import { describe, expect, it } from 'vitest'

import {
  hasFinanceClaimFilters,
  normalizeFinanceFilters,
  toIstDayEnd,
  toIstDayStart,
} from '@/features/finance/utils/filters'

describe('finance filter utilities', () => {
  it('normalizes finance filter inputs from query params', () => {
    const normalized = normalizeFinanceFilters({
      employeeName: '  Rahul  ',
      claimNumber: ' CLM-001 ',
      ownerDesignation: 'Program Manager',
      hodApproverEmail: 'Mansoor@Nxtwave.Co.In',
      claimStatus: 'finance_review',
      workLocation: 'Field - Base Location',
      resubmittedOnly: 'true',
      actionFilter: 'finance_rejected',
      claimDateFrom: '2026-03-01',
      claimDateTo: '2026-03-10',
      actionDateFrom: '07/03/2026',
      actionDateTo: '08/03/2026',
    })

    expect(normalized).toEqual({
      employeeName: 'Rahul',
      claimNumber: 'CLM-001',
      ownerDesignation: 'Program Manager',
      hodApproverEmail: 'Mansoor@Nxtwave.Co.In',
      claimStatus: 'finance_review',
      workLocation: 'Field - Base Location',
      resubmittedOnly: true,
      actionFilter: 'finance_rejected',
      claimDateFrom: '2026-03-01',
      claimDateTo: '2026-03-10',
      actionDateFrom: '2026-03-07',
      actionDateTo: '2026-03-08',
    })
  })

  it('detects whether claim-level filters are active', () => {
    expect(
      hasFinanceClaimFilters(
        normalizeFinanceFilters({
          actionFilter: 'all',
        })
      )
    ).toBe(false)

    expect(
      hasFinanceClaimFilters(
        normalizeFinanceFilters({
          workLocation: 'Field - Outstation',
        })
      )
    ).toBe(true)

    expect(
      hasFinanceClaimFilters(
        normalizeFinanceFilters({
          resubmittedOnly: 'true',
        })
      )
    ).toBe(true)
  })

  it('converts date-only filters into IST day boundaries for strict DB filtering', () => {
    expect(toIstDayStart('2026-03-07')).toBe('2026-03-07T00:00:00+05:30')
    expect(toIstDayEnd('2026-03-07')).toBe('2026-03-07T23:59:59.999+05:30')
  })

  it('rejects invalid action date ranges', () => {
    expect(() =>
      normalizeFinanceFilters({
        actionDateFrom: '2026-03-09',
        actionDateTo: '2026-03-08',
      })
    ).toThrowError('Action date to must be on or after action date from.')
  })

  // ─── FINANCE-001/002/003 Regression: empty hodApproverEmail must NOT block filters ─

  it('does NOT throw when hodApproverEmail is empty string (FINANCE regression)', () => {
    // Before fix: '' fails z.string().trim().email() because empty string is
    // not a valid email, causing the entire schema parse to fail and ALL
    // filters (including employeeName, claimNumber) to be reset.
    expect(() =>
      normalizeFinanceFilters({
        employeeName: 'Yohan',
        hodApproverEmail: '',
      })
    ).not.toThrow()
  })

  it('preserves employeeName when hodApproverEmail is empty string (FINANCE-002 regression)', () => {
    // Exact scenario: user types name and submits, HOD dropdown is blank
    const result = normalizeFinanceFilters({
      employeeName: 'Yohan',
      claimNumber: '',
      ownerDesignation: '',
      hodApproverEmail: '',
      claimStatus: '',
      workLocation: '',
    })
    expect(result.employeeName).toBe('Yohan')
    expect(result.hodApproverEmail).toBeNull()
    expect(result.claimNumber).toBeNull()
  })

  it('preserves claimNumber when hodApproverEmail is empty string (FINANCE-001 regression)', () => {
    // User searches by claim number, HOD dropdown is blank
    const result = normalizeFinanceFilters({
      claimNumber: 'CLM-NW0000282-260305-0001',
      hodApproverEmail: '',
    })
    expect(result.claimNumber).toBe('CLM-NW0000282-260305-0001')
    expect(result.hodApproverEmail).toBeNull()
  })

  it('treats empty hodApproverEmail as null (no filter)', () => {
    const result = normalizeFinanceFilters({ hodApproverEmail: '' })
    expect(result.hodApproverEmail).toBeNull()
  })

  it('does NOT throw when all Finance form fields are empty strings', () => {
    expect(() =>
      normalizeFinanceFilters({
        employeeName: '',
        claimNumber: '',
        ownerDesignation: '',
        hodApproverEmail: '',
        claimStatus: '',
        workLocation: '',
        actionFilter: 'all',
        claimDateFrom: '',
        claimDateTo: '',
        actionDateFrom: '',
        actionDateTo: '',
      })
    ).not.toThrow()
  })

  it('does NOT throw when actionFilter is empty string (converted to default "all")', () => {
    expect(() => normalizeFinanceFilters({ actionFilter: '' })).not.toThrow()
  })
})
