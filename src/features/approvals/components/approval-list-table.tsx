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
  onRunSingleAction: (claimId: string, action: ClaimAvailableAction) => void
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
                    {item.availableActions
                      .filter(
                        (action: ClaimAvailableAction) =>
                          action.action === 'approved' ||
                          action.action === 'rejected'
                      )
                      .map((action: ClaimAvailableAction) => (
                        <button
                          key={`${item.claim.id}-${action.action}`}
                          type="button"
                          disabled={isProcessing}
                          onClick={() =>
                            onRunSingleAction(item.claim.id, action)
                          }
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                            action.action === 'approved'
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-rose-600 text-white hover:bg-rose-700'
                          }`}
                        >
                          {isRowProcessing &&
                          processingAction === action.action ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : null}
                          {isRowProcessing && processingAction === action.action
                            ? 'Processing...'
                            : action.display_label}
                        </button>
                      ))}
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
