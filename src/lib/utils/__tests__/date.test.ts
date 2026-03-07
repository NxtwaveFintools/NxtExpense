import { describe, expect, it } from 'vitest'

import {
  formatDate,
  formatDatetime,
  isValidClaimDate,
  parseDateDDMMYYYY,
  toISODate,
} from '@/lib/utils/date'

describe('date utils', () => {
  it('parses DD/MM/YYYY date correctly', () => {
    const parsed = parseDateDDMMYYYY('06/03/2026')
    expect(toISODate(parsed)).toBe('2026-03-06')
  })

  it('formats date and datetime correctly', () => {
    expect(formatDate('2026-03-06')).toBe('06/03/2026')
    expect(formatDatetime('2026-03-06T14:30:00.000Z')).toBe(
      '06/03/2026 08:00 PM'
    )
  })

  it('rejects invalid calendar dates', () => {
    expect(() => parseDateDDMMYYYY('31/02/2026')).toThrowError(
      'Invalid calendar date.'
    )
  })

  it('rejects future claim dates', () => {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    expect(isValidClaimDate(tomorrow)).toBe(false)
  })
})
