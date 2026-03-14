import Link from 'next/link'

import { formatDate } from '@/lib/utils/date'
import { CursorPaginationControls } from '@/components/ui/cursor-pagination-controls'

import { getApprovalHistoryAction } from '@/features/approvals/actions'
import { ClaimStatusBadge } from '@/features/claims/components/claim-status-badge'

type ApprovalHistoryPayload = Awaited<
  ReturnType<typeof getApprovalHistoryAction>
>

type ApprovalHistoryListProps = {
  history: ApprovalHistoryPayload
  pagination: {
    backHref: string | null
    nextHref: string | null
    pageNumber: number
  }
}

export function ApprovalHistoryList({
  history,
  pagination,
}: ApprovalHistoryListProps) {
  if (history.data.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Approval History</h2>
        <p className="mt-2 text-sm text-foreground/70">
          No past approval actions found for your role.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Approval History</h2>
      <p className="mb-4 text-xs text-foreground/60">
        Each row shows one update made on a claim, along with the key approval
        milestone dates.
      </p>

      <CursorPaginationControls
        backHref={pagination.backHref}
        nextHref={pagination.nextHref}
        pageNumber={pagination.pageNumber}
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-240 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-foreground/70">
              <th className="px-3 py-2 font-medium whitespace-nowrap">
                Claim ID
              </th>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Claim Date</th>
              <th className="px-3 py-2 font-medium">HOD Approved Date</th>
              <th className="px-3 py-2 font-medium">Finance Approved Date</th>
              <th className="px-3 py-2 font-medium">Current Status</th>
            </tr>
          </thead>
          <tbody>
            {history.data.map((row) => (
              <tr key={row.actionId} className="border-b border-border/70">
                <td className="px-3 py-3 font-medium whitespace-nowrap">
                  <Link
                    href={`/claims/${row.claimId}?from=approvals`}
                    className="inline-block whitespace-nowrap underline decoration-border underline-offset-4 hover:decoration-foreground"
                  >
                    {row.claimNumber}
                  </Link>
                </td>
                <td className="px-3 py-3">{row.ownerName}</td>
                <td className="px-3 py-3 text-xs text-foreground/70">
                  {row.ownerDesignation}
                </td>
                <td className="px-3 py-3">{formatDate(row.claimDate)}</td>
                <td className="px-3 py-3">
                  {row.hodApprovedAt ? formatDate(row.hodApprovedAt) : '-'}
                </td>
                <td className="px-3 py-3">
                  {row.financeApprovedAt
                    ? formatDate(row.financeApprovedAt)
                    : '-'}
                </td>
                <td className="px-3 py-3">
                  <ClaimStatusBadge
                    statusName={row.claimStatusName}
                    statusDisplayColor={row.claimStatusDisplayColor}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
