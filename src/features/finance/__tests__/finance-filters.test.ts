import { describe, expect, it } from 'vitest'

import {
  hasFinanceClaimFilters,
  normalizeFinanceFilters,
  toIstDayEnd,
  toIstDayStart,
} from '@/features/finance/utils/filters'
import { REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE } from '@/features/finance/utils/action-filter'

const VALID_STATUS_ID = '3ae9b558-c006-427d-8ce6-13057d438d17'

describe('finance filter utilities', () => {
  it('normalizes finance filter inputs from query params', () => {
    const normalized = normalizeFinanceFilters({
      employeeName: '  Rahul  ',
      claimNumber: ' CLAIM-001 ',
      ownerDesignation: 'Program Manager',
      hodApproverEmployeeId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      claimStatus: VALID_STATUS_ID,
      workLocation: 'Field - Base Location',
      actionFilter: 'finance_rejected',
      dateFilterField: 'finance_approved_date',
      dateFrom: '07/03/2026',
      dateTo: '08/03/2026',
    })

    expect(normalized).toEqual({
      employeeId: null,
      employeeName: 'Rahul',
      claimNumber: 'CLAIM-001',
      ownerDesignation: 'Program Manager',
      hodApproverEmployeeId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      claimStatus: VALID_STATUS_ID,
      workLocation: 'Field - Base Location',
      actionFilter: 'finance_rejected',
      dateFilterField: 'finance_approved_date',
      dateFrom: '2026-03-07',
      dateTo: '2026-03-08',
    })
  })

  it('normalizes submitted_at date filter values', () => {
    const normalized = normalizeFinanceFilters({
      dateFilterField: 'submitted_at',
      dateFrom: '07/03/2026',
      dateTo: '08/03/2026',
    })

    expect(normalized.dateFilterField).toBe('submitted_at')
    expect(normalized.dateFrom).toBe('2026-03-07')
    expect(normalized.dateTo).toBe('2026-03-08')
  })

  it('normalizes hod_approved_date filter values', () => {
    const normalized = normalizeFinanceFilters({
      dateFilterField: 'hod_approved_date',
      dateFrom: '07/03/2026',
      dateTo: '08/03/2026',
    })

    expect(normalized.dateFilterField).toBe('hod_approved_date')
    expect(normalized.dateFrom).toBe('2026-03-07')
    expect(normalized.dateTo).toBe('2026-03-08')
  })

  it('normalizes payment_released_date filter values', () => {
    const normalized = normalizeFinanceFilters({
      dateFilterField: 'payment_released_date',
      dateFrom: '07/03/2026',
      dateTo: '08/03/2026',
    })

    expect(normalized.dateFilterField).toBe('payment_released_date')
    expect(normalized.dateFrom).toBe('2026-03-07')
    expect(normalized.dateTo).toBe('2026-03-08')
  })

  it('normalizes employeeId filter values', () => {
    const normalized = normalizeFinanceFilters({
      employeeId: '  NW0000282  ',
    })

    expect(normalized.employeeId).toBe('NW0000282')
  })

  it('detects whether claim-level filters are active', () => {
    expect(
      hasFinanceClaimFilters(
        normalizeFinanceFilters({
          actionFilter: 'all',
        })
      )
    ).toBe(false)

    expect(
      hasFinanceClaimFilters(
        normalizeFinanceFilters({
          workLocation: 'Field - Outstation',
        })
      )
    ).toBe(true)

    expect(
      hasFinanceClaimFilters(
        normalizeFinanceFilters({
          dateFilterField: 'claim_date',
          dateFrom: '2026-03-07',
        })
      )
    ).toBe(true)

    expect(
      hasFinanceClaimFilters(
        normalizeFinanceFilters({
          actionFilter: REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE,
        })
      )
    ).toBe(true)
  })

  it('converts date-only filters into IST day boundaries for strict DB filtering', () => {
    expect(toIstDayStart('2026-03-07')).toBe('2026-03-07T00:00:00+05:30')
    expect(toIstDayEnd('2026-03-07')).toBe('2026-03-07T23:59:59.999+05:30')
  })

  it('rejects invalid date ranges', () => {
    expect(() =>
      normalizeFinanceFilters({
        dateFrom: '2026-03-09',
        dateTo: '2026-03-08',
      })
    ).toThrowError('Date to must be on or after date from.')
  })

  // ─── FINANCE-001/002/003 Regression: empty hodApproverEmployeeId must NOT block filters ─

  it('does NOT throw when hodApproverEmployeeId is empty string (FINANCE regression)', () => {
    expect(() =>
      normalizeFinanceFilters({
        employeeName: 'Yohan',
        hodApproverEmployeeId: '',
      })
    ).not.toThrow()
  })

  it('preserves employeeName when hodApproverEmployeeId is empty string (FINANCE-002 regression)', () => {
    const result = normalizeFinanceFilters({
      employeeName: 'Yohan',
      claimNumber: '',
      ownerDesignation: '',
      hodApproverEmployeeId: '',
      claimStatus: '',
      workLocation: '',
    })
    expect(result.employeeName).toBe('Yohan')
    expect(result.hodApproverEmployeeId).toBeNull()
    expect(result.claimNumber).toBeNull()
  })

  it('preserves claimNumber when hodApproverEmployeeId is empty string (FINANCE-001 regression)', () => {
    const result = normalizeFinanceFilters({
      claimNumber: 'CLAIM-NW0000282-260305-0001',
      hodApproverEmployeeId: '',
    })
    expect(result.claimNumber).toBe('CLAIM-NW0000282-260305-0001')
    expect(result.hodApproverEmployeeId).toBeNull()
  })

  it('treats empty hodApproverEmployeeId as null (no filter)', () => {
    const result = normalizeFinanceFilters({ hodApproverEmployeeId: '' })
    expect(result.hodApproverEmployeeId).toBeNull()
  })

  it('does NOT throw when all Finance form fields are empty strings', () => {
    expect(() =>
      normalizeFinanceFilters({
        employeeName: '',
        claimNumber: '',
        ownerDesignation: '',
        hodApproverEmployeeId: '',
        claimStatus: '',
        workLocation: '',
        actionFilter: 'all',
        dateFilterField: 'claim_date',
        dateFrom: '',
        dateTo: '',
      })
    ).not.toThrow()
  })

  it('does NOT throw when actionFilter is empty string (converted to default "all")', () => {
    expect(() => normalizeFinanceFilters({ actionFilter: '' })).not.toThrow()
  })
})
