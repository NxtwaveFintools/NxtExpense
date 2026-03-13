import type { SupabaseClient } from '@supabase/supabase-js'

import type { EmployeeRow } from '@/lib/services/employee-service'
import { getEmployeeRoles } from '@/lib/services/employee-service'

export async function isAdminUser(
  supabase: SupabaseClient,
  employee: EmployeeRow
): Promise<boolean> {
  const roles = await getEmployeeRoles(supabase, employee.id)
  return roles.some((r) => r.is_admin_role)
}
