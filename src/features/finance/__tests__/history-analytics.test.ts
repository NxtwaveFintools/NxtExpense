import { beforeEach, describe, expect, it, vi } from 'vitest'

import { REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE } from '@/features/finance/utils/action-filter'

const mocks = vi.hoisted(() => ({
  getFilteredClaimIdsForFinance: vi.fn(),
}))

vi.mock('@/features/finance/queries/filters', () => ({
  getFilteredClaimIdsForFinance: mocks.getFilteredClaimIdsForFinance,
  isFinanceActionDateFilterField: (field: string) =>
    field === 'finance_approved_date' || field === 'payment_released_date',
}))

import { getFinanceHistoryAnalytics } from '@/features/finance/queries/history-analytics'

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

function createSupabaseStub(metrics: MetricsRow) {
  return {
    from: vi.fn((tableName: string) => {
      if (tableName === 'claim_statuses') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'status-approved',
                approval_level: null,
                is_approval: true,
                is_rejection: false,
                is_terminal: false,
                is_payment_issued: false,
              },
              {
                id: 'status-rejected',
                approval_level: null,
                is_approval: false,
                is_rejection: true,
                is_terminal: true,
                is_payment_issued: false,
              },
              {
                id: 'status-payment',
                approval_level: null,
                is_approval: false,
                is_rejection: false,
                is_terminal: true,
                is_payment_issued: true,
              },
            ],
            error: null,
          }),
        }
      }

      if (tableName === 'claim_status_transitions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                action_code: 'finance_approved',
                to_status_id: 'status-approved',
              },
              {
                action_code: 'payment_released',
                to_status_id: 'status-payment',
              },
              {
                action_code: 'finance_rejected',
                to_status_id: 'status-rejected',
              },
              { action_code: 'rejected', to_status_id: 'status-rejected' },
            ],
            error: null,
          }),
        }
      }

      throw new Error(`Unexpected table ${tableName}`)
    }),
    rpc: vi.fn().mockResolvedValue({
      data: [metrics],
      error: null,
    }),
  }
}

describe('getFinanceHistoryAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getFilteredClaimIdsForFinance.mockResolvedValue(['claim-1'])
  })

  it('passes expanded action codes for rejected-allow-reclaim filter and maps split rejection metrics', async () => {
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
      'get_finance_history_action_metrics',
      expect.objectContaining({
        p_action_filter: null,
        p_date_scoped_actions: ['rejected', 'finance_rejected'],
      })
    )

    expect(analytics.rejected.count).toBe(1)
    expect(analytics.rejected.amount).toBe(100)
    expect(analytics.rejectedAllowReclaim.count).toBe(2)
    expect(analytics.rejectedAllowReclaim.amount).toBe(200)
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
