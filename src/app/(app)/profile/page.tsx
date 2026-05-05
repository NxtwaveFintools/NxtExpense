import type { Metadata } from 'next'
import { UserCircle, Building2, ShieldCheck, TrendingUp } from 'lucide-react'
import { redirect } from 'next/navigation'

import { requireCurrentUser } from '@/features/auth/queries'
import { getProfileClaimStats } from '@/features/claims/data/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getEmployeeByEmail,
  getEmployeeNameMapByIds,
} from '@/lib/services/employee-service'
import { canAccessEmployeeClaims } from '@/features/employees/permissions'
import { formatDate } from '@/lib/utils/date'
import { AnimatedNumber } from '@/components/ui/animated-number'

export const metadata: Metadata = { title: 'Profile' }
export const dynamic = 'force-dynamic'

type ClaimStats = {
  total: number
  pending: number
  financeApproved: number
  rejected: number
  paymentReleased: number
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

  const canViewClaimSummary = await canAccessEmployeeClaims(supabase, employee)

  const [stats, approverNameMap] = await Promise.all([
    canViewClaimSummary
      ? getProfileClaimStats(supabase, employee.id)
      : Promise.resolve<ClaimStats | null>(null),
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

  const statCards = stats
    ? [
        {
          label: 'Total Claims',
          value: stats.total,
          color: 'text-foreground',
          bgIcon: 'bg-primary/10',
          iconColor: 'text-primary',
        },
        {
          label: 'Pending',
          value: stats.pending,
          color: 'text-amber-600 dark:text-amber-400',
          bgIcon: 'bg-amber-500/10',
          iconColor: 'text-amber-600',
        },
        {
          label: 'Finance Approved',
          value: stats.financeApproved,
          color: 'text-emerald-600 dark:text-emerald-400',
          bgIcon: 'bg-emerald-500/10',
          iconColor: 'text-emerald-600',
        },
        {
          label: 'Rejected',
          value: stats.rejected,
          color: 'text-rose-600 dark:text-rose-400',
          bgIcon: 'bg-rose-500/10',
          iconColor: 'text-rose-600',
        },
        {
          label: 'Payment Released',
          value: stats.paymentReleased,
          color: 'text-blue-600 dark:text-blue-400',
          bgIcon: 'bg-blue-500/10',
          iconColor: 'text-blue-600',
        },
      ]
    : []

  const initials = employee.employee_name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const displayName = employee.employee_id
    ? `${employee.employee_name} (${employee.employee_id})`
    : employee.employee_name

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 animate-fade-in">
        {/* Profile Header */}
        <div className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-lg bg-primary/10 text-xl font-semibold text-primary ring-1 ring-primary">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {employee.designations?.designation_name ?? ''} ·{' '}
              {employee.employee_email}
            </p>
          </div>
        </div>

        {/* Employee Details */}
        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <UserCircle className="size-4 text-primary" aria-hidden="true" />
            </div>
            Employee Details
          </h2>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
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
        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            </div>
            Approval Chain
          </h2>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
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
        {canViewClaimSummary ? (
          <section className="rounded-lg border border-border bg-surface p-6">
            <h2 className="flex items-center gap-2.5 text-lg font-semibold">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="size-4 text-primary" aria-hidden="true" />
              </div>
              Claim Summary
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {statCards.map((s) => (
                <div
                  key={s.label}
                  className="rounded-md border border-border bg-background p-4 text-center"
                >
                  <div className="mx-auto mb-2 flex size-8 items-center justify-center rounded-lg">
                    <div
                      className={`flex size-8 items-center justify-center rounded-lg ${s.bgIcon}`}
                    >
                      <TrendingUp className={`size-3.5 ${s.iconColor}`} />
                    </div>
                  </div>
                  <p className={`text-2xl font-semibold ${s.color}`}>
                    <AnimatedNumber value={s.value} />
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-md border border-border bg-background p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-medium break-all">{value}</dd>
    </div>
  )
}
