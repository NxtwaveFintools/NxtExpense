import { notFound } from 'next/navigation'
import Link from 'next/link'

import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import {
  getClaimAvailableActions,
  getClaimById,
} from '@/features/claims/queries'
import { getEmployeeById } from '@/features/employees/queries'
import { getClaimApprovalHistory } from '@/features/approvals/queries'
import { ApprovalDetail } from '@/features/approvals/components/approval-detail'
import { ApprovalActions } from '@/features/approvals/components/approval-actions'
import { ApprovalHistoryTimeline } from '@/features/approvals/components/approval-history-timeline'

export const dynamic = 'force-dynamic'

type ApprovalDetailsPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function ApprovalDetailsPage({
  params,
}: ApprovalDetailsPageProps) {
  await requireCurrentUser('/login')
  const { id } = await params

  const supabase = await createSupabaseServerClient()
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

  const [history, availableActions] = await Promise.all([
    getClaimApprovalHistory(supabase, id),
    getClaimAvailableActions(supabase, id),
  ])

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-4">
          <Link
            href="/approvals"
            className="inline-flex rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium"
          >
            Back to Approvals
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ApprovalDetail
            claim={claimWithItems.claim}
            items={claimWithItems.items}
            owner={owner}
          />
          <div className="space-y-6">
            <ApprovalActions
              claimId={claimWithItems.claim.id}
              availableActions={availableActions}
            />
            <ApprovalHistoryTimeline history={history} />
          </div>
        </div>
      </div>
    </main>
  )
}
