import Link from 'next/link'

import { formatDate, formatDatetime } from '@/lib/utils/date'
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

function isSameMoment(left: string | null, right: string): boolean {
  if (!left) {
    return false
  }

  return new Date(left).getTime() === new Date(right).getTime()
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
        Each row is a workflow event. A single claim can appear multiple times
        as it moves through different approval levels and finance actions.
      </p>

      <CursorPaginationControls
        backHref={pagination.backHref}
        nextHref={pagination.nextHref}
        pageNumber={pagination.pageNumber}
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-280 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-foreground/70">
              <th className="px-3 py-2 font-medium">Claim ID</th>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Claim Date</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Action Date</th>
              <th className="px-3 py-2 font-medium">HOD Approved Date</th>
              <th className="px-3 py-2 font-medium">Finance Approved Date</th>
              <th className="px-3 py-2 font-medium">Current Status</th>
            </tr>
          </thead>
          <tbody>
            {history.data.map((row) => (
              <tr key={row.actionId} className="border-b border-border/70">
                <td className="px-3 py-3 font-medium">
                  <Link
                    href={`/claims/${row.claimId}?from=approvals`}
                    className="underline decoration-border underline-offset-4 hover:decoration-foreground"
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
                  <p>{row.actorEmail}</p>
                  <p className="text-xs text-foreground/60">
                    {row.actorDesignation ?? 'Unknown Role'}
                  </p>
                </td>
                <td className="px-3 py-3 capitalize">
                  {row.action.replaceAll('_', ' ')}
                </td>
                <td className="px-3 py-3">{formatDatetime(row.actedAt)}</td>
                <td className="px-3 py-3">
                  {row.hodApprovedAt &&
                  !isSameMoment(row.hodApprovedAt, row.actedAt)
                    ? formatDate(row.hodApprovedAt)
                    : '-'}
                </td>
                <td className="px-3 py-3">
                  {row.financeApprovedAt &&
                  !isSameMoment(row.financeApprovedAt, row.actedAt)
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
