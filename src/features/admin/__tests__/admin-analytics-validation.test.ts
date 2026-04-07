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

  it('normalizes DD/MM/YYYY date inputs into ISO strings', () => {
    const result = adminAnalyticsFilterSchema.safeParse({
      dateFrom: '07/04/2026',
      dateTo: '08/04/2026',
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      return
    }

    expect(result.data.dateFrom).toBe('2026-04-07')
    expect(result.data.dateTo).toBe('2026-04-08')
  })

  it('treats whitespace-only optional dates as undefined', () => {
    const result = adminAnalyticsFilterSchema.safeParse({
      dateFrom: '   ',
      dateTo: '   ',
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      return
    }

    expect(result.data.dateFrom).toBeUndefined()
    expect(result.data.dateTo).toBeUndefined()
  })

  it('rejects invalid DD/MM/YYYY date strings with field-specific message', () => {
    const result = adminAnalyticsFilterSchema.safeParse({
      dateFrom: '07-04-2026',
    })

    expect(result.success).toBe(false)

    if (result.success) {
      return
    }

    expect(result.error.issues[0]?.message).toBe(
      'Date from must be in DD/MM/YYYY format.'
    )
  })
})
