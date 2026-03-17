import Link from 'next/link'
import { Loader2 } from 'lucide-react'

import {
  DATA_TABLE_BODY_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_ROW_CLASS,
  DATA_TABLE_SCROLL_WRAPPER_CLASS,
  getDataTableCellClass,
  getDataTableHeadCellClass,
} from '@/components/ui/data-table-tokens'
import { ClaimStatusBadge } from '@/features/claims/components/claim-status-badge'
import { formatDate } from '@/lib/utils/date'

import type {
  PendingApproval,
  PaginatedPendingApprovals,
} from '@/features/approvals/types'
import type { ClaimAvailableAction } from '@/features/claims/types'

type ApprovalListTableProps = {
  approvals: PaginatedPendingApprovals
  selected: Set<string>
  isProcessing: boolean
  processingClaimId: string | null
  processingAction: string | null
  onToggleOne: (claimId: string, checked: boolean) => void
  onRunSingleAction: (
    claimId: string,
    action: ClaimAvailableAction,
    allowReclaim: boolean
  ) => void
}

export function ApprovalListTable({
  approvals,
  selected,
  isProcessing,
  processingClaimId,
  processingAction,
  onToggleOne,
  onRunSingleAction,
}: ApprovalListTableProps) {
  return (
    <div className={DATA_TABLE_SCROLL_WRAPPER_CLASS}>
      <table className={`${DATA_TABLE_CLASS} min-w-230`}>
        <thead>
          <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
            <th className="w-10 px-4 py-3" />
            <th className={getDataTableHeadCellClass({ nowrap: true })}>
              Claim ID
            </th>
            <th className={getDataTableHeadCellClass()}>Employee</th>
            <th className={getDataTableHeadCellClass()}>Date</th>
            <th className={getDataTableHeadCellClass()}>Location</th>
            <th className={getDataTableHeadCellClass()}>Amount</th>
            <th className={getDataTableHeadCellClass()}>Status</th>
            <th className={getDataTableHeadCellClass({ align: 'right' })}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className={DATA_TABLE_BODY_CLASS}>
          {approvals.data.map((item: PendingApproval) => {
            const isSelectable = item.availableActions.some(
              (action) =>
                action.action === 'approved' || action.action === 'rejected'
            )
            const approvedAction = item.availableActions.find(
              (action) => action.action === 'approved'
            )
            const rejectedAction = item.availableActions.find(
              (action) => action.action === 'rejected'
            )
            const isRowProcessing =
              isProcessing && processingClaimId === item.claim.id

            return (
              <tr key={item.claim.id} className={DATA_TABLE_ROW_CLASS}>
                <td className="px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={selected.has(item.claim.id)}
                    disabled={isProcessing || !isSelectable}
                    onChange={(event) =>
                      onToggleOne(item.claim.id, event.target.checked)
                    }
                    className="size-4 rounded border-border accent-primary"
                  />
                </td>
                <td
                  className={getDataTableCellClass({
                    nowrap: true,
                    weight: 'medium',
                  })}
                >
                  <Link
                    href={`/claims/${item.claim.id}?from=approvals`}
                    className="text-primary font-semibold hover:text-primary-hover transition-colors"
                  >
                    {item.claim.claim_number}
                  </Link>
                </td>
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {item.owner.employee_name}
                </td>
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {formatDate(item.claim.claim_date)}
                </td>
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {item.claim.work_location}
                </td>
                <td
                  className={getDataTableCellClass({
                    mono: true,
                    weight: 'medium',
                    nowrap: true,
                  })}
                >
                  Rs. {Number(item.claim.total_amount).toFixed(2)}
                </td>
                <td className={getDataTableCellClass()}>
                  <ClaimStatusBadge
                    statusName={item.claim.statusName}
                    statusDisplayColor={item.claim.statusDisplayColor}
                  />
                </td>
                <td className={getDataTableCellClass({ align: 'right' })}>
                  <div className="flex items-center justify-end gap-2">
                    {approvedAction ? (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() =>
                          onRunSingleAction(
                            item.claim.id,
                            approvedAction,
                            false
                          )
                        }
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {isRowProcessing && processingAction === 'approved' ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : null}
                        {isRowProcessing && processingAction === 'approved'
                          ? 'Processing...'
                          : approvedAction.display_label}
                      </button>
                    ) : null}

                    {rejectedAction ? (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() =>
                          onRunSingleAction(
                            item.claim.id,
                            rejectedAction,
                            false
                          )
                        }
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-rose-700 disabled:opacity-50"
                      >
                        {isRowProcessing && processingAction === 'rejected' ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : null}
                        {isRowProcessing && processingAction === 'rejected'
                          ? 'Processing...'
                          : rejectedAction.display_label}
                      </button>
                    ) : null}

                    {rejectedAction ? (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() =>
                          onRunSingleAction(item.claim.id, rejectedAction, true)
                        }
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-amber-700 disabled:opacity-50"
                      >
                        {isRowProcessing &&
                        processingAction === 'rejected_allow_reclaim' ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : null}
                        {isRowProcessing &&
                        processingAction === 'rejected_allow_reclaim'
                          ? 'Processing...'
                          : 'Reject & Allow Reclaim'}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
