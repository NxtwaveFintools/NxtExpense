import { describe, expect, it } from 'vitest'

import {
  canApproveAtLevel,
  getApproverCurrentLevel,
} from '@/features/approvals/permissions'
import {
  getDashboardAccessFromRoles,
  canAccessEmployeeClaimsFromRoles,
  hasFinanceRole,
  getNextApprovalLevel,
} from '@/lib/services/approval-service'
import type { EmployeeRole } from '@/lib/services/employee-service'
import type { DesignationApprovalFlow } from '@/lib/services/config-service'
import type { EmployeeRow } from '@/lib/services/employee-service'
import type { Claim } from '@/features/claims/types'

// ── Test Helpers ────────────────────────────────────────────────────────────

function makeEmployeeRow(overrides: Partial<EmployeeRow> = {}): EmployeeRow {
  return {
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
    employee_states: [
      { is_primary: true, states: { state_name: 'Andhra Pradesh' } },
    ],
    ...overrides,
  }
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
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
    ...overrides,
  }
}

function makeRole(
  code: string,
  overrides: Partial<EmployeeRole> = {}
): EmployeeRole {
  return {
    role_id: `role-${code}`,
    role_code: code,
    role_name: code,
    is_finance_role: code === 'FINANCE_TEAM',
    is_admin_role: code === 'ADMIN',
    ...overrides,
  }
}

function makeFlow(levels: number[]): DesignationApprovalFlow {
  return {
    id: 'flow-1',
    designation_id: 'desg-1',
    required_approval_levels: levels,
    is_active: true,
  }
}

// ── Approval Routing — getNextApprovalLevel ─────────────────────────────────

describe('getNextApprovalLevel — approval chain routing', () => {
  it('routes SRO/BOA/ABH: null → L1 (first required level)', () => {
    expect(getNextApprovalLevel(makeFlow([1, 3]), null)).toBe(1)
  })

  it('routes SRO/BOA/ABH: L1 → L3 (L2 not in required levels)', () => {
    expect(getNextApprovalLevel(makeFlow([1, 3]), 1)).toBe(3)
  })

  it('routes L3 → null (end of chain)', () => {
    expect(getNextApprovalLevel(makeFlow([1, 3]), 3)).toBeNull()
  })

  it('routes SBH/ZBH/PM: null → L3 (only L3 required)', () => {
    expect(getNextApprovalLevel(makeFlow([3]), null)).toBe(3)
  })

  it('routes SBH/ZBH/PM: L3 → null', () => {
    expect(getNextApprovalLevel(makeFlow([3]), 3)).toBeNull()
  })

  it('returns null for empty flow (direct to finance)', () => {
    expect(getNextApprovalLevel(makeFlow([]), null)).toBeNull()
  })

  it('returns null when current level is not in the flow', () => {
    expect(getNextApprovalLevel(makeFlow([1, 3]), 2)).toBeNull()
  })
})

// ── Approver Level Detection ────────────────────────────────────────────────

describe('getApproverCurrentLevel — approver ID → level mapping', () => {
  const sroEmployee = makeEmployeeRow({
    approval_employee_id_level_1: 'emp-id-sbh',
    approval_employee_id_level_2: null,
    approval_employee_id_level_3: 'emp-id-mansoor',
  })

  it('maps L1 approver ID to level 1', () => {
    expect(getApproverCurrentLevel('emp-id-sbh', sroEmployee)).toBe(1)
  })

  it('maps L3 approver ID to level 3', () => {
    expect(getApproverCurrentLevel('emp-id-mansoor', sroEmployee)).toBe(3)
  })

  it('returns null for unknown approver ID', () => {
    expect(getApproverCurrentLevel('emp-id-unknown', sroEmployee)).toBeNull()
  })

  it('returns null for employee own ID', () => {
    expect(getApproverCurrentLevel('emp-1', sroEmployee)).toBeNull()
  })

  it('maps L2 approver ID to level 2 when L2 is set', () => {
    const employeeWithL2 = makeEmployeeRow({
      approval_employee_id_level_1: 'emp-id-sbh',
      approval_employee_id_level_2: 'emp-id-zbh',
      approval_employee_id_level_3: 'emp-id-mansoor',
    })
    expect(getApproverCurrentLevel('emp-id-zbh', employeeWithL2)).toBe(2)
  })
})

// ── canApproveAtLevel ───────────────────────────────────────────────────────

describe('canApproveAtLevel — authorization check', () => {
  const sroEmployee = makeEmployeeRow({
    approval_employee_id_level_1: 'emp-id-sbh',
    approval_employee_id_level_3: 'emp-id-mansoor',
  })

  const claimAtL1 = makeClaim({ current_approval_level: 1 })
  const claimAtL3 = makeClaim({ current_approval_level: 3 })

  it('allows L1 approver when claim is at L1', () => {
    expect(canApproveAtLevel('emp-id-sbh', claimAtL1, sroEmployee)).toBe(true)
  })

  it('denies L3 approver when claim is at L1 (EDGE-012)', () => {
    expect(canApproveAtLevel('emp-id-mansoor', claimAtL1, sroEmployee)).toBe(
      false
    )
  })

  it('allows L3 approver when claim is at L3', () => {
    expect(canApproveAtLevel('emp-id-mansoor', claimAtL3, sroEmployee)).toBe(
      true
    )
  })

  it('denies L1 approver when claim is at L3', () => {
    expect(canApproveAtLevel('emp-id-sbh', claimAtL3, sroEmployee)).toBe(false)
  })

  it('denies random approver ID at any level', () => {
    expect(canApproveAtLevel('emp-id-unknown', claimAtL1, sroEmployee)).toBe(
      false
    )
  })

  it('denies claim owner ID from approving own claim', () => {
    expect(canApproveAtLevel('emp-1', claimAtL1, sroEmployee)).toBe(false)
  })

  it('denies approver from a different employee chain (EDGE-012)', () => {
    expect(canApproveAtLevel('emp-id-other-sbh', claimAtL1, sroEmployee)).toBe(
      false
    )
  })
})

// ── Finance Role Check ──────────────────────────────────────────────────────

describe('hasFinanceRole — role-based finance check', () => {
  it('returns true for FINANCE_TEAM role', () => {
    expect(hasFinanceRole([makeRole('FINANCE_TEAM')])).toBe(true)
  })

  it('returns false for EMPLOYEE role only', () => {
    expect(hasFinanceRole([makeRole('EMPLOYEE')])).toBe(false)
  })

  it('returns false for ADMIN role', () => {
    expect(hasFinanceRole([makeRole('ADMIN')])).toBe(false)
  })

  it('returns true when finance role is among others', () => {
    expect(
      hasFinanceRole([makeRole('EMPLOYEE'), makeRole('FINANCE_TEAM')])
    ).toBe(true)
  })
})

// ── canAccessEmployeeClaimsFromRoles ────────────────────────────────────────

describe('canAccessEmployeeClaimsFromRoles — role-based claims access', () => {
  it('allows EMPLOYEE role to access claims', () => {
    expect(canAccessEmployeeClaimsFromRoles([makeRole('EMPLOYEE')])).toBe(true)
  })

  it('allows APPROVER_L1 to access claims', () => {
    expect(
      canAccessEmployeeClaimsFromRoles([
        makeRole('EMPLOYEE'),
        makeRole('APPROVER_L1'),
      ])
    ).toBe(true)
  })

  it('denies FINANCE_TEAM from accessing claims', () => {
    expect(canAccessEmployeeClaimsFromRoles([makeRole('FINANCE_TEAM')])).toBe(
      false
    )
  })

  it('denies ADMIN from accessing claims', () => {
    expect(canAccessEmployeeClaimsFromRoles([makeRole('ADMIN')])).toBe(false)
  })
})

// ── Dashboard Access ────────────────────────────────────────────────────────

describe('getDashboardAccessFromRoles — role-based dashboard visibility', () => {
  it('shows claims for EMPLOYEE without approver access', () => {
    const access = getDashboardAccessFromRoles([makeRole('EMPLOYEE')], false)
    expect(access.canCreateClaims).toBe(true)
    expect(access.canViewClaims).toBe(true)
    expect(access.canViewApprovals).toBe(false)
    expect(access.canViewFinanceQueue).toBe(false)
  })

  it('shows claims + approvals for EMPLOYEE with approver access', () => {
    const access = getDashboardAccessFromRoles(
      [makeRole('EMPLOYEE'), makeRole('APPROVER_L1')],
      true
    )
    expect(access.canCreateClaims).toBe(true)
    expect(access.canViewClaims).toBe(true)
    expect(access.canViewApprovals).toBe(true)
    expect(access.canViewFinanceQueue).toBe(false)
  })

  it('shows finance queue for FINANCE_TEAM', () => {
    const access = getDashboardAccessFromRoles(
      [makeRole('FINANCE_TEAM')],
      false
    )
    expect(access.canCreateClaims).toBe(false)
    expect(access.canViewClaims).toBe(false)
    expect(access.canViewApprovals).toBe(false)
    expect(access.canViewFinanceQueue).toBe(true)
  })

  it('hides claims for ADMIN role', () => {
    const access = getDashboardAccessFromRoles([makeRole('ADMIN')], false)
    expect(access.canCreateClaims).toBe(false)
    expect(access.canViewClaims).toBe(false)
    expect(access.canViewApprovals).toBe(false)
    expect(access.canViewFinanceQueue).toBe(false)
  })
})
