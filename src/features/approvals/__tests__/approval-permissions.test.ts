import { describe, expect, it } from 'vitest'

import {
  canSubmitFourWheelerClaim,
  getAllowedVehicleTypes,
  getNextApprovalLevel,
  getDashboardAccess,
  canAccessEmployeeClaims,
} from '@/features/employees/permissions'
import {
  canApproveAtLevel,
  getApproverCurrentLevel,
} from '@/features/approvals/permissions'
import { isFinanceTeamMember } from '@/features/finance/permissions'
import type { ApprovalChain, Employee } from '@/features/employees/types'
import type { Claim } from '@/features/claims/types'

// ── Test Fixtures ───────────────────────────────────────────────────────────

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-1',
    employee_id: 'NW0000001',
    employee_name: 'Test User',
    employee_email: 'test.user@nxtwave.co.in',
    state: 'Andhra Pradesh',
    designation: 'Student Relationship Officer',
    approval_email_level_1: 'nagaraju.madugula@nxtwave.co.in',
    approval_email_level_2: null,
    approval_email_level_3: 'mansoor@nxtwave.co.in',
    created_at: '2026-03-06T00:00:00.000Z',
    ...overrides,
  }
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'claim-1',
    claim_number: 'CLM-20260306-001',
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
    tenant_id: 'tenant-1',
    resubmission_count: 0,
    last_rejection_notes: null,
    last_rejected_by_email: null,
    last_rejected_at: null,
    ...overrides,
  }
}

// ── Vehicle Eligibility (EDGE-001, EDGE-002) ────────────────────────────────

describe('canSubmitFourWheelerClaim — designation-based vehicle eligibility', () => {
  it('denies 4W for SRO (EDGE-001)', () => {
    expect(canSubmitFourWheelerClaim('Student Relationship Officer')).toBe(
      false
    )
  })

  it('denies 4W for BOA', () => {
    expect(canSubmitFourWheelerClaim('Business Operation Associate')).toBe(
      false
    )
  })

  it('denies 4W for ABH', () => {
    expect(canSubmitFourWheelerClaim('Area Business Head')).toBe(false)
  })

  it('allows 4W for SBH (EDGE-002)', () => {
    expect(canSubmitFourWheelerClaim('State Business Head')).toBe(true)
  })

  it('allows 4W for ZBH', () => {
    expect(canSubmitFourWheelerClaim('Zonal Business Head')).toBe(true)
  })

  it('allows 4W for PM', () => {
    expect(canSubmitFourWheelerClaim('Program Manager')).toBe(true)
  })

  it('denies 4W for Finance designation', () => {
    expect(canSubmitFourWheelerClaim('Finance')).toBe(false)
  })

  it('denies 4W for Admin designation', () => {
    expect(canSubmitFourWheelerClaim('Admin')).toBe(false)
  })
})

describe('getAllowedVehicleTypes — returns correct vehicle options', () => {
  it('returns only 2W for SRO', () => {
    expect(getAllowedVehicleTypes('Student Relationship Officer')).toEqual([
      'Two Wheeler',
    ])
  })

  it('returns only 2W for BOA', () => {
    expect(getAllowedVehicleTypes('Business Operation Associate')).toEqual([
      'Two Wheeler',
    ])
  })

  it('returns only 2W for ABH', () => {
    expect(getAllowedVehicleTypes('Area Business Head')).toEqual([
      'Two Wheeler',
    ])
  })

  it('returns 2W + 4W for SBH', () => {
    expect(getAllowedVehicleTypes('State Business Head')).toEqual([
      'Two Wheeler',
      'Four Wheeler',
    ])
  })

  it('returns 2W + 4W for ZBH', () => {
    expect(getAllowedVehicleTypes('Zonal Business Head')).toEqual([
      'Two Wheeler',
      'Four Wheeler',
    ])
  })

  it('returns 2W + 4W for PM', () => {
    expect(getAllowedVehicleTypes('Program Manager')).toEqual([
      'Two Wheeler',
      'Four Wheeler',
    ])
  })
})

// ── Approval Routing — getNextApprovalLevel ─────────────────────────────────

describe('getNextApprovalLevel — approval chain routing', () => {
  const fullChain: ApprovalChain = {
    level1: 'sbh@nxtwave.co.in',
    level2: 'zbh@nxtwave.co.in',
    level3: 'mansoor@nxtwave.co.in',
  }

  const noL1Chain: ApprovalChain = {
    level1: null,
    level2: null,
    level3: 'mansoor@nxtwave.co.in',
  }

  const emptyChain: ApprovalChain = {
    level1: null,
    level2: null,
    level3: null,
  }

  // SRO/BOA/ABH: L1 → L3
  it('routes SRO/BOA/ABH: null → L1 (first configured level)', () => {
    expect(getNextApprovalLevel(fullChain, null)).toBe(1)
  })

  it('routes SRO/BOA/ABH: L1 → L3 (L2 always skipped)', () => {
    expect(getNextApprovalLevel(fullChain, 1)).toBe(3)
  })

  it('routes L3 → null (end of chain)', () => {
    expect(getNextApprovalLevel(fullChain, 3)).toBeNull()
  })

  // SBH/ZBH/PM: Directly → L3
  it('routes SBH/ZBH/PM: null → L3 (no L1 configured)', () => {
    expect(getNextApprovalLevel(noL1Chain, null)).toBe(3)
  })

  it('routes SBH/ZBH/PM: L3 → null (end of chain)', () => {
    expect(getNextApprovalLevel(noL1Chain, 3)).toBeNull()
  })

  // Empty chain (Mansoor → direct to finance)
  it('returns null for empty chain (PM/Mansoor direct to finance)', () => {
    expect(getNextApprovalLevel(emptyChain, null)).toBeNull()
  })

  // L2 skip verification — even when L2 is populated
  it('skips L2 even when L2 is in the chain', () => {
    const chainWithL2: ApprovalChain = {
      level1: 'sbh@nxtwave.co.in',
      level2: 'zbh@nxtwave.co.in',
      level3: 'mansoor@nxtwave.co.in',
    }
    expect(getNextApprovalLevel(chainWithL2, 1)).toBe(3)
  })

  // L1 absent but L3 present
  it('skips to L3 when L1 is null', () => {
    const chainNoL1: ApprovalChain = {
      level1: null,
      level2: 'zbh@nxtwave.co.in',
      level3: 'mansoor@nxtwave.co.in',
    }
    expect(getNextApprovalLevel(chainNoL1, null)).toBe(3)
  })
})

// ── Approver Level Detection ────────────────────────────────────────────────

describe('getApproverCurrentLevel — email → level mapping', () => {
  const sroEmployee = makeEmployee({
    approval_email_level_1: 'nagaraju.madugula@nxtwave.co.in',
    approval_email_level_2: null,
    approval_email_level_3: 'mansoor@nxtwave.co.in',
  })

  it('maps SBH email to level 1', () => {
    expect(
      getApproverCurrentLevel('nagaraju.madugula@nxtwave.co.in', sroEmployee)
    ).toBe(1)
  })

  it('maps Mansoor email to level 3', () => {
    expect(getApproverCurrentLevel('mansoor@nxtwave.co.in', sroEmployee)).toBe(
      3
    )
  })

  it('returns null for unrelated email', () => {
    expect(
      getApproverCurrentLevel('random@nxtwave.co.in', sroEmployee)
    ).toBeNull()
  })

  it('returns null for employee own email', () => {
    expect(
      getApproverCurrentLevel('test.user@nxtwave.co.in', sroEmployee)
    ).toBeNull()
  })

  it('handles case-insensitive email matching', () => {
    expect(
      getApproverCurrentLevel('NAGARAJU.MADUGULA@NXTWAVE.CO.IN', sroEmployee)
    ).toBe(1)
  })

  it('handles case-insensitive for L3', () => {
    expect(getApproverCurrentLevel('Mansoor@Nxtwave.CO.IN', sroEmployee)).toBe(
      3
    )
  })

  // Employee with L2 set (ZBH in chain but L2 is skipped)
  it('maps L2 email to level 2 from getApproverCurrentLevel even though L2 is skipped in routing', () => {
    const employeeWithL2 = makeEmployee({
      approval_email_level_1: 'sbh@nxtwave.co.in',
      approval_email_level_2: 'zbh@nxtwave.co.in',
      approval_email_level_3: 'mansoor@nxtwave.co.in',
    })
    expect(getApproverCurrentLevel('zbh@nxtwave.co.in', employeeWithL2)).toBe(2)
  })
})

// ── canApproveAtLevel ───────────────────────────────────────────────────────

describe('canApproveAtLevel — authorization check', () => {
  const sroEmployee = makeEmployee({
    approval_email_level_1: 'nagaraju.madugula@nxtwave.co.in',
    approval_email_level_3: 'mansoor@nxtwave.co.in',
  })

  const claimAtL1 = makeClaim({ current_approval_level: 1 })
  const claimAtL3 = makeClaim({ current_approval_level: 3 })

  it('allows L1 approver when claim is at L1', () => {
    expect(
      canApproveAtLevel(
        'nagaraju.madugula@nxtwave.co.in',
        claimAtL1,
        sroEmployee
      )
    ).toBe(true)
  })

  it('denies L3 approver when claim is at L1 (EDGE-012)', () => {
    expect(
      canApproveAtLevel('mansoor@nxtwave.co.in', claimAtL1, sroEmployee)
    ).toBe(false)
  })

  it('allows L3 approver when claim is at L3', () => {
    expect(
      canApproveAtLevel('mansoor@nxtwave.co.in', claimAtL3, sroEmployee)
    ).toBe(true)
  })

  it('denies L1 approver when claim is at L3', () => {
    expect(
      canApproveAtLevel(
        'nagaraju.madugula@nxtwave.co.in',
        claimAtL3,
        sroEmployee
      )
    ).toBe(false)
  })

  it('denies random email at any level', () => {
    expect(
      canApproveAtLevel('random@nxtwave.co.in', claimAtL1, sroEmployee)
    ).toBe(false)
  })

  it('denies claim owner from approving own claim conceptually (EDGE-013 — enforced at action layer)', () => {
    // Note: canApproveAtLevel itself doesn't check self-approval, but the owner
    // won't be in their own approval chain, so it returns false.
    expect(
      canApproveAtLevel('test.user@nxtwave.co.in', claimAtL1, sroEmployee)
    ).toBe(false)
  })

  it('denies wrong SBH (different state) from approving (EDGE-012)', () => {
    // Karnataka SBH tries to approve AP employee's claim
    expect(
      canApproveAtLevel('vignesh.shenoy@nxtwave.co.in', claimAtL1, sroEmployee)
    ).toBe(false)
  })
})

// ── Finance Permission ──────────────────────────────────────────────────────

describe('isFinanceTeamMember', () => {
  it('returns true for Finance designation', () => {
    expect(isFinanceTeamMember(makeEmployee({ designation: 'Finance' }))).toBe(
      true
    )
  })

  it('returns false for SRO', () => {
    expect(
      isFinanceTeamMember(
        makeEmployee({ designation: 'Student Relationship Officer' })
      )
    ).toBe(false)
  })

  it('returns false for PM', () => {
    expect(
      isFinanceTeamMember(makeEmployee({ designation: 'Program Manager' }))
    ).toBe(false)
  })

  it('returns false for Admin', () => {
    expect(isFinanceTeamMember(makeEmployee({ designation: 'Admin' }))).toBe(
      false
    )
  })
})

// ── canAccessEmployeeClaims ─────────────────────────────────────────────────

describe('canAccessEmployeeClaims', () => {
  it('allows SRO to access claims', () => {
    expect(
      canAccessEmployeeClaims(
        makeEmployee({ designation: 'Student Relationship Officer' })
      )
    ).toBe(true)
  })

  it('allows BOA to access claims', () => {
    expect(
      canAccessEmployeeClaims(
        makeEmployee({ designation: 'Business Operation Associate' })
      )
    ).toBe(true)
  })

  it('allows SBH to access claims', () => {
    expect(
      canAccessEmployeeClaims(
        makeEmployee({ designation: 'State Business Head' })
      )
    ).toBe(true)
  })

  it('allows PM to access claims', () => {
    expect(
      canAccessEmployeeClaims(makeEmployee({ designation: 'Program Manager' }))
    ).toBe(true)
  })

  it('denies Finance from accessing employee claims', () => {
    expect(
      canAccessEmployeeClaims(makeEmployee({ designation: 'Finance' }))
    ).toBe(false)
  })

  it('denies Admin from accessing employee claims', () => {
    expect(
      canAccessEmployeeClaims(makeEmployee({ designation: 'Admin' }))
    ).toBe(false)
  })
})

// ── Dashboard Access ────────────────────────────────────────────────────────

describe('getDashboardAccess — role-based dashboard visibility', () => {
  it('shows claims for SRO without approver access', () => {
    const access = getDashboardAccess(
      makeEmployee({ designation: 'Student Relationship Officer' }),
      false
    )
    expect(access.canCreateClaims).toBe(true)
    expect(access.canViewClaims).toBe(true)
    expect(access.canViewApprovals).toBe(false)
    expect(access.canViewFinanceQueue).toBe(false)
  })

  it('shows claims + approvals for SBH with approver access', () => {
    const access = getDashboardAccess(
      makeEmployee({ designation: 'State Business Head' }),
      true
    )
    expect(access.canCreateClaims).toBe(true)
    expect(access.canViewClaims).toBe(true)
    expect(access.canViewApprovals).toBe(true)
    expect(access.canViewFinanceQueue).toBe(false)
  })

  it('shows finance queue for Finance designation', () => {
    const access = getDashboardAccess(
      makeEmployee({ designation: 'Finance' }),
      false
    )
    expect(access.canCreateClaims).toBe(false)
    expect(access.canViewClaims).toBe(false)
    expect(access.canViewApprovals).toBe(false)
    expect(access.canViewFinanceQueue).toBe(true)
  })

  it('shows claims + approvals for PM with approver access', () => {
    const access = getDashboardAccess(
      makeEmployee({ designation: 'Program Manager' }),
      true
    )
    expect(access.canCreateClaims).toBe(true)
    expect(access.canViewClaims).toBe(true)
    expect(access.canViewApprovals).toBe(true)
    expect(access.canViewFinanceQueue).toBe(false)
  })
})
