import Link from 'next/link'
import { Suspense, use } from 'react'
import {
  ArrowRight,
  Banknote,
  Clock3,
  FileText,
  UserCircle,
} from 'lucide-react'

import {
  DATA_TABLE_BODY_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_ROW_CLASS,
  DATA_TABLE_SCROLL_WRAPPER_CLASS,
  getDataTableCellClass,
  getDataTableHeadCellClass,
} from '@/components/ui/data-table-tokens'
import { ClaimAnalyticsCards } from '@/components/ui/claim-analytics-cards'
import { ClaimStatusBadge } from '@/features/claims/components/claim-status-badge'
import type {
  DashboardClaimStats,
  DashboardRecentClaim,
} from '@/features/dashboard/queries/dashboard-metrics'
import { formatDate } from '@/lib/utils/date'

type DashboardAccess = {
  canCreateClaims: boolean
  canViewClaims: boolean
  canViewApprovals: boolean
  canViewFinanceQueue: boolean
}

type EmployeeDashboardInfo = {
  email: string | null
  employeeId: string
  employeeName: string
  designationName: string | null
}

type DashboardContentProps = {
  access: DashboardAccess
  employee: EmployeeDashboardInfo
  statsPromise: Promise<DashboardClaimStats>
  recentClaimsPromise: Promise<DashboardRecentClaim[]>
}

type QuickAccessCardProps = {
  href: string
  roleLabel: string
  title: string
  description: string
  icon: React.ReactNode
}

function QuickAccessCard({
  href,
  roleLabel,
  title,
  description,
  icon,
}: QuickAccessCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border bg-surface p-6 shadow-sm card-hover"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {roleLabel}
        </p>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>
      <h2 className="mt-3 inline-flex items-center gap-2.5 font-display text-lg font-bold">
        {icon}
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Link>
  )
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function DashboardClaimsSkeleton() {
  return (
    <div className="space-y-4 animate-slide-up stagger-4">
      <div className="h-28 rounded-2xl border border-border bg-muted/40" />
      <div className="h-44 rounded-lg border border-border bg-muted/40" />
    </div>
  )
}

function DashboardClaimSummarySections({
  access,
  statsPromise,
  recentClaimsPromise,
}: {
  access: DashboardAccess
  statsPromise: Promise<DashboardClaimStats>
  recentClaimsPromise: Promise<DashboardRecentClaim[]>
}) {
  const stats = use(statsPromise)
  const recentClaims = use(recentClaimsPromise)

  if (!access.canViewClaims) {
    return null
  }

  return (
    <>
      {stats.total.count > 0 ? (
        <ClaimAnalyticsCards
          columnsClassName="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
          className="animate-slide-up stagger-4"
          cards={[
            {
              label: 'Total Claims',
              count: stats.total.count,
              amount: stats.total.amount,
              tone: 'neutral',
            },
            {
              label: 'Pending',
              count: stats.pending.count,
              amount: stats.pending.amount,
              tone: 'pending',
            },
            {
              label: 'Payment Issued',
              count: stats.approved.count,
              amount: stats.approved.amount,
              tone: 'approved',
            },
            {
              label: 'Rejected',
              count: stats.rejected.count,
              amount: stats.rejected.amount,
              tone: 'rejected',
            },
            {
              label: 'Rejected - Allow Reclaim',
              count: stats.rejectedAllowReclaim.count,
              amount: stats.rejectedAllowReclaim.amount,
              tone: 'finance',
            },
          ]}
        />
      ) : null}

      {recentClaims.length > 0 ? (
        <section className="rounded-lg border border-border bg-surface animate-slide-up stagger-5">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold">Recent Claims</h2>
          </div>
          <div className={DATA_TABLE_SCROLL_WRAPPER_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={getDataTableHeadCellClass({ nowrap: true })}>
                    Claim #
                  </th>
                  <th className={getDataTableHeadCellClass()}>Date</th>
                  <th className={getDataTableHeadCellClass({ align: 'right' })}>
                    Amount
                  </th>
                  <th className={getDataTableHeadCellClass()}>Status</th>
                </tr>
              </thead>
              <tbody className={DATA_TABLE_BODY_CLASS}>
                {recentClaims.map((claim) => (
                  <tr key={claim.id} className={DATA_TABLE_ROW_CLASS}>
                    <td
                      className={getDataTableCellClass({
                        nowrap: true,
                        weight: 'medium',
                      })}
                    >
                      {claim.claim_number ?? '—'}
                    </td>
                    <td className={getDataTableCellClass({ muted: true })}>
                      {formatDate(claim.claim_date)}
                    </td>
                    <td
                      className={getDataTableCellClass({
                        align: 'right',
                        mono: true,
                        weight: 'medium',
                      })}
                    >
                      ₹{claim.total_amount.toLocaleString('en-IN')}
                    </td>
                    <td className={getDataTableCellClass()}>
                      <ClaimStatusBadge
                        statusName={claim.statusName}
                        statusDisplayColor={claim.displayColor}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  )
}

export function DashboardContent({
  access,
  employee,
  statsPromise,
  recentClaimsPromise,
}: DashboardContentProps) {
  const greeting = getGreeting(new Date().getHours())
  const fullName = employee.employeeName.trim()

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4 animate-slide-up stagger-1">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              {greeting}, {fullName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit your daily field expenses and track their approval status
              in one place.
            </p>
          </div>
          {access.canCreateClaims ? (
            <Link
              href="/claims/new"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md btn-press"
            >
              + New Claim
            </Link>
          ) : null}
        </div>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm animate-slide-up stagger-2">
          <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <UserCircle className="size-4 text-primary" aria-hidden="true" />
            </div>
            Your Details
          </h2>
          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-3">
            <div className="space-y-1 rounded-xl border border-border bg-background p-4">
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Email
              </dt>
              <dd className="font-medium">
                {employee.email ?? 'Not available'}
              </dd>
            </div>
            <div className="space-y-1 rounded-xl border border-border bg-background p-4">
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Employee Code
              </dt>
              <dd className="font-medium">{employee.employeeId}</dd>
            </div>
            <div className="space-y-1 rounded-xl border border-border bg-background p-4">
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Designation
              </dt>
              <dd className="font-medium">{employee.designationName ?? ''}</dd>
            </div>
          </dl>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-slide-up stagger-3">
          {access.canViewClaims ? (
            <QuickAccessCard
              href="/claims"
              roleLabel="Employee"
              title="My Claims"
              description="Submit and track daily expense claims."
              icon={
                <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10">
                  <FileText
                    className="size-4 text-blue-600 dark:text-blue-400"
                    aria-hidden="true"
                  />
                </div>
              }
            />
          ) : null}

          {access.canViewApprovals ? (
            <QuickAccessCard
              href="/approvals"
              roleLabel="Manager"
              title="Pending Approvals"
              description="Review claims assigned at your approval level."
              icon={
                <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10">
                  <Clock3
                    className="size-4 text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  />
                </div>
              }
            />
          ) : null}

          {access.canViewFinanceQueue ? (
            <QuickAccessCard
              href="/finance"
              roleLabel="Finance"
              title="Claims Processing"
              description="Review approved claims and issue payments or rejections."
              icon={
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Banknote
                    className="size-4 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                </div>
              }
            />
          ) : null}
        </section>

        <Suspense fallback={<DashboardClaimsSkeleton />}>
          <DashboardClaimSummarySections
            access={access}
            statsPromise={statsPromise}
            recentClaimsPromise={recentClaimsPromise}
          />
        </Suspense>
      </div>
    </main>
  )
}
