import { UserCircle, Building2, ShieldCheck } from 'lucide-react'

import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getEmployeeByEmail,
  getEmployeeNameMapByIds,
} from '@/lib/services/employee-service'
import { getAllClaimStatuses } from '@/lib/services/config-service'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils/date'

export const dynamic = 'force-dynamic'

type ClaimStats = {
  total: number
  pending: number
  approved: number
  rejected: number
  issued: number
}

async function getClaimStats(
  supabase: ReturnType<typeof createSupabaseServerClient> extends Promise<
    infer T
  >
    ? T
    : never,
  employeeId: string
): Promise<ClaimStats> {
  const [statusCatalog, claimsResult] = await Promise.all([
    getAllClaimStatuses(supabase),
    supabase
      .from('expense_claims')
      .select('status_id')
      .eq('employee_id', employeeId),
  ])

  if (claimsResult.error)
    return { total: 0, pending: 0, approved: 0, rejected: 0, issued: 0 }

  const rows = claimsResult.data ?? []

  const rejectionIds = new Set(
    statusCatalog.filter((s) => s.is_rejection).map((s) => s.id)
  )
  const issuedIds = new Set(
    statusCatalog.filter((s) => s.is_payment_issued).map((s) => s.id)
  )
  const terminalNonRejectNonIssuedIds = new Set(
    statusCatalog
      .filter((s) => s.is_terminal && !s.is_rejection && !s.is_payment_issued)
      .map((s) => s.id)
  )

  let pending = 0
  let rejected = 0
  let issued = 0
  let approved = 0
  for (const row of rows) {
    const sid = row.status_id as string
    if (issuedIds.has(sid)) {
      issued++
    } else if (rejectionIds.has(sid)) {
      rejected++
    } else if (terminalNonRejectNonIssuedIds.has(sid)) {
      approved++
    } else {
      pending++
    }
  }

  return { total: rows.length, pending, approved, rejected, issued }
}

export default async function ProfilePage() {
  const user = await requireCurrentUser('/login')
  const supabase = await createSupabaseServerClient()

  const employee = await getEmployeeByEmail(supabase, user.email ?? '')
  if (!employee) redirect('/login')

  const approverIds = [
    employee.approval_employee_id_level_1,
    employee.approval_employee_id_level_2,
    employee.approval_employee_id_level_3,
  ].filter((id): id is string => id !== null)

  const [stats, approverNameMap] = await Promise.all([
    getClaimStats(supabase, employee.id),
    getEmployeeNameMapByIds(supabase, approverIds),
  ])

  const approvalChain = [
    {
      level: 'Level 1 (SBH)',
      approverId: employee.approval_employee_id_level_1,
    },
    {
      level: 'Level 2 (ZBH)',
      approverId: employee.approval_employee_id_level_2,
    },
    {
      level: 'Level 3 (Final)',
      approverId: employee.approval_employee_id_level_3,
    },
  ]

  const statCards = [
    { label: 'Total Claims', value: stats.total, color: 'text-foreground' },
    { label: 'Pending', value: stats.pending, color: 'text-yellow-600' },
    {
      label: 'Finance Approved',
      value: stats.approved,
      color: 'text-green-600',
    },
    { label: 'Rejected', value: stats.rejected, color: 'text-red-600' },
    { label: 'Issued', value: stats.issued, color: 'text-blue-600' },
  ]

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>

        {/* Employee Info */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <UserCircle
              className="size-5 text-foreground/70"
              aria-hidden="true"
            />
            Employee Details
          </h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <InfoCard label="Name" value={employee.employee_name} />
            <InfoCard label="Employee Code" value={employee.employee_id} />
            <InfoCard label="Email" value={employee.employee_email} />
            <InfoCard
              label="Designation"
              value={employee.designations?.designation_name ?? ''}
            />
            <InfoCard
              label="State"
              value={
                employee.employee_states?.find((s) => s.is_primary)?.states
                  ?.state_name ?? ''
              }
            />
            <InfoCard label="Joined" value={formatDate(employee.created_at)} />
          </dl>
        </section>

        {/* Approval Chain */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <ShieldCheck
              className="size-5 text-foreground/70"
              aria-hidden="true"
            />
            Approval Chain
          </h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            {approvalChain.map((a) => (
              <InfoCard
                key={a.level}
                label={a.level}
                value={
                  a.approverId
                    ? (approverNameMap[a.approverId] ?? 'Assigned')
                    : 'Not assigned'
                }
              />
            ))}
          </dl>
        </section>

        {/* Claim Stats */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <Building2
              className="size-5 text-foreground/70"
              aria-hidden="true"
            />
            Claim Summary
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {statCards.map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-border bg-background p-4 text-center"
              >
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="mt-1 text-xs text-foreground/60">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-lg border border-border bg-background p-4">
      <dt className="text-foreground/60">{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  )
}
