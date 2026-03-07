import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { requireCurrentUser } from '@/features/auth/queries'
import { ClaimDetail } from '@/features/claims/components/claim-detail'
import { ClaimHistoryTimeline } from '@/features/claims/components/claim-history-timeline'
import { ClaimStatusBadge } from '@/features/claims/components/claim-status-badge'
import {
  getClaimById,
  getClaimHistory,
  getClaimStatusCatalog,
} from '@/features/claims/queries'
import { canAccessEmployeeClaims } from '@/features/employees/permissions'
import {
  getEmployeeByEmail,
  getEmployeeById,
} from '@/features/employees/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type ClaimDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function ClaimDetailPage({
  params,
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

  const isClaimOwner = owner.id === employee.id
  const canModifyClaim =
    isClaimOwner && claimWithItems.claim.status === 'returned_for_modification'
  const backHref = canAccessEmployeeClaims(employee) ? '/claims' : '/dashboard'
  const backLabel = canAccessEmployeeClaims(employee)
    ? 'Back to My Claims'
    : 'Back to Dashboard'

  const [history, statusCatalog] = await Promise.all([
    getClaimHistory(supabase, id),
    getClaimStatusCatalog(supabase),
  ])

  return (
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
            {canModifyClaim ? (
              <Link
                href={`/claims/new?editClaimId=${claimWithItems.claim.id}`}
                className="inline-flex rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background"
              >
                Modify And Resubmit
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ClaimDetail
            claim={claimWithItems.claim}
            items={claimWithItems.items}
            employeeName={owner.employee_name}
          />
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h3 className="text-base font-semibold">Current Status</h3>
              <div className="mt-3">
                <ClaimStatusBadge
                  status={claimWithItems.claim.status}
                  statusCatalog={statusCatalog}
                />
              </div>
            </section>
            <ClaimHistoryTimeline history={history} />
          </div>
        </div>
      </div>
    </main>
  )
}
