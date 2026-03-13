import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getDesignationApprovalFlow,
  getApprovalRoutingForDesignation,
  getClaimStatusTransitions,
  type ApprovalRouting,
  type DesignationApprovalFlow,
  type ClaimStatusTransition,
} from '@/lib/services/config-service'
import {
  getEmployeeRoles,
  type EmployeeRole,
} from '@/lib/services/employee-service'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

/** Full approval route for a single level */
export type ApprovalLevelRoute = {
  level: number
  approverRoleId: string
  approverDesignationId: string | null
  approverStateId: string | null
}

/** Result of resolving who can approve which levels */
export type ResolvedApprovalChain = {
  designationId: string
  flow: DesignationApprovalFlow
  routes: ApprovalLevelRoute[]
}

/** Whether a user can approve a specific level */
export type ApprovalEligibility = {
  canApprove: boolean
  matchedLevel: number | null
  matchedRoleId: string | null
}

// ────────────────────────────────────────────────────────────
// Resolve the full approval chain for a submitter
// ────────────────────────────────────────────────────────────

/**
 * Given a submitter's designation_id and primary state_id,
 * returns the required approval levels and the routing for each.
 */
export async function resolveApprovalChain(
  supabase: SupabaseClient,
  designationId: string,
  stateId: string | null
): Promise<ResolvedApprovalChain> {
  const [flow, allRoutes] = await Promise.all([
    getDesignationApprovalFlow(supabase, designationId),
    getApprovalRoutingForDesignation(supabase, designationId, stateId),
  ])

  // Only include routes for required levels
  const requiredSet = new Set(flow.required_approval_levels)
  const routes: ApprovalLevelRoute[] = allRoutes
    .filter((r) => requiredSet.has(r.approval_level))
    .map((r) => ({
      level: r.approval_level,
      approverRoleId: r.approver_role_id,
      approverDesignationId: r.approver_designation_id,
      approverStateId: r.approver_state_id,
    }))

  return { designationId, flow, routes }
}

// ────────────────────────────────────────────────────────────
// Check if a user can approve at a given level
// ────────────────────────────────────────────────────────────

/**
 * Checks whether the given employee has a role matching the
 * required approver_role_id for the current approval level
 * of a claim.
 */
export async function canUserApproveAtLevel(
  supabase: SupabaseClient,
  employeeId: string,
  chain: ResolvedApprovalChain,
  currentLevel: number
): Promise<ApprovalEligibility> {
  const route = chain.routes.find((r) => r.level === currentLevel)
  if (!route) {
    return { canApprove: false, matchedLevel: null, matchedRoleId: null }
  }

  const roles = await getEmployeeRoles(supabase, employeeId)
  const matchedRole = roles.find((r) => r.role_id === route.approverRoleId)

  if (!matchedRole) {
    return { canApprove: false, matchedLevel: null, matchedRoleId: null }
  }

  return {
    canApprove: true,
    matchedLevel: currentLevel,
    matchedRoleId: matchedRole.role_id,
  }
}

// ────────────────────────────────────────────────────────────
// Get next approval level from the chain
// ────────────────────────────────────────────────────────────

/**
 * Given the current approval level (or null for first submission),
 * determine the next required level from the designation's flow.
 */
export function getNextApprovalLevel(
  flow: DesignationApprovalFlow,
  currentLevel: number | null
): number | null {
  const levels = flow.required_approval_levels
  if (!levels.length) return null

  if (currentLevel === null) return levels[0] ?? null

  const currentIdx = levels.indexOf(currentLevel)
  if (currentIdx === -1 || currentIdx >= levels.length - 1) return null

  return levels[currentIdx + 1] ?? null
}

// ────────────────────────────────────────────────────────────
// Status transitions with role check
// ────────────────────────────────────────────────────────────

/** A transition the user is allowed to execute */
export type AllowedTransition = ClaimStatusTransition & {
  matchedRoleId: string | null
}

/**
 * Gets all valid status transitions from the current status
 * that the user is authorized to execute (based on their roles).
 */
export async function getAllowedTransitions(
  supabase: SupabaseClient,
  fromStatusId: string,
  employeeId: string
): Promise<AllowedTransition[]> {
  const [transitions, roles] = await Promise.all([
    getClaimStatusTransitions(supabase, fromStatusId),
    getEmployeeRoles(supabase, employeeId),
  ])

  const roleIdSet = new Set(roles.map((r) => r.role_id))

  return transitions
    .filter((t) => {
      if (!t.required_role_id) return true
      return roleIdSet.has(t.required_role_id)
    })
    .map((t) => ({
      ...t,
      matchedRoleId: t.required_role_id
        ? roleIdSet.has(t.required_role_id)
          ? t.required_role_id
          : null
        : null,
    }))
}

// ────────────────────────────────────────────────────────────
// Dashboard access (ID-based — replaces hardcoded checks)
// ────────────────────────────────────────────────────────────

export type DashboardAccess = {
  canCreateClaims: boolean
  canViewClaims: boolean
  canViewApprovals: boolean
  canViewFinanceQueue: boolean
  canViewAdmin: boolean
}

/**
 * Determine dashboard access from employee roles.
 * Finance roles see finance queue; all others see claims.
 * Approver roles see the approvals section.
 */
export function getDashboardAccessFromRoles(
  roles: EmployeeRole[],
  hasApproverAssignments: boolean
): DashboardAccess {
  const isFinance = roles.some((r) => r.is_finance_role)
  const isAdmin = roles.some((r) => r.is_admin_role)

  const canViewFinanceQueue = isFinance
  const canViewClaims = !isFinance && !isAdmin

  return {
    canCreateClaims: canViewClaims,
    canViewClaims,
    canViewApprovals: hasApproverAssignments,
    canViewFinanceQueue,
    canViewAdmin: isAdmin,
  }
}

/**
 * Check if employee can access their own claims section
 * (Finance and Admin roles cannot submit claims).
 */
export function canAccessEmployeeClaimsFromRoles(
  roles: EmployeeRole[]
): boolean {
  return (
    !roles.some((r) => r.is_finance_role) && !roles.some((r) => r.is_admin_role)
  )
}

/**
 * Check if user has any finance role (reviewer or processor).
 */
export function hasFinanceRole(roles: EmployeeRole[]): boolean {
  return roles.some((r) => r.is_finance_role)
}
