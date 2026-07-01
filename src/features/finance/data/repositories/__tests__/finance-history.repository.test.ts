import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getClaimAvailableActionsByClaimIds: vi.fn(),
  getFinanceActionCodesForDateFilter: vi.fn(),
}))

vi.mock('@/features/claims/data/queries', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/claims/data/queries')
  >('@/features/claims/data/queries')
  return {
    ...actual,
    getClaimAvailableActionsByClaimIds:
      mocks.getClaimAvailableActionsByClaimIds,
  }
})

vi.mock(
  '@/features/finance/data/repositories/filter-date-resolvers.repository',
  async () => {
    const actual = await vi.importActual<
      typeof import('@/features/finance/data/repositories/filter-date-resolvers.repository')
    >('@/features/finance/data/repositories/filter-date-resolvers.repository')
    return {
      ...actual,
      getFinanceActionCodesForDateFilter:
        mocks.getFinanceActionCodesForDateFilter,
    }
  }
)

import {
  getFinanceHistoryPaginated,
  mapHydratedHistoryRow,
} from '@/features/finance/data/repositories/finance-history.repository'
import { DEFAULT_FINANCE_FILTERS } from '@/features/finance/data/repositories/finance-shared.repository'
import type { FinanceFilters } from '@/features/finance/types'

// One fully-hydrated row exactly matching get_finance_history_page's flat return
// shape (docs/superpowers/plans/2026-07-01-finance-history-single-rpc-hydration.md).
function buildHydratedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'action-1',
    claim_id: 'claim-1',
    acted_at: '2026-06-30T10:43:15.926825+00:00',
    action_type: 'payment_released',
    action_notes: null,
    actor_employee_email: 'finance1@nxtwave.co.in',
    actor_employee_name: 'Test Flow Finance 1',

    claim_number: 'CLAIM-NW0000282-010423-33105',
    claim_employee_id: 'owner-uuid-1',
    claim_date: '2023-04-01',
    work_location_id: 'wl-1',
    work_location_name: 'Field - Outstation',
    expense_location_id: 'el-1',
    expense_location_name: 'Presales-Bangalore',
    expense_region_code: 'KANNADA',
    own_vehicle_used: false,
    vehicle_type_id: null,
    vehicle_type_name: null,
    outstation_state_id: null,
    outstation_city_id: null,
    from_city_id: null,
    to_city_id: null,
    outstation_state_name_snapshot: null,
    outstation_city_name_snapshot: null,
    from_city_name_snapshot: null,
    to_city_name_snapshot: null,
    km_travelled: null,
    total_amount: 530,
    status_id: 'status-1',
    status_code: 'PAYMENT_RELEASED',
    status_name: 'Payment Released',
    status_display_color: 'emerald',
    allow_resubmit_status_name: null,
    allow_resubmit_display_color: null,
    status_is_terminal: true,
    status_is_rejection: false,
    allow_resubmit: false,
    is_superseded: false,
    current_approval_level: 3,
    submitted_at: '2026-06-01T00:00:00+00:00',
    claim_created_at: '2026-06-01T00:00:00+00:00',
    claim_updated_at: '2026-06-30T10:43:15.926825+00:00',
    resubmission_count: 0,
    last_rejection_notes: null,
    last_rejected_at: null,
    accommodation_nights: null,
    food_with_principals_amount: null,
    has_intercity_travel: false,
    has_intracity_travel: false,
    intercity_own_vehicle_used: null,
    intracity_own_vehicle_used: null,
    intracity_vehicle_mode: null,
    base_location_day_type_code: null,

    owner_uuid: 'owner-uuid-1',
    owner_employee_code: 'NW0000282',
    owner_employee_name: 'Mutluri Yohan',
    owner_employee_email: 'yohan.mutluri@nxtwave.co.in',
    owner_designation_id: 'designation-1',
    owner_designation_name: 'Student Relationship Officer',
    ...overrides,
  }
}

function buildSupabaseStub(pageRows: unknown[]) {
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === 'get_finance_history_page') {
      return Promise.resolve({ data: pageRows, error: null })
    }
    throw new Error(`Unexpected rpc: ${name}`)
  })
  return { rpc } as unknown as import('@supabase/supabase-js').SupabaseClient
}

describe('mapHydratedHistoryRow', () => {
  it('maps a hydrated RPC row directly to claim/owner/action with no PostgREST unwrapping', () => {
    const row = buildHydratedRow()
    const { claim, owner, action } = mapHydratedHistoryRow(row as never)

    expect(claim).toMatchObject({
      id: 'claim-1',
      claim_number: 'CLAIM-NW0000282-010423-33105',
      employee_id: 'owner-uuid-1',
      claim_date: '2023-04-01',
      work_location: 'Field - Outstation',
      total_amount: 530,
      statusName: 'Payment Released',
      is_terminal: true,
      is_rejection: false,
    })

    expect(owner).toEqual({
      id: 'owner-uuid-1',
      employee_id: 'NW0000282',
      employee_name: 'Mutluri Yohan',
      employee_email: 'yohan.mutluri@nxtwave.co.in',
      designation_id: 'designation-1',
      designations: { designation_name: 'Student Relationship Officer' },
    })

    expect(action).toEqual({
      id: 'action-1',
      claim_id: 'claim-1',
      actor_email: 'finance1@nxtwave.co.in',
      actor_name: 'Test Flow Finance 1',
      action: 'payment_released',
      notes: null,
      acted_at: '2026-06-30T10:43:15.926825+00:00',
    })
  })

  it('nulls owner.designations when the LEFT-joined designation is absent', () => {
    const row = buildHydratedRow({ owner_designation_name: null })
    const { owner } = mapHydratedHistoryRow(row as never)
    expect(owner.designations).toBeNull()
  })

  it('defaults actor_email to empty string and actor_name to null when the actor employee is absent (LEFT join miss)', () => {
    const row = buildHydratedRow({
      actor_employee_email: null,
      actor_employee_name: null,
    })
    const { action } = mapHydratedHistoryRow(row as never)
    expect(action.actor_email).toBe('')
    expect(action.actor_name).toBeNull()
  })
})

describe('getFinanceHistoryPaginated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getClaimAvailableActionsByClaimIds.mockResolvedValue(new Map())
  })

  it('maps a single page of hydrated rows into FinanceHistoryItem[] with availableActions attached', async () => {
    const row = buildHydratedRow()
    const supabase = buildSupabaseStub([row])
    mocks.getClaimAvailableActionsByClaimIds.mockResolvedValue(
      new Map([
        [
          'claim-1',
          [
            {
              action: 'reject',
              display_label: 'Reject',
              require_notes: true,
              supports_allow_resubmit: false,
              actor_scope: 'finance' as const,
            },
          ],
        ],
      ])
    )

    const result = await getFinanceHistoryPaginated(supabase, null, 10)

    expect(result.hasNextPage).toBe(false)
    expect(result.nextCursor).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data[0].claim.id).toBe('claim-1')
    expect(result.data[0].availableActions).toHaveLength(1)
    expect(mocks.getClaimAvailableActionsByClaimIds).toHaveBeenCalledWith(
      supabase,
      ['claim-1']
    )
  })

  it('slices to limit and builds the cursor from the last BOUNDED row, not the probe row', async () => {
    const rows = [
      buildHydratedRow({
        id: 'a1',
        claim_id: 'c1',
        acted_at: '2026-06-30T10:00:00+00:00',
      }),
      buildHydratedRow({
        id: 'a2',
        claim_id: 'c2',
        acted_at: '2026-06-30T09:00:00+00:00',
      }),
      // limit+1 probe row — must be sliced off, and must NOT be the cursor source
      buildHydratedRow({
        id: 'a3',
        claim_id: 'c3',
        acted_at: '2026-06-30T08:00:00+00:00',
      }),
    ]
    const supabase = buildSupabaseStub(rows)

    const result = await getFinanceHistoryPaginated(supabase, null, 2)

    expect(result.hasNextPage).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.data.map((item) => item.claim.id)).toEqual(['c1', 'c2'])

    const decoded = JSON.parse(
      Buffer.from(result.nextCursor as string, 'base64').toString('utf-8')
    )
    expect(decoded).toEqual({
      created_at: '2026-06-30T09:00:00+00:00',
      id: 'a2',
    })
  })

  it('short-circuits with zero DB calls when an action-date filter resolves to zero action codes', async () => {
    mocks.getFinanceActionCodesForDateFilter.mockResolvedValue([])
    const supabase = buildSupabaseStub([])
    const filters: FinanceFilters = {
      ...DEFAULT_FINANCE_FILTERS,
      dateFilterField: 'payment_released_date',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    }

    const result = await getFinanceHistoryPaginated(supabase, null, 10, filters)

    expect(result).toEqual({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(mocks.getClaimAvailableActionsByClaimIds).not.toHaveBeenCalled()
  })

  it('short-circuits with zero availableActions calls when the page RPC returns no rows', async () => {
    const supabase = buildSupabaseStub([])

    const result = await getFinanceHistoryPaginated(supabase, null, 10)

    expect(result).toEqual({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })
    expect(mocks.getClaimAvailableActionsByClaimIds).not.toHaveBeenCalled()
  })
})
