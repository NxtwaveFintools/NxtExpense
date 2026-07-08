import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveClaimAllowResubmitFilterValue: vi.fn(),
  getClaimAvailableActionsByClaimIds: vi.fn(),
}))

vi.mock('@/features/claims/data/queries', () => ({
  CLAIM_COLUMNS: '*',
  mapClaimRow: vi.fn(),
  resolveClaimAllowResubmitFilterValue:
    mocks.resolveClaimAllowResubmitFilterValue,
  getClaimAvailableActionsByClaimIds: mocks.getClaimAvailableActionsByClaimIds,
}))

import { getPendingApprovalsPaginated } from '@/features/approvals/data/repositories/approvals.repository'
import type { SupabaseClient } from '@supabase/supabase-js'

function buildSupabaseMock(rpcResult: {
  data: unknown
  error: null | { message: string }
}) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  }
}

describe('getPendingApprovalsPaginated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveClaimAllowResubmitFilterValue.mockResolvedValue(null)
  })

  it('returns empty data immediately when approverEmail is empty', async () => {
    const supabase = buildSupabaseMock({ data: [], error: null })

    const result = await getPendingApprovalsPaginated(
      supabase as unknown as SupabaseClient,
      '',
      null,
      10
    )

    expect(result).toEqual({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns empty data when the RPC returns no rows (actor has no employee record)', async () => {
    // get_pending_approvals returns 0 rows when the caller email has no employee
    // record — the JOIN me ON true in the SQL eliminates all rows when `me` is empty.
    // The repository must return empty pagination, not throw.
    const supabase = buildSupabaseMock({ data: [], error: null })

    const result = await getPendingApprovalsPaginated(
      supabase as unknown as SupabaseClient,
      'unknown@nxtwave.co.in',
      null,
      10
    )

    expect(result).toEqual({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })
  })

  it('calls get_pending_approvals_page (not the old get_pending_approvals)', async () => {
    const supabase = buildSupabaseMock({ data: [], error: null })

    await getPendingApprovalsPaginated(
      supabase as unknown as SupabaseClient,
      'someone@nxtwave.co.in',
      null,
      10
    )

    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_pending_approvals_page',
      expect.anything()
    )
  })
})
