import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getMyClaimsStats } from '@/features/claims/data/rpc/claim-metrics.rpc'
import type { SupabaseClient } from '@supabase/supabase-js'

function buildSupabaseStub(metricsResult: Record<string, number> | null) {
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === 'get_my_claims_metrics') {
      return Promise.resolve({
        data: metricsResult ? [metricsResult] : [],
        error: null,
      })
    }
    throw new Error(`Unexpected rpc: ${name}`)
  })
  return { rpc } as unknown as SupabaseClient
}

describe('getMyClaimsStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls get_my_claims_metrics with the employee id and filter params (not the unfiltered get_employee_claim_metrics)', async () => {
    const supabase = buildSupabaseStub({
      total_count: 1,
      total_amount: 200,
      pending_count: 1,
      pending_amount: 200,
      approved_count: 0,
      approved_amount: 0,
      rejected_count: 0,
      rejected_amount: 0,
      rejected_allow_reclaim_count: 0,
      rejected_allow_reclaim_amount: 0,
    })

    const result = await getMyClaimsStats(supabase, 'employee-1', {
      claimStatus: 'status-1',
      workLocation: null,
      claimDateFrom: null,
      claimDateTo: null,
    })

    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_my_claims_metrics',
      expect.objectContaining({ p_employee_id: 'employee-1' })
    )
    expect(result.total).toEqual({ count: 1, amount: 200 })
    expect(result.pending).toEqual({ count: 1, amount: 200 })
  })
})
