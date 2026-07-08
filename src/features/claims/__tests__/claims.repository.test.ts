import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getMyClaimsPaginated,
  getMyClaimsTotalCount,
} from '@/features/claims/data/repositories/claims.repository'
import type { SupabaseClient } from '@supabase/supabase-js'

function buildHydratedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'claim-1',
    claim_number: 'CLAIM-0001',
    employee_id: 'employee-1',
    claim_date: '2026-06-01',
    work_location_id: 'wl-1',
    work_location_name: 'Field - Outstation',
    expense_location_id: null,
    expense_location_name: null,
    expense_region_code: null,
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
    total_amount: 200,
    status_id: 'status-1',
    status_code: 'L1_PENDING',
    status_name: 'Pending',
    status_display_color: 'amber',
    allow_resubmit_status_name: null,
    allow_resubmit_display_color: null,
    status_is_terminal: false,
    status_is_rejection: false,
    status_is_payment_issued: false,
    allow_resubmit: false,
    is_superseded: false,
    current_approval_level: 1,
    submitted_at: '2026-06-01T00:00:00+00:00',
    created_at: '2026-06-01T00:00:00+00:00',
    updated_at: '2026-06-01T00:00:00+00:00',
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
    ...overrides,
  }
}

function buildSupabaseStub(pageRows: unknown[], countRows: unknown[] = []) {
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === 'get_my_claims_page') {
      return Promise.resolve({ data: pageRows, error: null })
    }
    if (name === 'get_my_claims_metrics') {
      return Promise.resolve({ data: countRows, error: null })
    }
    throw new Error(`Unexpected rpc: ${name}`)
  })
  return { rpc } as unknown as SupabaseClient
}

describe('getMyClaimsPaginated', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps a single hydrated page row into a Claim', async () => {
    const supabase = buildSupabaseStub([buildHydratedRow()])

    const result = await getMyClaimsPaginated(supabase, 'employee-1', null, 10)

    expect(result.hasNextPage).toBe(false)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('claim-1')
    expect(result.data[0].work_location).toBe('Field - Outstation')
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_my_claims_page',
      expect.objectContaining({ p_employee_id: 'employee-1' })
    )
  })

  it('slices to limit and builds the cursor from the last bounded row', async () => {
    const rows = [
      buildHydratedRow({ id: 'c1', created_at: '2026-06-02T00:00:00+00:00' }),
      buildHydratedRow({ id: 'c2', created_at: '2026-06-01T00:00:00+00:00' }),
      buildHydratedRow({ id: 'c3', created_at: '2026-05-31T00:00:00+00:00' }),
    ]
    const supabase = buildSupabaseStub(rows)

    const result = await getMyClaimsPaginated(supabase, 'employee-1', null, 2)

    expect(result.hasNextPage).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.data.map((c) => c.id)).toEqual(['c1', 'c2'])
  })
})

describe('getMyClaimsTotalCount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads total_count from get_my_claims_metrics, not a separate count RPC', async () => {
    const supabase = buildSupabaseStub([], [{ total_count: 7 }])

    const count = await getMyClaimsTotalCount(supabase, 'employee-1', {
      claimStatus: null,
      workLocation: null,
      claimDateFrom: null,
      claimDateTo: null,
    })

    expect(count).toBe(7)
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_my_claims_metrics',
      expect.objectContaining({ p_employee_id: 'employee-1' })
    )
  })
})
