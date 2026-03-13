import type { EmployeeRow } from '@/lib/services/employee-service'
import { getEmployeeRoles } from '@/lib/services/employee-service'
import { hasFinanceRole } from '@/lib/services/approval-service'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function isFinanceTeamMember(
  supabase: SupabaseClient,
  employee: EmployeeRow
): Promise<boolean> {
  const roles = await getEmployeeRoles(supabase, employee.id)
  return hasFinanceRole(roles)
}
