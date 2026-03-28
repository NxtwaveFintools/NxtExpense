import { describe, expect, it } from 'vitest'

import type { Claim, ClaimHistoryEntry } from '@/features/claims/types'
import {
  formatClaimHistoryLocation,
  getClaimHistoryRejectionDisplayText,
} from '@/features/claims/utils/claim-history-display'

function buildClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'claim-1',
    claim_number: 'CLAIM-1',
    employee_id: 'emp-1',
    claim_date: '2026-03-28',
    work_location: 'Field - Outstation',
    own_vehicle_used: false,
    vehicle_type: 'Two Wheeler',
    outstation_city_id: null,
    from_city_id: null,
    to_city_id: null,
    has_intercity_travel: true,
    has_intracity_travel: true,
    intercity_own_vehicle_used: true,
    intracity_own_vehicle_used: true,
    intracity_vehicle_mode: 'OWN_VEHICLE',
    outstation_state_name: 'Andhra Pradesh',
    outstation_city_name: 'Vijayawada',
    from_city_name: 'Guntur',
    to_city_name: 'Vijayawada',
    km_travelled: 40,
    total_amount: 1000,
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

function buildHistory(
  overrides: Partial<ClaimHistoryEntry> = {}
): ClaimHistoryEntry {
  return {
    id: 'hist-1',
    claim_id: 'claim-1',
    approver_email: 'approver@example.com',
    approver_name: 'Approver',
    approval_level: 1,
    action: 'rejected',
    notes: null,
    rejection_notes: null,
    allow_resubmit: null,
    bypass_reason: null,
    skipped_levels: null,
    reason: null,
    acted_at: '2026-03-28T11:00:00.000Z',
    ...overrides,
  }
}

describe('claim-history-display helpers', () => {
  it('formats location with inter-city route context', () => {
    const location = formatClaimHistoryLocation(buildClaim())
    expect(location).toBe('Field - Outstation (Guntur -> Vijayawada)')
  })

  it('suppresses rejection reason text when reclaim is allowed', () => {
    const text = getClaimHistoryRejectionDisplayText(
      buildHistory({
        rejection_notes:
          'Rejecting with reclaim allowed for superseded claim regression coverage',
        allow_resubmit: true,
      })
    )

    expect(text).toBeNull()
  })

  it('sanitizes internal reclaim notes for historical compatibility', () => {
    const text = getClaimHistoryRejectionDisplayText(
      buildHistory({
        rejection_notes:
          'Rejecting with reclaim allowed for superseded claim regression coverage',
        allow_resubmit: false,
      })
    )

    expect(text).toBe('Reclaim Allowed')
  })

  it('returns user-facing reason when no reclaim flow is present', () => {
    const text = getClaimHistoryRejectionDisplayText(
      buildHistory({
        rejection_notes: 'Insufficient supporting documents',
      })
    )

    expect(text).toBe('Reason: Insufficient supporting documents')
  })
})
