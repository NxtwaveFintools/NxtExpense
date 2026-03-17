import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { requireCurrentUser } from '@/features/auth/queries'
import { ClaimDetail } from '@/features/claims/components/claim-detail'
import { ClaimHistoryTimeline } from '@/features/claims/components/claim-history-timeline'
import { ClaimStatusBadge } from '@/features/claims/components/claim-status-badge'
import {
  getClaimAvailableActions,
  getClaimById,
  getClaimHistory,
} from '@/features/claims/queries'
import { canAccessEmployeeClaims } from '@/features/employees/permissions'
import {
  getEmployeeByEmail,
  getEmployeeById,
} from '@/lib/services/employee-service'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ApprovalActions } from '@/features/approvals/components/approval-actions'
import { FinanceActions } from '@/features/finance/components/finance-actions'
import { withSubmittedHistoryFallback } from '@/features/claims/utils/history'

type ClaimDetailPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    from?: string
  }>
}

const SOURCE_BACK_CONFIG: Record<string, { href: string; label: string }> = {
  approvals: { href: '/approvals', label: 'Back to Approvals' },
  finance: { href: '/finance', label: 'Back to Finance' },
}

export default async function ClaimDetailPage({
  params,
  searchParams,
}: ClaimDetailPageProps) {
  const user = await requireCurrentUser('/login')
  const supabase = await createSupabaseServerClient()
  const employee = await getEmployeeByEmail(supabase, user.email ?? '')

  if (!employee) {
    redirect('/dashboard')
  }

  const { id } = await params
  const claimWithItems = await getClaimById(supabase, id)

  if (!claimWithItems) {
    notFound()
  }

  const owner = await getEmployeeById(
    supabase,
    claimWithItems.claim.employee_id
  )
  if (!owner) {
    notFound()
  }

  const { from } = await searchParams
  const sourceConfig = from ? SOURCE_BACK_CONFIG[from] : null

  let backHref: string
  let backLabel: string
  if (sourceConfig) {
    backHref = sourceConfig.href
    backLabel = sourceConfig.label
  } else {
    const hasClaimAccess = await canAccessEmployeeClaims(supabase, employee)
    backHref = hasClaimAccess ? '/claims' : '/dashboard'
    backLabel = hasClaimAccess ? 'Back to My Claims' : 'Back to Dashboard'
  }

  const [history, availableActions] = await Promise.all([
    getClaimHistory(supabase, id),
    getClaimAvailableActions(supabase, id),
  ])

  const timelineHistory = withSubmittedHistoryFallback({
    claimId: claimWithItems.claim.id,
    history,
    submittedAt: claimWithItems.claim.submitted_at,
    createdAt: claimWithItems.claim.created_at,
    ownerEmail: owner.employee_email,
    ownerName: owner.employee_name,
  })

  const showApprovalActions = from === 'approvals'
  const showFinanceActions = from === 'finance'

  return (
    <>
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={backHref}
                className="inline-flex rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium"
              >
                {backLabel}
              </Link>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ClaimDetail
              claim={claimWithItems.claim}
              items={claimWithItems.items}
              employeeName={owner.employee_name}
              owner={owner}
            />
            <div className="space-y-6">
              <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h3 className="text-base font-semibold">Current Status</h3>
                <div className="mt-3">
                  <ClaimStatusBadge
                    statusName={claimWithItems.claim.statusName}
                    statusDisplayColor={claimWithItems.claim.statusDisplayColor}
                  />
                </div>
              </section>

              {showApprovalActions ? (
                <ApprovalActions
                  claimId={claimWithItems.claim.id}
                  availableActions={availableActions}
                />
              ) : null}

              {showFinanceActions ? (
                <FinanceActions
                  claimId={claimWithItems.claim.id}
                  availableActions={availableActions}
                />
              ) : null}

              <ClaimHistoryTimeline history={timelineHistory} />
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
