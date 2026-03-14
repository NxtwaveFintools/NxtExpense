import { Banknote, Clock3, FileText, UserCircle, Activity } from 'lucide-react'

import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getEmployeeByEmail,
  hasApproverAssignments,
} from '@/lib/services/employee-service'
import { getDashboardAccess } from '@/features/employees/permissions'
import { formatDate } from '@/lib/utils/date'
import { getClaimStatusDisplayLabel } from '@/lib/utils/claim-status'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ClaimStats = {
  total: number
  pending: number
  approved: number
  rejected: number
}
type RecentClaim = {
  id: string
  claim_number: string | null
  claim_date: string
  total_amount: number
  statusName: string
  displayColor: string
}

function isRejectedStatus(
  statusCode: string | null,
  statusName: string | null
): boolean {
  const normalizedCode = (statusCode ?? '').toUpperCase()
  const normalizedName = (statusName ?? '').toLowerCase()

  return (
    normalizedCode.includes('REJECTED') || normalizedName.includes('rejected')
  )
}

function isFinanceApprovedStatus(
  statusCode: string | null,
  statusName: string | null
): boolean {
  const normalizedCode = (statusCode ?? '').toUpperCase()
  const normalizedName = (statusName ?? '').toLowerCase()

  return (
    normalizedCode === 'APPROVED' ||
    normalizedCode.includes('ISSUED') ||
    normalizedName === 'approved' ||
    normalizedName === 'finance approved' ||
    normalizedName.includes('issued')
  )
}

async function getEmployeeClaimStats(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  employeeId: string
): Promise<ClaimStats> {
  const { data, error } = await supabase
    .from('expense_claims')
    .select('id, claim_statuses!status_id(status_code, status_name)')
    .eq('employee_id', employeeId)

  if (error) {
    throw new Error(error.message)
  }

  const rows = data ?? []

  let pending = 0
  let rejected = 0
  let approved = 0
  for (const row of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusInfo = Array.isArray((row as any).claim_statuses)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (row as any).claim_statuses[0]
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (row as any).claim_statuses
    const statusCode =
      (statusInfo?.status_code as string | null | undefined) ?? null
    const statusName =
      (statusInfo?.status_name as string | null | undefined) ?? null

    if (isRejectedStatus(statusCode, statusName)) {
      rejected++
      continue
    }

    if (isFinanceApprovedStatus(statusCode, statusName)) {
      approved++
      continue
    }

    pending++
  }

  return { total: rows.length, pending, approved, rejected }
}

async function getRecentClaims(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  employeeId: string
): Promise<RecentClaim[]> {
  const { data } = await supabase
    .from('expense_claims')
    .select(
      'id, claim_number, claim_date, total_amount, claim_statuses!status_id(status_code, status_name, display_color)'
    )
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(5)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => {
    const statusInfo = Array.isArray(r.claim_statuses)
      ? r.claim_statuses[0]
      : r.claim_statuses
    return {
      id: r.id,
      claim_number: r.claim_number,
      claim_date: r.claim_date,
      total_amount: Number(r.total_amount ?? 0),
      statusName: getClaimStatusDisplayLabel(
        statusInfo?.status_code,
        statusInfo?.status_name
      ),
      displayColor: statusInfo?.display_color ?? 'gray',
    }
  })
}

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
  const dashboardAccess = await getDashboardAccess(
    supabase,
    employee,
    approverAccess
  )

  const [stats, recentClaims] = await Promise.all([
    getEmployeeClaimStats(supabase, employee.id),
    getRecentClaims(supabase, employee.id),
  ])

  return (
    <>
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Dashboard
              </h1>
              <p className="text-sm text-foreground/70">
                Submit your daily field expenses and track their approval status
                — all in one place.
              </p>
            </div>
            {dashboardAccess.canCreateClaims ? (
              <Link
                href="/claims/new"
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                + New Claim
              </Link>
            ) : null}
          </div>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-medium">
              <UserCircle
                className="size-5 text-foreground/70"
                aria-hidden="true"
              />
              Your Details
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
                <dd>{employee.designations?.designation_name ?? ''}</dd>
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
                  Claims Processing
                </h2>
                <p className="mt-1 text-sm text-foreground/70">
                  Review approved claims and issue payments or rejections.
                </p>
              </Link>
            ) : null}
          </section>

          {/* Claim Stats */}
          {dashboardAccess.canViewClaims && stats.total > 0 ? (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Total', value: stats.total, cls: 'text-foreground' },
                {
                  label: 'Pending',
                  value: stats.pending,
                  cls: 'text-yellow-600',
                },
                {
                  label: 'Finance Approved',
                  value: stats.approved,
                  cls: 'text-green-600',
                },
                {
                  label: 'Rejected',
                  value: stats.rejected,
                  cls: 'text-red-600',
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-border bg-surface p-4 text-center shadow-sm"
                >
                  <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                  <p className="mt-1 text-xs text-foreground/60">{s.label}</p>
                </div>
              ))}
            </section>
          ) : null}

          {/* Recent Claims */}
          {dashboardAccess.canViewClaims && recentClaims.length > 0 ? (
            <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-medium">
                <Activity
                  className="size-5 text-foreground/70"
                  aria-hidden="true"
                />
                Recent Claims
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-foreground/70 whitespace-nowrap">
                        Claim #
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-foreground/70">
                        Date
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-foreground/70">
                        Amount
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-foreground/70">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentClaims.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/50">
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                          {c.claim_number ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          {formatDate(c.claim_date)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          ₹{c.total_amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <StatusBadge
                            statusName={c.statusName}
                            displayColor={c.displayColor}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </>
  )
}

// Keys match display_color values in claim_statuses — same palette as ClaimStatusBadge
const COLOR_STYLES: Record<string, string> = {
  gray: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  yellow: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
}

function StatusBadge({
  statusName,
  displayColor,
}: {
  statusName: string
  displayColor: string
}) {
  const cls = COLOR_STYLES[displayColor] ?? COLOR_STYLES.gray
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {statusName}
    </span>
  )
}
