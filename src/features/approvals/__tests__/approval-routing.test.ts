import { describe, expect, it } from 'vitest'

import {
  canApproveAtLevel,
  getApproverCurrentLevel,
} from '@/features/approvals/permissions'
import { getNextApprovalLevel } from '@/features/employees/permissions'
import type { Claim } from '@/features/claims/types'
import type { Employee } from '@/features/employees/types'

const owner: Employee = {
  id: 'emp-1',
  employee_id: 'NW0000001',
  employee_name: 'Test User',
  employee_email: 'test.user@nxtwave.co.in',
  state: 'Telangana',
  designation: 'Student Relationship Officer',
  approval_email_level_1: 'sbh@nxtwave.co.in',
  approval_email_level_2: null,
  approval_email_level_3: 'mansoor@nxtwave.co.in',
  created_at: '2026-03-06T00:00:00.000Z',
}

const pendingClaim: Claim = {
  id: 'claim-1',
  employee_id: 'emp-1',
  claim_date: '2026-03-06',
  work_location: 'Field - Base Location',
  own_vehicle_used: true,
  vehicle_type: 'Two Wheeler',
  outstation_location: null,
  from_city: null,
  to_city: null,
  km_travelled: null,
  total_amount: 300,
  status: 'pending_approval',
  current_approval_level: 1,
  submitted_at: '2026-03-06T09:00:00.000Z',
  created_at: '2026-03-06T09:00:00.000Z',
  updated_at: '2026-03-06T09:00:00.000Z',
}

describe('approval routing permissions', () => {
  it('detects approver level from owner chain', () => {
    expect(getApproverCurrentLevel('sbh@nxtwave.co.in', owner)).toBe(1)
    expect(getApproverCurrentLevel('mansoor@nxtwave.co.in', owner)).toBe(3)
  })

  it('allows only current level approver', () => {
    expect(canApproveAtLevel('sbh@nxtwave.co.in', pendingClaim, owner)).toBe(
      true
    )
    expect(
      canApproveAtLevel('mansoor@nxtwave.co.in', pendingClaim, owner)
    ).toBe(false)
  })

  it('moves from level 1 directly to level 3 — L2 always skipped', () => {
    // L2 absent
    expect(
      getNextApprovalLevel(
        {
          level1: owner.approval_email_level_1,
          level2: owner.approval_email_level_2,
          level3: owner.approval_email_level_3,
        },
        1
      )
    ).toBe(3)

    // L2 present — must still be skipped per business rules
    expect(
      getNextApprovalLevel(
        {
          level1: owner.approval_email_level_1,
          level2: 'zbh@nxtwave.co.in',
          level3: owner.approval_email_level_3,
        },
        1
      )
    ).toBe(3)
  })
})
