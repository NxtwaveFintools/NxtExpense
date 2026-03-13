import { describe, expect, it } from 'vitest'

import {
  canApproveAtLevel,
  getApproverCurrentLevel,
} from '@/features/approvals/permissions'
import { getNextApprovalLevel } from '@/lib/services/approval-service'
import type { DesignationApprovalFlow } from '@/lib/services/config-service'
import type { EmployeeRow } from '@/lib/services/employee-service'
import type { Claim } from '@/features/claims/types'

// ── Test Fixtures ───────────────────────────────────────────────────────────

const owner: EmployeeRow = {
  id: 'emp-1',
  employee_id: 'NW0000001',
  employee_name: 'Test User',
  employee_email: 'test.user@nxtwave.co.in',
  designation_id: 'desg-sro',
  employee_status_id: null,
  designation_code: null,
  approval_employee_id_level_1: 'emp-id-sbh',
  approval_employee_id_level_2: null,
  approval_employee_id_level_3: 'emp-id-mansoor',
  created_at: '2026-03-06T00:00:00.000Z',
  designations: { designation_name: 'Student Relationship Officer' },
  employee_states: [{ is_primary: true, states: { state_name: 'Telangana' } }],
}

const pendingClaim: Claim = {
  id: 'claim-1',
  claim_number: 'CLAIM-20260306-001',
  employee_id: 'emp-1',
  claim_date: '2026-03-06',
  work_location: 'Field - Base Location',
  own_vehicle_used: true,
  vehicle_type: 'Two Wheeler',
  outstation_city_id: null,
  from_city_id: null,
  to_city_id: null,
  outstation_city_name: null,
  from_city_name: null,
  to_city_name: null,
  km_travelled: null,
  total_amount: 300,
  statusName: 'L1 Pending',
  statusDisplayColor: 'blue',
  status_id: 'status-uuid-l1-pending',
  is_terminal: false,
  is_rejection: false,
  allow_resubmit: false,
  is_superseded: false,
  current_approval_level: 1,
  submitted_at: '2026-03-06T09:00:00.000Z',
  created_at: '2026-03-06T09:00:00.000Z',
  updated_at: '2026-03-06T09:00:00.000Z',
  resubmission_count: 0,
  last_rejection_notes: null,
  last_rejected_at: null,
  accommodation_nights: null,
  food_with_principals_amount: null,
}

function makeFlow(levels: number[]): DesignationApprovalFlow {
  return {
    id: 'flow-1',
    designation_id: 'desg-1',
    required_approval_levels: levels,
    is_active: true,
  }
}

// ── Approval Routing Tests ──────────────────────────────────────────────────

describe('approval routing permissions', () => {
  it('detects approver level from owner chain', () => {
    expect(getApproverCurrentLevel('emp-id-sbh', owner)).toBe(1)
    expect(getApproverCurrentLevel('emp-id-mansoor', owner)).toBe(3)
  })

  it('allows only current level approver', () => {
    expect(canApproveAtLevel('emp-id-sbh', pendingClaim, owner)).toBe(true)
    expect(canApproveAtLevel('emp-id-mansoor', pendingClaim, owner)).toBe(false)
  })

  it('moves from L1 directly to L3 — L2 always skipped', () => {
    // SRO/BOA/ABH flow: [1, 3]
    const sroFlow = makeFlow([1, 3])
    expect(getNextApprovalLevel(sroFlow, 1)).toBe(3)
  })

  it('skips L2 even when it would exist in employee chain', () => {
    // The flow determines routing, not individual chain fields
    const sroFlow = makeFlow([1, 3])
    expect(getNextApprovalLevel(sroFlow, 1)).toBe(3)
  })

  it('routes SBH/ZBH/PM directly to L3', () => {
    const sbhFlow = makeFlow([3])
    expect(getNextApprovalLevel(sbhFlow, null)).toBe(3)
  })

  it('returns null at end of chain', () => {
    const flow = makeFlow([1, 3])
    expect(getNextApprovalLevel(flow, 3)).toBeNull()
  })
})
