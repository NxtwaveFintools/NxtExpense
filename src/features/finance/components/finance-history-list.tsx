import Link from 'next/link'

import { formatDate, formatDatetime } from '@/lib/utils/date'
import { CursorPaginationControls } from '@/components/ui/cursor-pagination-controls'

import { getFinanceHistoryAction } from '@/features/finance/actions'
import { ClaimStatusBadge } from '@/features/claims/components/claim-status-badge'

type FinanceHistoryPayload = Awaited<ReturnType<typeof getFinanceHistoryAction>>

type FinanceHistoryListProps = {
  history: FinanceHistoryPayload
  pagination: {
    backHref: string | null
    nextHref: string | null
    pageNumber: number
  }
}

export function FinanceHistoryList({
  history,
  pagination,
}: FinanceHistoryListProps) {
  if (history.data.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Finance History</h2>
        <p className="mt-2 text-sm text-foreground/70">
          No past finance actions found.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Finance History</h2>

      <CursorPaginationControls
        backHref={pagination.backHref}
        nextHref={pagination.nextHref}
        pageNumber={pagination.pageNumber}
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-245 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-foreground/70">
              <th className="px-3 py-2 font-medium">Claim ID</th>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Claim Date</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Action By</th>
              <th className="px-3 py-2 font-medium">Action Date</th>
              <th className="px-3 py-2 font-medium">Current Status</th>
            </tr>
          </thead>
          <tbody>
            {history.data.map((row) => (
              <tr key={row.action.id} className="border-b border-border/70">
                <td className="px-3 py-3 font-medium">
                  <Link
                    href={`/claims/${row.claim.id}?from=finance`}
                    className="underline decoration-border underline-offset-4 hover:decoration-foreground"
                  >
                    {row.claim.claim_number}
                  </Link>
                </td>
                <td className="px-3 py-3">{row.owner.employee_name}</td>
                <td className="px-3 py-3">
                  {formatDate(row.claim.claim_date)}
                </td>
                <td className="px-3 py-3">{row.claim.work_location}</td>
                <td className="px-3 py-3">
                  Rs. {Number(row.claim.total_amount).toFixed(2)}
                </td>
                <td className="px-3 py-3 capitalize">
                  {row.action.action.replaceAll('_', ' ')}
                </td>
                <td className="px-3 py-3 text-foreground/70">
                  {row.action.actor_name ?? row.action.actor_email}
                </td>
                <td className="px-3 py-3">
                  {formatDatetime(row.action.acted_at)}
                </td>
                <td className="px-3 py-3">
                  <ClaimStatusBadge
                    statusName={row.claim.statusName}
                    statusDisplayColor={row.claim.statusDisplayColor}
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
