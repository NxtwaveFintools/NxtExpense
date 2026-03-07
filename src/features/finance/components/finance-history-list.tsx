import Link from 'next/link'

import { formatDate, formatDatetime } from '@/lib/utils/date'
import { CursorPaginationControls } from '@/components/ui/cursor-pagination-controls'

import { getFinanceHistoryAction } from '@/features/finance/actions'
import type { ClaimStatusCatalogItem } from '@/features/claims/types'

type FinanceHistoryPayload = Awaited<ReturnType<typeof getFinanceHistoryAction>>

type FinanceHistoryListProps = {
  history: FinanceHistoryPayload
  statusCatalog: ClaimStatusCatalogItem[]
  pagination: {
    backHref: string | null
    nextHref: string | null
    pageNumber: number
  }
}

const COMPACT_STATUS_STYLE_BY_TOKEN: Record<string, string> = {
  slate:
    'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  blue: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  amber:
    'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  orange:
    'border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  emerald:
    'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  red: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  indigo:
    'border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  teal: 'border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  rose: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  neutral: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
}

function FinanceStatusBadge({
  status,
  statusCatalog,
}: {
  status: string
  statusCatalog: ClaimStatusCatalogItem[]
}) {
  const matchedStatus = statusCatalog.find((entry) => entry.status === status)
  const colorToken = matchedStatus?.color_token ?? 'neutral'

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold ${
        COMPACT_STATUS_STYLE_BY_TOKEN[colorToken] ??
        COMPACT_STATUS_STYLE_BY_TOKEN.neutral
      }`}
    >
      {matchedStatus?.display_label ?? status.replaceAll('_', ' ')}
    </span>
  )
}

export function FinanceHistoryList({
  history,
  statusCatalog,
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
                    href={`/claims/${row.claim.id}`}
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
                  <FinanceStatusBadge
                    status={row.claim.status}
                    statusCatalog={statusCatalog}
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
