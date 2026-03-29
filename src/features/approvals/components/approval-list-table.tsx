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
import {
  getWorkflowActionAllowReclaimLabel,
  getWorkflowActionCtaLabel,
} from '@/lib/utils/workflow-action-labels'

type ApprovalListTableProps = {
  approvals: PaginatedPendingApprovals
  pageStartIndex: number
  selected: Set<string>
  isProcessing: boolean
  processingClaimId: string | null
  processingAction: string | null
  dateSort: 'asc' | 'desc'
  onToggleDateSort: () => void
  onToggleOne: (claimId: string, checked: boolean) => void
  onRunSingleAction: (
    claimId: string,
    action: ClaimAvailableAction,
    allowResubmit: boolean
  ) => void
}

const ROW_ACTION_BUTTON_CLASSES = [
  'bg-emerald-600 hover:bg-emerald-700',
  'bg-rose-600 hover:bg-rose-700',
  'bg-amber-600 hover:bg-amber-700',
  'bg-sky-600 hover:bg-sky-700',
] as const

function getActionIntentKey(
  actionCode: string,
  allowResubmit: boolean
): string {
  return `${actionCode}:${allowResubmit ? 'allow_resubmit' : 'default'}`
}

export function ApprovalListTable({
  approvals,
  pageStartIndex,
  selected,
  isProcessing,
  processingClaimId,
  processingAction,
  dateSort,
  onToggleDateSort,
  onToggleOne,
  onRunSingleAction,
}: ApprovalListTableProps) {
  return (
    <div className={DATA_TABLE_SCROLL_WRAPPER_CLASS}>
      <table className={`${DATA_TABLE_CLASS} min-w-230`}>
        <thead>
          <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
            <th className="w-10 px-4 py-3" />
            <th className={getDataTableHeadCellClass({ nowrap: true })}>#</th>
            <th className={getDataTableHeadCellClass({ nowrap: true })}>
              Claim ID
            </th>
            <th className={getDataTableHeadCellClass()}>Employee</th>
            <th className={getDataTableHeadCellClass()}>
              <button
                type="button"
                onClick={onToggleDateSort}
                className="inline-flex items-center gap-1"
              >
                Date
                <span className="text-xs text-muted-foreground" aria-hidden>
                  {dateSort === 'asc' ? '(Oldest)' : '(Newest)'}
                </span>
                <span aria-hidden>{dateSort === 'asc' ? '↑' : '↓'}</span>
              </button>
            </th>
            <th className={getDataTableHeadCellClass()}>Location</th>
            <th className={getDataTableHeadCellClass()}>Amount</th>
            <th className={getDataTableHeadCellClass()}>Status</th>
            <th className={getDataTableHeadCellClass({ align: 'right' })}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className={DATA_TABLE_BODY_CLASS}>
          {approvals.data.map((item: PendingApproval, index) => {
            const isSelectable = item.availableActions.length > 0
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
                    mono: true,
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {pageStartIndex + index}
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
                    {item.availableActions.map((action, index) => {
                      const baseIntentKey = getActionIntentKey(
                        action.action,
                        false
                      )
                      const toneClass =
                        ROW_ACTION_BUTTON_CLASSES[
                          index % ROW_ACTION_BUTTON_CLASSES.length
                        ]

                      return (
                        <button
                          key={baseIntentKey}
                          type="button"
                          disabled={isProcessing}
                          onClick={() =>
                            onRunSingleAction(item.claim.id, action, false)
                          }
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-all disabled:opacity-50 ${toneClass}`}
                        >
                          {isRowProcessing &&
                          processingAction === baseIntentKey ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : null}
                          {isRowProcessing && processingAction === baseIntentKey
                            ? 'Processing...'
                            : getWorkflowActionCtaLabel(action)}
                        </button>
                      )
                    })}

                    {item.availableActions
                      .filter((action) => action.supports_allow_resubmit)
                      .map((action) => {
                        const allowIntentKey = getActionIntentKey(
                          action.action,
                          true
                        )

                        return (
                          <button
                            key={allowIntentKey}
                            type="button"
                            disabled={isProcessing}
                            onClick={() =>
                              onRunSingleAction(item.claim.id, action, true)
                            }
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-amber-700 disabled:opacity-50"
                          >
                            {isRowProcessing &&
                            processingAction === allowIntentKey ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : null}
                            {isRowProcessing &&
                            processingAction === allowIntentKey
                              ? 'Processing...'
                              : getWorkflowActionAllowReclaimLabel(action)}
                          </button>
                        )
                      })}
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
