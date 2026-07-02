import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveClaimAllowResubmitFilterValue: vi.fn(),
}))

vi.mock('@/features/claims/data/queries', () => ({
  resolveClaimAllowResubmitFilterValue:
    mocks.resolveClaimAllowResubmitFilterValue,
}))

import { getPendingApprovalsSummary } from '@/features/approvals/data/queries/pending-summary.query'
import type { SupabaseClient } from '@supabase/supabase-js'

function buildSupabaseStub(
  metricsResult: { claim_count: number; total_amount: number } | null
) {
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === 'get_pending_approvals_metrics') {
      return Promise.resolve({
        data: metricsResult ? [metricsResult] : [],
        error: null,
      })
    }
    throw new Error(`Unexpected rpc: ${name}`)
  })
  return { rpc } as unknown as SupabaseClient
}

describe('getPendingApprovalsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveClaimAllowResubmitFilterValue.mockResolvedValue(null)
  })

  it('returns zero immediately when approverEmail is empty, without calling the RPC', async () => {
    const supabase = buildSupabaseStub(null)

    const result = await getPendingApprovalsSummary(supabase, '', {
      employeeName: null,
      claimStatus: null,
      claimDateFrom: null,
      claimDateTo: null,
      amountOperator: 'lte',
      amountValue: null,
      locationType: null,
      claimDateSort: 'desc',
    })

    expect(result).toEqual({ count: 0, amount: 0 })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('calls get_pending_approvals_metrics directly with raw filter params — no scope/location pre-resolution', async () => {
    const supabase = buildSupabaseStub({ claim_count: 5, total_amount: 12500 })

    const result = await getPendingApprovalsSummary(
      supabase,
      'pgtap-approver@nxtwave.co.in',
      {
        employeeName: 'Ankur_Test',
        claimStatus: null,
        claimDateFrom: null,
        claimDateTo: null,
        amountOperator: 'lte',
        amountValue: null,
        locationType: null,
        claimDateSort: 'desc',
      }
    )

    expect(result).toEqual({ count: 5, amount: 12500 })
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_pending_approvals_metrics',
      expect.objectContaining({ p_employee_name: 'Ankur_Test' })
    )
    // The old implementation resolved p_level1_employee_ids/p_level2_employee_ids/
    // p_location_ids in TypeScript before calling the RPC. Assert those are gone.
    const callArgs = (supabase.rpc as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as Record<string, unknown>
    expect(callArgs).not.toHaveProperty('p_level1_employee_ids')
    expect(callArgs).not.toHaveProperty('p_level2_employee_ids')
    expect(callArgs).not.toHaveProperty('p_location_ids')
    expect(callArgs).not.toHaveProperty('p_pending_status_ids')
  })
})
