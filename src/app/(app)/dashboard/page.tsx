import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getEmployeeByEmail,
  hasApproverAssignments,
} from '@/lib/services/employee-service'
import { getDashboardAccess } from '@/features/employees/permissions'
import { redirect } from 'next/navigation'

import { DashboardContent } from '@/features/dashboard/components/dashboard-content'
import {
  getEmployeeClaimStats,
  getRecentClaims,
} from '@/features/dashboard/queries/dashboard-metrics'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const user = await requireCurrentUser('/login')
  const supabase = await createSupabaseServerClient()

  let employee = null
  try {
    employee = await getEmployeeByEmail(supabase, user.email ?? '')
  } catch {
    redirect('/login?message=session_refresh_required')
  }

  if (!employee) {
    redirect('/no-access')
  }

  const approverAccess = await hasApproverAssignments(
    supabase,
    employee.employee_email
  )
  const dashboardAccess = await getDashboardAccess(
    supabase,
    employee,
    approverAccess
  )

  const statsPromise = getEmployeeClaimStats(supabase, employee.id)
  const recentClaimsPromise = getRecentClaims(supabase, employee.id)

  return (
    <DashboardContent
      access={dashboardAccess}
      employee={{
        email: user.email ?? null,
        employeeId: employee.employee_id,
        employeeName: employee.employee_name,
        designationName: employee.designations?.designation_name ?? null,
      }}
      statsPromise={statsPromise}
      recentClaimsPromise={recentClaimsPromise}
    />
  )
}
