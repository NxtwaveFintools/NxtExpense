import type { SupabaseClient } from '@supabase/supabase-js'

import type { EmployeeRow } from '@/lib/services/employee-service'
import {
  getEmployeeRoles,
  canUseVehicleType,
} from '@/lib/services/employee-service'
import {
  getDashboardAccessFromRoles,
  canAccessEmployeeClaimsFromRoles,
  hasFinanceRole,
} from '@/lib/services/approval-service'
import { getVehicleTypesByDesignation } from '@/lib/services/config-service'

type DashboardAccess = {
  canCreateClaims: boolean
  canViewClaims: boolean
  canViewApprovals: boolean
  canViewFinanceQueue: boolean
}

export async function canSubmitFourWheelerClaim(
  supabase: SupabaseClient,
  employee: EmployeeRow
): Promise<boolean> {
  if (!employee.designation_id) return false
  return canUseVehicleType(supabase, employee.id, 'FOUR_WHEELER')
}

export async function getAllowedVehicleTypes(
  supabase: SupabaseClient,
  designationId: string
): Promise<Array<{ id: string; vehicle_code: string; vehicle_name: string }>> {
  return getVehicleTypesByDesignation(supabase, designationId)
}

export async function getDashboardAccess(
  supabase: SupabaseClient,
  employee: EmployeeRow,
  hasApproverAccess: boolean
): Promise<DashboardAccess> {
  const roles = await getEmployeeRoles(supabase, employee.id)
  return getDashboardAccessFromRoles(roles, hasApproverAccess)
}

export async function canAccessEmployeeClaims(
  supabase: SupabaseClient,
  employee: EmployeeRow
): Promise<boolean> {
  const roles = await getEmployeeRoles(supabase, employee.id)
  return canAccessEmployeeClaimsFromRoles(roles)
}

export function canAccessApprovals(hasApproverAccess: boolean): boolean {
  return hasApproverAccess
}
