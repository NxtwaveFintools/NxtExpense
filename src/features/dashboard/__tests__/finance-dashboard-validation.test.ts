import { describe, expect, it } from 'vitest'

import { financeDashboardFilterSchema } from '@/features/dashboard/validations/finance-dashboard'

describe('financeDashboardFilterSchema', () => {
  it('defaults to travel_date when dateFilterField is missing', () => {
    const result = financeDashboardFilterSchema.safeParse({})

    expect(result.success).toBe(true)

    if (!result.success) {
      return
    }

    expect(result.data.dateFilterField).toBe('travel_date')
  })

  it('accepts submission_date and ISO dates', () => {
    const result = financeDashboardFilterSchema.safeParse({
      dateFilterField: 'submission_date',
      dateFrom: '2026-04-01',
      dateTo: '2026-04-06',
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      return
    }

    expect(result.data.dateFilterField).toBe('submission_date')
    expect(result.data.dateFrom).toBe('2026-04-01')
    expect(result.data.dateTo).toBe('2026-04-06')
  })

  it('accepts employeeName input', () => {
    const result = financeDashboardFilterSchema.safeParse({
      employeeName: 'Mansoor',
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      return
    }

    expect(result.data.employeeName).toBe('Mansoor')
  })

  it('normalizes DD/MM/YYYY dates into ISO format', () => {
    const result = financeDashboardFilterSchema.safeParse({
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

  it('rejects invalid date formats for optional date fields', () => {
    const result = financeDashboardFilterSchema.safeParse({
      dateTo: '2026/04/08',
    })

    expect(result.success).toBe(false)

    if (result.success) {
      return
    }

    expect(result.error.issues[0]?.message).toBe(
      'Date to must be in DD/MM/YYYY format.'
    )
  })

  it('treats blank optional date inputs as undefined', () => {
    const result = financeDashboardFilterSchema.safeParse({
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
})
