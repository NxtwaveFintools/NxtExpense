import { describe, expect, it } from 'vitest'

import { canViewApprovalHistoryAmount } from '@/features/approvals/utils/amount-visibility'

describe('canViewApprovalHistoryAmount', () => {
  it('returns true for Program Manager', () => {
    expect(canViewApprovalHistoryAmount('Program Manager')).toBe(true)
  })

  it('returns true for State Business Head', () => {
    expect(canViewApprovalHistoryAmount('State Business Head')).toBe(true)
  })

  it('returns true for Zonal Business Head (HOD scope)', () => {
    expect(canViewApprovalHistoryAmount('Zonal Business Head')).toBe(true)
  })

  it('returns false for non-HOD designations', () => {
    expect(canViewApprovalHistoryAmount('Area Business Head')).toBe(false)
  })

  it('returns true for valid designation with mixed casing and spaces', () => {
    expect(canViewApprovalHistoryAmount('  Head Of Department  ')).toBe(true)
  })

  it('returns false for null and undefined designation values', () => {
    expect(canViewApprovalHistoryAmount(null)).toBe(false)
    expect(canViewApprovalHistoryAmount(undefined)).toBe(false)
  })
})
