import { describe, expect, it } from 'vitest'

import type { Claim, ClaimItem } from '@/features/claims/types'
import { getClaimItemPresentation } from '@/features/claims/utils/claim-item-display'

function createClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'claim-1',
    claim_number: 'CLAIM-0001',
    employee_id: 'emp-1',
    claim_date: '2026-03-28',
    work_location: 'Field - Outstation',
    own_vehicle_used: false,
    vehicle_type: 'Two Wheeler',
    outstation_city_id: null,
    from_city_id: null,
    to_city_id: null,
    has_intercity_travel: false,
    has_intracity_travel: true,
    intercity_own_vehicle_used: false,
    intracity_own_vehicle_used: false,
    intracity_vehicle_mode: 'RENTAL_VEHICLE',
    outstation_city_name: null,
    from_city_name: null,
    to_city_name: null,
    km_travelled: null,
    total_amount: 530,
    statusName: 'Submitted',
    statusDisplayColor: 'yellow',
    status_id: 'status-1',
    is_terminal: false,
    is_rejection: false,
    allow_resubmit: false,
    is_superseded: false,
    current_approval_level: 1,
    submitted_at: '2026-03-28T10:00:00.000Z',
    created_at: '2026-03-28T10:00:00.000Z',
    updated_at: '2026-03-28T10:00:00.000Z',
    resubmission_count: 0,
    last_rejection_notes: null,
    last_rejected_at: null,
    accommodation_nights: null,
    food_with_principals_amount: null,
    ...overrides,
  }
}

function createItem(overrides: Partial<ClaimItem> = {}): ClaimItem {
  return {
    id: 'item-1',
    claim_id: 'claim-1',
    item_type: 'intracity_allowance',
    description: 'Two Wheeler fixed intra-city fuel allowance',
    amount: 180,
    created_at: '2026-03-28T10:00:00.000Z',
    ...overrides,
  }
}

describe('getClaimItemPresentation', () => {
  it('appends rented-vehicle qualifier for intracity allowance when missing', () => {
    const presentation = getClaimItemPresentation(createClaim(), createItem())

    expect(presentation.label).toBe('Rented/Own Fuel Allowance')
    expect(presentation.detail).toBe(
      'Two Wheeler fixed intra-city fuel allowance (rented vehicle travel)'
    )
  })

  it('keeps explicit mode description when already present', () => {
    const presentation = getClaimItemPresentation(
      createClaim(),
      createItem({
        description:
          'Two Wheeler fixed intra-city fuel allowance (rented vehicle travel)',
      })
    )

    expect(presentation.detail).toBe(
      'Two Wheeler fixed intra-city fuel allowance (rented vehicle travel)'
    )
  })

  it('builds own-vehicle detail when no description exists', () => {
    const presentation = getClaimItemPresentation(
      createClaim({
        has_intercity_travel: true,
        intercity_own_vehicle_used: true,
        intracity_own_vehicle_used: true,
        intracity_vehicle_mode: 'OWN_VEHICLE',
      }),
      createItem({ description: null })
    )

    expect(presentation.detail).toBe(
      'Two Wheeler fixed intra-city fuel allowance (own vehicle travel)'
    )
  })

  it('returns default label and optional description for non-intracity items', () => {
    const presentation = getClaimItemPresentation(
      createClaim(),
      createItem({
        item_type: 'intercity_travel',
        description: '100 KM @ ₹5/KM',
      })
    )

    expect(presentation).toEqual({
      label: 'Inter-city travel reimbursement',
      detail: '100 KM @ ₹5/KM',
    })
  })

  it('returns null detail for blank non-intracity description', () => {
    const presentation = getClaimItemPresentation(
      createClaim(),
      createItem({
        item_type: 'food',
        description: '   ',
      })
    )

    expect(presentation).toEqual({
      label: 'Food allowance',
      detail: null,
    })
  })

  it('builds title-cased label for unknown item types', () => {
    const presentation = getClaimItemPresentation(
      createClaim(),
      createItem({
        item_type: 'special_misc_allowance',
        description: 'One-time adjustment',
      })
    )

    expect(presentation).toEqual({
      label: 'Special Misc Allowance',
      detail: 'One-time adjustment',
    })
  })

  it('keeps own-vehicle description untouched when already qualified', () => {
    const presentation = getClaimItemPresentation(
      createClaim({ intracity_vehicle_mode: 'OWN_VEHICLE' }),
      createItem({
        description:
          'Two Wheeler fixed intra-city fuel allowance (own vehicle travel)',
      })
    )

    expect(presentation.detail).toBe(
      'Two Wheeler fixed intra-city fuel allowance (own vehicle travel)'
    )
  })

  it('infers own-vehicle qualifier from intracity own-vehicle flag', () => {
    const presentation = getClaimItemPresentation(
      createClaim({
        has_intercity_travel: false,
        intracity_own_vehicle_used: true,
        intracity_vehicle_mode: null,
      }),
      createItem({ description: null })
    )

    expect(presentation.detail).toBe(
      'Two Wheeler fixed intra-city fuel allowance (own vehicle travel)'
    )
  })
})
