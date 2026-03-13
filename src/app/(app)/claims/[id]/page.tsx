import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { requireCurrentUser } from '@/features/auth/queries'
import { ClaimDetail } from '@/features/claims/components/claim-detail'
import { ClaimHistoryTimeline } from '@/features/claims/components/claim-history-timeline'
import { ClaimStatusBadge } from '@/features/claims/components/claim-status-badge'
import { getClaimById, getClaimHistory } from '@/features/claims/queries'
import { canAccessEmployeeClaims } from '@/features/employees/permissions'
import {
  getEmployeeByEmail,
  getEmployeeById,
} from '@/lib/services/employee-service'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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

  const [history] = await Promise.all([getClaimHistory(supabase, id)])

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
              <ClaimHistoryTimeline history={history} />
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
