import { describe, expect, it } from 'vitest'

import { getClaimStatusDisplayLabel } from '@/lib/utils/claim-status'

describe('claim status helpers', () => {
  it('returns provided status name for approved status code', () => {
    expect(getClaimStatusDisplayLabel('APPROVED', 'Payment Issued')).toBe(
      'Payment Issued'
    )
  })

  it('returns status name without remapping legacy labels', () => {
    expect(
      getClaimStatusDisplayLabel('L3_PENDING_FINANCE_REVIEW', 'Approved')
    ).toBe('Approved')
  })

  it('returns status name when non-empty', () => {
    expect(getClaimStatusDisplayLabel('L1_PENDING', 'L1 Pending')).toBe(
      'L1 Pending'
    )
  })

  it('falls back to status code when status name is blank', () => {
    expect(getClaimStatusDisplayLabel('REJECTED', '   ')).toBe('REJECTED')
  })

  it('returns empty string when both status code and name are missing', () => {
    expect(getClaimStatusDisplayLabel(null, undefined)).toBe('')
  })
})
