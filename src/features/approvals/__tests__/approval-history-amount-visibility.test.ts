import { describe, expect, it } from 'vitest'

import { canViewApprovalHistoryAmount } from '@/features/approvals/utils/amount-visibility'

describe('canViewApprovalHistoryAmount', () => {
  it('returns true when approver access is granted', () => {
    expect(canViewApprovalHistoryAmount(true)).toBe(true)
  })

  it('returns false when approver access is denied', () => {
    expect(canViewApprovalHistoryAmount(false)).toBe(false)
  })
})
