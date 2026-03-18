import { describe, expect, it } from 'vitest'

import {
  addFinanceFiltersToParams,
  buildFinanceHistoryCsv,
  toIstDayEnd,
  toIstDayStart,
} from '@/features/finance/utils/filters'
import type { FinanceFilters } from '@/features/finance/types'

const BASE_FILTERS: FinanceFilters = {
  employeeName: null,
  claimNumber: null,
  ownerDesignation: null,
  hodApproverEmployeeId: null,
  claimStatus: null,
  workLocation: null,
  actionFilter: null,
  dateFilterField: 'claim_date',
  dateFrom: null,
  dateTo: null,
}

const VALID_STATUS_ID = '3ae9b558-c006-427d-8ce6-13057d438d17'

describe('finance filter serialization', () => {
  it('omits default and null values from URL params', () => {
    const params = addFinanceFiltersToParams(
      new URLSearchParams(),
      BASE_FILTERS
    )
    expect(params.toString()).toBe('')
  })

  it('adds all populated filters to URL params', () => {
    const params = addFinanceFiltersToParams(new URLSearchParams(), {
      ...BASE_FILTERS,
      employeeName: 'Aman',
      claimNumber: 'CLAIM-001',
      ownerDesignation: 'Program Manager',
      hodApproverEmployeeId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      claimStatus: VALID_STATUS_ID,
      workLocation: 'Field - Outstation',
      actionFilter: 'issued',
      dateFilterField: 'finance_approved_date',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
    })

    expect(params.get('employeeName')).toBe('Aman')
    expect(params.get('claimNumber')).toBe('CLAIM-001')
    expect(params.get('ownerDesignation')).toBe('Program Manager')
    expect(params.get('hodApproverEmployeeId')).toBe(
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    )
    expect(params.get('claimStatus')).toBe(VALID_STATUS_ID)
    expect(params.get('workLocation')).toBe('Field - Outstation')
    expect(params.get('actionFilter')).toBe('issued')
    expect(params.get('dateFilterField')).toBe('finance_approved_date')
    expect(params.get('dateFrom')).toBe('2026-03-01')
    expect(params.get('dateTo')).toBe('2026-03-07')
  })
})

describe('finance date helpers', () => {
  it('returns null for empty date boundaries', () => {
    expect(toIstDayStart(null)).toBeNull()
    expect(toIstDayEnd(null)).toBeNull()
  })
})

describe('buildFinanceHistoryCsv', () => {
  it('returns headers when no finance history rows are present', () => {
    const csv = buildFinanceHistoryCsv([])
    const lines = csv.split('\n')

    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('Claim ID')
    expect(lines[0]).toContain('Action')
  })

  it('formats, quotes, and humanizes action names in CSV rows', () => {
    const csv = buildFinanceHistoryCsv([
      {
        claim: {
          claim_number: 'CLAIM-001',
          claim_date: '2026-03-10',
          work_location: 'Field - Outstation',
          total_amount: 850,
          statusName: 'Issued',
        },
        owner: {
          employee_name: 'Aman "Finance", Lead',
          designations: { designation_name: 'Program Manager' },
        },
        action: {
          action: 'finance_rejected',
          actor_email: 'finance@nxtwave.co.in',
          acted_at: '2026-03-10T09:00:00.000Z',
        },
      } as never,
    ])

    expect(csv).toContain('"Aman ""Finance"", Lead"')
    expect(csv).toContain('"finance rejected"')
    expect(csv).toContain('"Rs. 850.00"')
  })
})
