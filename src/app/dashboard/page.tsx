import { Banknote, Clock3, FileText, UserCircle } from 'lucide-react'

import { LogoutButton } from '@/features/auth/components/logout-button'
import { requireCurrentUser } from '@/features/auth/queries'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getEmployeeByEmail,
  hasApproverAssignments,
} from '@/features/employees/queries'
import { getDashboardAccess } from '@/features/employees/permissions'
import Link from 'next/link'
import { redirect } from 'next/navigation'

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
    redirect('/login')
  }

  const approverAccess = await hasApproverAssignments(
    supabase,
    employee.employee_email
  )
  const dashboardAccess = getDashboardAccess(employee, approverAccess)

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-foreground/60">
              NxtExpense
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-foreground/70">
              Claim submission, approvals, and finance processing in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dashboardAccess.canCreateClaims ? (
              <Link
                href="/claims/new"
                className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background"
              >
                New Claim
              </Link>
            ) : null}
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <UserCircle
              className="size-5 text-foreground/70"
              aria-hidden="true"
            />
            User Information
          </h2>
          <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            <div className="space-y-1 rounded-lg border border-border bg-background p-4">
              <dt className="text-foreground/60">Email</dt>
              <dd>{user.email ?? 'Not available'}</dd>
            </div>
            <div className="space-y-1 rounded-lg border border-border bg-background p-4">
              <dt className="text-foreground/60">Employee Code</dt>
              <dd>{employee.employee_id}</dd>
            </div>
            <div className="space-y-1 rounded-lg border border-border bg-background p-4">
              <dt className="text-foreground/60">Designation</dt>
              <dd>{employee.designation}</dd>
            </div>
          </dl>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {dashboardAccess.canViewClaims ? (
            <Link
              href="/claims"
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:bg-muted"
            >
              <p className="text-xs uppercase tracking-widest text-foreground/60">
                Employee
              </p>
              <h2 className="mt-1 inline-flex items-center gap-2 text-lg font-semibold">
                <FileText className="size-4" aria-hidden="true" />
                My Claims
              </h2>
              <p className="mt-1 text-sm text-foreground/70">
                Submit and track daily expense claims.
              </p>
            </Link>
          ) : null}

          {dashboardAccess.canViewApprovals ? (
            <Link
              href="/approvals"
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:bg-muted"
            >
              <p className="text-xs uppercase tracking-widest text-foreground/60">
                Manager
              </p>
              <h2 className="mt-1 inline-flex items-center gap-2 text-lg font-semibold">
                <Clock3 className="size-4" aria-hidden="true" />
                Pending Approvals
              </h2>
              <p className="mt-1 text-sm text-foreground/70">
                Review claims assigned at your approval level.
              </p>
            </Link>
          ) : null}

          {dashboardAccess.canViewFinanceQueue ? (
            <Link
              href="/finance"
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:bg-muted"
            >
              <p className="text-xs uppercase tracking-widest text-foreground/60">
                Finance
              </p>
              <h2 className="mt-1 inline-flex items-center gap-2 text-lg font-semibold">
                <Banknote className="size-4" aria-hidden="true" />
                Finance Queue
              </h2>
              <p className="mt-1 text-sm text-foreground/70">
                Issue or reject claims after final approval.
              </p>
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  )
}
