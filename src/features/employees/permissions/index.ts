import type { ApprovalChain, Employee } from '@/features/employees/types'

type DashboardAccess = {
  canCreateClaims: boolean
  canViewClaims: boolean
  canViewApprovals: boolean
  canViewFinanceQueue: boolean
}

const FOUR_WHEELER_ALLOWED_DESIGNATIONS = new Set([
  'State Business Head',
  'Zonal Business Head',
  'Program Manager',
] as const)

export function canSubmitFourWheelerClaim(
  designation: Employee['designation']
) {
  return FOUR_WHEELER_ALLOWED_DESIGNATIONS.has(
    designation as
      | 'State Business Head'
      | 'Zonal Business Head'
      | 'Program Manager'
  )
}

export function getAllowedVehicleTypes(designation: Employee['designation']) {
  if (canSubmitFourWheelerClaim(designation)) {
    return ['Two Wheeler', 'Four Wheeler'] as const
  }

  return ['Two Wheeler'] as const
}

export function getNextApprovalLevel(
  chain: ApprovalChain,
  currentLevel: 1 | 2 | 3 | null
): 1 | 2 | 3 | null {
  if (currentLevel === null) {
    if (chain.level1) return 1
    if (chain.level2) return 2
    if (chain.level3) return 3
    return null
  }

  if (currentLevel === 1) {
    if (chain.level2) return 2
    if (chain.level3) return 3
    return null
  }

  if (currentLevel === 2) {
    if (chain.level3) return 3
    return null
  }

  return null
}

export function getDashboardAccess(
  employee: Employee,
  hasApproverAccess: boolean
): DashboardAccess {
  const canViewFinanceQueue = employee.designation === 'Finance'
  const canViewClaims = !canViewFinanceQueue

  return {
    canCreateClaims: canViewClaims,
    canViewClaims,
    canViewApprovals: hasApproverAccess,
    canViewFinanceQueue,
  }
}

export function canAccessEmployeeClaims(employee: Employee): boolean {
  return employee.designation !== 'Finance' && employee.designation !== 'Admin'
}

export function canAccessApprovals(hasApproverAccess: boolean): boolean {
  return hasApproverAccess
}
