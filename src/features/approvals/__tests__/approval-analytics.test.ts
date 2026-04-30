import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPendingApprovalsSummary: vi.fn(),
  resolveClaimAllowResubmitFilterValue: vi.fn(),
}))

vi.mock('@/features/approvals/queries/pending-summary', () => ({
  getPendingApprovalsSummary: mocks.getPendingApprovalsSummary,
}))

vi.mock('@/lib/services/claim-status-filter-service', () => ({
  resolveClaimAllowResubmitFilterValue:
    mocks.resolveClaimAllowResubmitFilterValue,
}))

import { getApprovalStageAnalytics } from '@/features/approvals/queries/approval-analytics'

describe('getApprovalStageAnalytics', () => {
  const approvedStatusId = '7a0068ba-39c3-4229-b6f5-88559ace4e77'

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPendingApprovalsSummary.mockResolvedValue({
      count: 2,
      amount: 400,
    })
    mocks.resolveClaimAllowResubmitFilterValue.mockResolvedValue(true)
  })

  it('uses inherited approval history analytics RPC and full approval filters for the cards', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            approved_count: '18',
            approved_amount: '585',
            payment_issued_count: '8',
            payment_issued_amount: '260',
            rejected_count: '0',
            rejected_amount: '0',
          },
        ],
        error: null,
      }),
    }

    const filters = {
      employeeName: 'Hari',
      claimStatus: approvedStatusId,
      claimDateFrom: '2026-04-01',
      claimDateTo: '2026-04-25',
      amountOperator: 'gte' as const,
      amountValue: 100,
      locationType: 'outstation' as const,
      claimDateSort: 'desc' as const,
      hodApprovedFrom: '2026-04-10',
      hodApprovedTo: '2026-04-20',
      financeApprovedFrom: '2026-04-11',
      financeApprovedTo: '2026-04-21',
    }

    const analytics = await getApprovalStageAnalytics(
      supabase as never,
      'hari.haran@nxtwave.co.in',
      filters
    )

    expect(mocks.getPendingApprovalsSummary).toHaveBeenCalledWith(
      supabase,
      'hari.haran@nxtwave.co.in',
      filters
    )
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_approval_history_analytics',
      {
        p_name_search: 'Hari',
        p_claim_status_id: approvedStatusId,
        p_claim_allow_resubmit: true,
        p_amount_operator: 'gte',
        p_amount_value: 100,
        p_location_type: 'outstation',
        p_claim_date_from: '2026-04-01',
        p_claim_date_to: '2026-04-25',
        p_hod_approved_from: '2026-04-10',
        p_hod_approved_to: '2026-04-20',
        p_finance_approved_from: '2026-04-11',
        p_finance_approved_to: '2026-04-21',
      }
    )
    expect(analytics).toEqual({
      total: {
        count: 20,
        amount: 985,
      },
      pendingApprovals: {
        count: 2,
        amount: 400,
      },
      approvedClaims: {
        count: 18,
        amount: 585,
      },
      paymentIssuedClaims: {
        count: 8,
        amount: 260,
      },
      rejectedClaims: {
        count: 0,
        amount: 0,
      },
    })
  })

  it('falls back to zeroed history metrics when the analytics RPC returns no rows', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }

    const analytics = await getApprovalStageAnalytics(
      supabase as never,
      'hari.haran@nxtwave.co.in'
    )

    expect(analytics).toEqual({
      total: {
        count: 2,
        amount: 400,
      },
      pendingApprovals: {
        count: 2,
        amount: 400,
      },
      approvedClaims: {
        count: 0,
        amount: 0,
      },
      paymentIssuedClaims: {
        count: 0,
        amount: 0,
      },
      rejectedClaims: {
        count: 0,
        amount: 0,
      },
    })
  })
})
