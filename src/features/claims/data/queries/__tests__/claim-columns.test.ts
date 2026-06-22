import { describe, expect, it } from 'vitest'

import {
  CLAIM_COLUMNS,
  mapClaimRow,
} from '@/features/claims/data/queries/claim-columns'

describe('claim columns mapping', () => {
  it('includes snapshot location columns and excludes live join aliases in claim projection', () => {
    expect(CLAIM_COLUMNS).toContain('outstation_state_name_snapshot')
    expect(CLAIM_COLUMNS).toContain('outstation_city_name_snapshot')
    expect(CLAIM_COLUMNS).toContain('from_city_name_snapshot')
    expect(CLAIM_COLUMNS).toContain('to_city_name_snapshot')
    expect(CLAIM_COLUMNS).not.toContain('outstation_state:states')
    expect(CLAIM_COLUMNS).not.toContain('outstation_city:cities')
    expect(CLAIM_COLUMNS).not.toContain('from_city_data:cities')
    expect(CLAIM_COLUMNS).not.toContain('to_city_data:cities')
  })

  it('prefers snapshot location names over current master names', () => {
    const mapped = mapClaimRow({
      id: 'claim-1',
      allow_resubmit: false,
      is_superseded: false,
      outstation_state_name_snapshot: 'Historical State',
      outstation_city_name_snapshot: 'Historical City',
      from_city_name_snapshot: 'Historical From',
      to_city_name_snapshot: 'Historical To',
      claim_statuses: {
        status_code: 'SUBMITTED',
        status_name: 'Submitted',
        display_color: 'warning',
        is_terminal: false,
        is_rejection: false,
        allow_resubmit_status_name: null,
        allow_resubmit_display_color: null,
      },
      work_locations: { location_name: 'Field - Outstation' },
      expense_locations: { location_name: 'Urban', region_code: 'U' },
      vehicle_types: { vehicle_name: 'Two Wheeler' },
    })

    expect(mapped.outstation_state_name).toBe('Historical State')
    expect(mapped.outstation_city_name).toBe('Historical City')
    expect(mapped.from_city_name).toBe('Historical From')
    expect(mapped.to_city_name).toBe('Historical To')
  })

  it('ignores live join data when snapshot is null — snapshot is the sole source of truth', () => {
    const mapped = mapClaimRow({
      id: 'claim-3',
      allow_resubmit: false,
      is_superseded: false,
      outstation_state_name_snapshot: null,
      outstation_city_name_snapshot: null,
      from_city_name_snapshot: null,
      to_city_name_snapshot: null,
      // Join-shaped props included to prove mapClaimRow does not fall back to them
      outstation_state: { state_name: 'Should Be Ignored' },
      outstation_city: { city_name: 'Should Be Ignored' },
      from_city_data: { city_name: 'Should Be Ignored' },
      to_city_data: { city_name: 'Should Be Ignored' },
      claim_statuses: {
        status_code: 'SUBMITTED',
        status_name: 'Submitted',
        display_color: 'warning',
        is_terminal: false,
        is_rejection: false,
        allow_resubmit_status_name: null,
        allow_resubmit_display_color: null,
      },
      work_locations: { location_name: 'Field - Outstation' },
      expense_locations: { location_name: 'Urban', region_code: 'U' },
      vehicle_types: null,
    })

    expect(mapped.outstation_state_name).toBeNull()
    expect(mapped.outstation_city_name).toBeNull()
    expect(mapped.from_city_name).toBeNull()
    expect(mapped.to_city_name).toBeNull()
  })
})
