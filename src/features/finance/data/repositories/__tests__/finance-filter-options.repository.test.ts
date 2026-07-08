import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAllDesignations: vi.fn(),
  getAllWorkLocations: vi.fn(),
}))

vi.mock('@/lib/services/config-service', () => ({
  getAllDesignations: mocks.getAllDesignations,
  getAllWorkLocations: mocks.getAllWorkLocations,
}))

import { getFinanceFilterOptions } from '@/features/finance/data/repositories/finance-filter-options.repository'

function buildSupabaseStub(options: {
  financeReviewStatusId?: string | null
  actionBuckets?: Array<{ action: string; is_rejected: boolean }>
  claimStatuses?: unknown[]
  workLocations?: unknown[]
  hodRows?: Array<{ approver_employee_id: string | null }>
}) {
  const from = vi.fn((table: string) => {
    if (table === 'claim_statuses') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: options.claimStatuses ?? [],
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.financeReviewStatusId
            ? { id: options.financeReviewStatusId }
            : null,
          error: null,
        }),
      }
    }
    if (table === 'employees') {
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  const rpc = vi.fn((name: string) => {
    if (name === 'finance_action_buckets') {
      return Promise.resolve({
        data: options.actionBuckets ?? [],
        error: null,
      })
    }
    if (name === 'get_hod_approver_employee_ids') {
      return Promise.resolve({ data: options.hodRows ?? [], error: null })
    }
    throw new Error(`Unexpected rpc: ${name}`)
  })

  return {
    from,
    rpc,
  } as unknown as import('@supabase/supabase-js').SupabaseClient
}

describe('getFinanceFilterOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAllDesignations.mockResolvedValue([])
    mocks.getAllWorkLocations.mockResolvedValue([])
  })

  it('sources finance action options from finance_action_buckets(), not a recency-limited finance_actions sample', async () => {
    const supabase = buildSupabaseStub({
      actionBuckets: [
        { action: 'finance_approved', is_rejected: false },
        { action: 'payment_released', is_rejected: false },
        { action: 'finance_rejected', is_rejected: true },
      ],
    })

    const result = await getFinanceFilterOptions(supabase)

    // Every distinct action from finance_action_buckets() must be offered,
    // even one that would have been evicted from the old top-200-by-recency sample.
    const values = result.financeActions.map((option) => option.value)
    expect(values).toContain('finance_approved')
    expect(values).toContain('payment_released')
    expect(values).toContain('finance_rejected')

    // The old implementation queried `finance_actions` directly via `.from()`.
    // Assert it no longer does.
    expect(supabase.from).not.toHaveBeenCalledWith('finance_actions')
  })

  it('offers "Rejected & Allow Reclaim" whenever finance_action_buckets() reports any is_rejected action, regardless of recent transaction volume', async () => {
    const supabase = buildSupabaseStub({
      actionBuckets: [{ action: 'finance_rejected', is_rejected: true }],
    })

    const result = await getFinanceFilterOptions(supabase)

    expect(
      result.financeActions.some(
        (option) => option.value === 'rejected_allow_reclaim'
      )
    ).toBe(true)
  })

  it('omits "Rejected & Allow Reclaim" when finance_action_buckets() reports no rejected action', async () => {
    const supabase = buildSupabaseStub({
      actionBuckets: [{ action: 'payment_released', is_rejected: false }],
    })

    const result = await getFinanceFilterOptions(supabase)

    expect(
      result.financeActions.some(
        (option) => option.value === 'rejected_allow_reclaim'
      )
    ).toBe(false)
  })

  it('deduplicates action options when finance_action_buckets() returns the same action from multiple transitions (join can produce duplicate action codes)', async () => {
    const supabase = buildSupabaseStub({
      actionBuckets: [
        { action: 'approved', is_rejected: false },
        { action: 'approved', is_rejected: false }, // reachable from a second prior status
        { action: 'rejected', is_rejected: true },
        { action: 'rejected', is_rejected: true },
      ],
    })

    const result = await getFinanceFilterOptions(supabase)

    const values = result.financeActions.map((option) => option.value)
    expect(values.filter((v) => v === 'approved')).toHaveLength(1)
    expect(values.filter((v) => v === 'rejected')).toHaveLength(1)
  })
})
