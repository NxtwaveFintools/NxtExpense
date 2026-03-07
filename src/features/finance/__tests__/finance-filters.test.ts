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
          ownerDesignation: 'State Business Head',
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
})
