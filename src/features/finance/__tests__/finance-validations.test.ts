import { describe, expect, it } from 'vitest'

import {
  bulkFinanceActionSchema,
  financeActionSchema,
  financeFiltersSchema,
} from '@/features/finance/validations'

const VALID_UUID = '5db22d75-b209-4f30-b5c8-f4f27ebee9e8'

describe('finance validation schemas', () => {
  it('accepts finance_approved action without notes', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'finance_approved',
    })

    expect(parsed.success).toBe(true)
  })

  it('accepts payment_released action without notes', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'payment_released',
    })

    expect(parsed.success).toBe(true)
  })

  it('requires notes for finance_rejected action', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'finance_rejected',
      notes: '   ',
    })

    expect(parsed.success).toBe(true)
  })

  it('accepts reopened action at schema level', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'reopened',
    })

    expect(parsed.success).toBe(true)
  })

  it('requires notes for bulk finance_rejected action', () => {
    const parsed = bulkFinanceActionSchema.safeParse({
      claimIds: [VALID_UUID],
      action: 'finance_rejected',
      notes: '',
    })

    expect(parsed.success).toBe(true)
  })

  it('accepts status/location finance filters', () => {
    const parsed = financeFiltersSchema.safeParse({
      claimStatus: VALID_UUID,
      workLocation: 'Field - Base Location',
      dateFilterField: 'claim_date',
      dateFrom: '07/03/2026',
    })

    expect(parsed.success).toBe(true)
  })

  it('accepts submitted_at date filter values', () => {
    const parsed = financeFiltersSchema.safeParse({
      dateFilterField: 'submitted_at',
      dateFrom: '07/03/2026',
      dateTo: '08/03/2026',
    })

    expect(parsed.success).toBe(true)
  })

  it('accepts payment_released_date filter values', () => {
    const parsed = financeFiltersSchema.safeParse({
      dateFilterField: 'payment_released_date',
      dateFrom: '07/03/2026',
      dateTo: '08/03/2026',
    })

    expect(parsed.success).toBe(true)
  })
})
