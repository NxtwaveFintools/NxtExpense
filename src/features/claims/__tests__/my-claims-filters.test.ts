import { describe, expect, it } from 'vitest'

import {
  addMyClaimsFiltersToParams,
  normalizeMyClaimsFilters,
} from '@/features/claims/utils/filters'

describe('my claims filters', () => {
  it('normalizes date range filters to ISO format', () => {
    const filters = normalizeMyClaimsFilters({
      claimDateFrom: '07/03/2026',
      claimDateTo: '08/03/2026',
    })

    expect(filters.claimDateFrom).toBe('2026-03-07')
    expect(filters.claimDateTo).toBe('2026-03-08')
  })

  it('throws when from date is later than to date', () => {
    expect(() =>
      normalizeMyClaimsFilters({
        claimDateFrom: '2026-03-09',
        claimDateTo: '2026-03-08',
      })
    ).toThrowError('From Date cannot be later than To Date')
  })

  it('serializes date range fields into query params', () => {
    const params = addMyClaimsFiltersToParams(
      new URLSearchParams(),
      normalizeMyClaimsFilters({
        claimStatus: '2ecadcf4-f4e4-4e3f-a709-c4f2a9207abf',
        workLocation: 'fdb35934-c594-4ef3-a86b-8967f7dca3f3',
        claimDateFrom: '2026-03-01',
        claimDateTo: '2026-03-31',
      })
    )

    expect(params.get('claimStatus')).toBe(
      '2ecadcf4-f4e4-4e3f-a709-c4f2a9207abf'
    )
    expect(params.get('workLocation')).toBe(
      'fdb35934-c594-4ef3-a86b-8967f7dca3f3'
    )
    expect(params.get('claimDateFrom')).toBe('2026-03-01')
    expect(params.get('claimDateTo')).toBe('2026-03-31')
  })
})
