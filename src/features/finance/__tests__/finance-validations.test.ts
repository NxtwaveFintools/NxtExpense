import { describe, expect, it } from 'vitest'

import {
  bulkFinanceActionSchema,
  financeActionSchema,
  financeFiltersSchema,
} from '@/features/finance/validations'

const VALID_UUID = '5db22d75-b209-4f30-b5c8-f4f27ebee9e8'

describe('finance validation schemas', () => {
  it('accepts issued action without notes', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'issued',
    })

    expect(parsed.success).toBe(true)
  })

  it('requires notes for finance_rejected action', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'finance_rejected',
      notes: '   ',
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toBe(
      'Notes are required for this finance action.'
    )
  })

  it('rejects reopened action after feature removal', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'reopened',
    })

    expect(parsed.success).toBe(false)
  })

  it('requires notes for bulk finance_rejected action', () => {
    const parsed = bulkFinanceActionSchema.safeParse({
      claimIds: [VALID_UUID],
      action: 'finance_rejected',
      notes: '',
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toBe(
      'Rejection notes are required for bulk reject.'
    )
  })

  it('accepts status/location finance filters', () => {
    const parsed = financeFiltersSchema.safeParse({
      claimStatus: 'finance_review',
      workLocation: 'Field - Base Location',
      dateFilterField: 'claim_date',
      dateFrom: '07/03/2026',
    })

    expect(parsed.success).toBe(true)
  })
})
