import { describe, expect, it } from 'vitest'

import {
  buildPathWithSearchParams,
  createNonEmptySearchParams,
  getFirstSearchParamValue,
  toSortedQueryString,
} from '@/lib/utils/search-params'

describe('search params utilities', () => {
  it('picks first value from repeated query entries', () => {
    expect(getFirstSearchParamValue(['first', 'second'])).toBe('first')
    expect(getFirstSearchParamValue('value')).toBe('value')
    expect(getFirstSearchParamValue(undefined)).toBeNull()
  })

  it('drops empty query values while preserving populated ones', () => {
    const params = createNonEmptySearchParams({
      employeeName: '',
      actorFilter: 'all',
      claimDateFrom: '2026-03-01',
    })

    expect(params.get('employeeName')).toBeNull()
    expect(params.get('actorFilter')).toBe('all')
    expect(params.get('claimDateFrom')).toBe('2026-03-01')
  })

  it('creates deterministic query ordering for canonical redirects', () => {
    const left = new URLSearchParams('b=2&a=1')
    const right = new URLSearchParams('a=1&b=2')

    expect(toSortedQueryString(left)).toBe(toSortedQueryString(right))
  })

  it('builds path with query string only when params are present', () => {
    expect(buildPathWithSearchParams('/finance', new URLSearchParams())).toBe(
      '/finance'
    )

    expect(
      buildPathWithSearchParams('/finance', new URLSearchParams('a=1'))
    ).toBe('/finance?a=1')
  })
})
