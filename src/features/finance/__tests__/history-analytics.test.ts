import { beforeEach, describe, expect, it, vi } from 'vitest'

import { REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE } from '@/features/finance/utils/action-filter'
import { getFinanceHistoryAnalytics } from '@/features/finance/data/queries'

type MetricsRow = {
  total_count: number
  total_amount: number
  approved_count: number
  approved_amount: number
  rejected_count: number
  rejected_amount: number
  rejected_without_reclaim_count?: number
  rejected_without_reclaim_amount?: number
  rejected_allow_reclaim_count?: number
  rejected_allow_reclaim_amount?: number
  other_count: number
  other_amount: number
}

// Phase 2: getFinanceHistoryAnalytics resolves the claim scope + action buckets
// inside the get_finance_history_metrics RPC, so the only Supabase call is the RPC.
function createSupabaseStub(metrics: MetricsRow) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: [metrics],
      error: null,
    }),
  }
}

describe('getFinanceHistoryAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls get_finance_history_metrics with the filter params and maps split rejection metrics', async () => {
    const supabase = createSupabaseStub({
      total_count: 3,
      total_amount: 300,
      approved_count: 0,
      approved_amount: 0,
      rejected_count: 3,
      rejected_amount: 300,
      rejected_without_reclaim_count: 1,
      rejected_without_reclaim_amount: 100,
      rejected_allow_reclaim_count: 2,
      rejected_allow_reclaim_amount: 200,
      other_count: 0,
      other_amount: 0,
    })

    const analytics = await getFinanceHistoryAnalytics(supabase as never, {
      employeeId: null,
      employeeName: null,
      claimNumber: null,
      ownerDesignation: null,
      hodApproverEmployeeId: null,
      claimStatus: null,
      workLocation: null,
      actionFilter: REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE,
      dateFilterField: 'claim_date',
      dateFrom: null,
      dateTo: null,
    })

    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_finance_history_metrics',
      expect.objectContaining({
        p_action_filter: REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE,
        p_date_field: 'claim_date',
      })
    )

    expect(analytics.rejected.count).toBe(1)
    expect(analytics.rejected.amount).toBe(100)
    expect(analytics.rejectedAllowReclaim.count).toBe(2)
    expect(analytics.rejectedAllowReclaim.amount).toBe(200)
  })

  it('converts action-date filters to IST day boundaries', async () => {
    const supabase = createSupabaseStub({
      total_count: 0,
      total_amount: 0,
      approved_count: 0,
      approved_amount: 0,
      rejected_count: 0,
      rejected_amount: 0,
      other_count: 0,
      other_amount: 0,
    })

    await getFinanceHistoryAnalytics(supabase as never, {
      employeeId: null,
      employeeName: null,
      claimNumber: null,
      ownerDesignation: null,
      hodApproverEmployeeId: null,
      claimStatus: null,
      workLocation: null,
      actionFilter: null,
      dateFilterField: 'payment_released_date',
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
    })

    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_finance_history_metrics',
      expect.objectContaining({
        p_date_field: 'payment_released_date',
        p_date_from: '2026-04-01T00:00:00+05:30',
        p_date_to: '2026-04-30T23:59:59.999+05:30',
      })
    )
  })

  it('falls back to legacy rejected totals when split fields are absent', async () => {
    const supabase = createSupabaseStub({
      total_count: 2,
      total_amount: 220,
      approved_count: 0,
      approved_amount: 0,
      rejected_count: 2,
      rejected_amount: 220,
      other_count: 0,
      other_amount: 0,
    })

    const analytics = await getFinanceHistoryAnalytics(supabase as never, {
      employeeId: null,
      employeeName: null,
      claimNumber: null,
      ownerDesignation: null,
      hodApproverEmployeeId: null,
      claimStatus: null,
      workLocation: null,
      actionFilter: 'finance_rejected',
      dateFilterField: 'claim_date',
      dateFrom: null,
      dateTo: null,
    })

    expect(analytics.rejected.count).toBe(2)
    expect(analytics.rejected.amount).toBe(220)
    expect(analytics.rejectedAllowReclaim.count).toBe(0)
    expect(analytics.rejectedAllowReclaim.amount).toBe(0)
  })

  it('maps legacy rejected totals to reclaim bucket for reclaim-only action filter', async () => {
    const supabase = createSupabaseStub({
      total_count: 2,
      total_amount: 220,
      approved_count: 0,
      approved_amount: 0,
      rejected_count: 2,
      rejected_amount: 220,
      other_count: 0,
      other_amount: 0,
    })

    const analytics = await getFinanceHistoryAnalytics(supabase as never, {
      employeeId: null,
      employeeName: null,
      claimNumber: null,
      ownerDesignation: null,
      hodApproverEmployeeId: null,
      claimStatus: null,
      workLocation: null,
      actionFilter: REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE,
      dateFilterField: 'claim_date',
      dateFrom: null,
      dateTo: null,
    })

    expect(analytics.rejected.count).toBe(0)
    expect(analytics.rejected.amount).toBe(0)
    expect(analytics.rejectedAllowReclaim.count).toBe(2)
    expect(analytics.rejectedAllowReclaim.amount).toBe(220)
  })
})
