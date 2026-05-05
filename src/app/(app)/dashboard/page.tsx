import type { Metadata } from 'next'

import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getEmployeeByEmail,
  hasApproverAssignments,
} from '@/lib/services/employee-service'
import { getDashboardAccess } from '@/features/employees/permissions'
import { redirect } from 'next/navigation'
import nextDynamic from 'next/dynamic'

import { DashboardContent } from '@/features/dashboard/components/dashboard-content'
import {
  getDashboardClaimStats,
  getRecentClaimsForEmployee,
} from '@/features/claims/data/queries'
import { Skeleton } from '@/components/ui/skeleton'

const FinanceDashboard = nextDynamic(
  () =>
    import('@/features/dashboard/components/finance-dashboard').then(
      (mod) => mod.FinanceDashboard
    ),
  {
    loading: () => (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <Skeleton className="h-12 w-64 rounded-lg" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[340px] rounded-xl" />
        </div>
      </div>
    ),
  }
)

const AdminAnalyticsDashboard = nextDynamic(
  () =>
    import('@/features/admin/components/admin-analytics-dashboard').then(
      (mod) => mod.AdminAnalyticsDashboard
    ),
  {
    loading: () => (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <Skeleton className="h-12 w-80 rounded-lg" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      </div>
    ),
  }
)

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const [user, supabase] = await Promise.all([
    requireCurrentUser('/login'),
    createSupabaseServerClient(),
  ])

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

  if (dashboardAccess.canViewAdmin) {
    return <AdminAnalyticsDashboard />
  }

  if (dashboardAccess.canViewFinanceQueue) {
    return (
      <FinanceDashboard employee={{ employeeName: employee.employee_name }} />
    )
  }

  const statsPromise = getDashboardClaimStats(supabase, employee.id)
  const recentClaimsPromise = getRecentClaimsForEmployee(supabase, employee.id)

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
