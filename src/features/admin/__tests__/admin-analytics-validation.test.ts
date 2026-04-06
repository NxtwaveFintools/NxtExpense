import { describe, expect, it } from 'vitest'

import { adminAnalyticsFilterSchema } from '@/features/admin/validations/analytics'

describe('adminAnalyticsFilterSchema', () => {
  it('defaults to travel_date and pendingOnly false', () => {
    const result = adminAnalyticsFilterSchema.safeParse({})

    expect(result.success).toBe(true)

    if (!result.success) {
      return
    }

    expect(result.data.dateFilterField).toBe('travel_date')
    expect(result.data.pendingOnly).toBe(false)
  })

  it('accepts submission_date with ISO date inputs', () => {
    const result = adminAnalyticsFilterSchema.safeParse({
      dateFilterField: 'submission_date',
      dateFrom: '2026-04-01',
      dateTo: '2026-04-06',
      pendingOnly: true,
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      return
    }

    expect(result.data.dateFilterField).toBe('submission_date')
    expect(result.data.pendingOnly).toBe(true)
  })

  it('accepts claimId search input', () => {
    const result = adminAnalyticsFilterSchema.safeParse({
      claimId: 'CLAIM-2026-110',
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      return
    }

    expect(result.data.claimId).toBe('CLAIM-2026-110')
  })
})
