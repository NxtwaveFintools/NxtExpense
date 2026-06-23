import { describe, expect, it } from 'vitest'

import { QUERY_GC_TIME, QUERY_STALE_TIME } from '../query-config'

// These tiers replace scattered millisecond literals across the React Query
// call sites. The values are pinned here so that swapping a literal for a tier
// is provably behaviour-identical.
describe('query-config', () => {
  it('defines stale-time tiers in milliseconds', () => {
    expect(QUERY_STALE_TIME.REALTIME).toBe(30_000)
    expect(QUERY_STALE_TIME.SHORT).toBe(60_000)
    expect(QUERY_STALE_TIME.MEDIUM).toBe(5 * 60 * 1000)
  })

  it('defines gc-time tiers in milliseconds', () => {
    expect(QUERY_GC_TIME.SHORT).toBe(2 * 60 * 1000)
    expect(QUERY_GC_TIME.MEDIUM).toBe(5 * 60 * 1000)
    expect(QUERY_GC_TIME.LONG).toBe(10 * 60 * 1000)
  })

  it('orders stale-time tiers from freshest to stalest', () => {
    expect(QUERY_STALE_TIME.REALTIME).toBeLessThan(QUERY_STALE_TIME.SHORT)
    expect(QUERY_STALE_TIME.SHORT).toBeLessThan(QUERY_STALE_TIME.MEDIUM)
  })

  it('orders gc-time tiers from shortest to longest retention', () => {
    expect(QUERY_GC_TIME.SHORT).toBeLessThan(QUERY_GC_TIME.MEDIUM)
    expect(QUERY_GC_TIME.MEDIUM).toBeLessThan(QUERY_GC_TIME.LONG)
  })
})
