import { describe, expect, it } from 'vitest'

import { canDownloadClaimsCsv } from '@/features/claims/utils/export-permissions'

describe('canDownloadClaimsCsv', () => {
  it('blocks Student Relationship Officer exports', () => {
    expect(canDownloadClaimsCsv('Student Relationship Officer')).toBe(false)
  })

  it('blocks Area Business Head exports', () => {
    expect(canDownloadClaimsCsv('Area Business Head')).toBe(false)
  })

  it('allows other designations', () => {
    expect(canDownloadClaimsCsv('State Business Head')).toBe(true)
    expect(canDownloadClaimsCsv('Program Manager')).toBe(true)
  })

  it('allows empty designation safely', () => {
    expect(canDownloadClaimsCsv(null)).toBe(true)
    expect(canDownloadClaimsCsv(undefined)).toBe(true)
  })
})
