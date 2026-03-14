'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { formatDate } from '@/lib/utils/date'
import { CursorPaginationControls } from '@/components/ui/cursor-pagination-controls'

import { submitBulkApprovalAction } from '@/features/approvals/actions'
import type { PaginatedPendingApprovals } from '@/features/approvals/types'

type ApprovalListPagination = {
  backHref: string | null
  nextHref: string | null
  pageNumber: number
}

type ApprovalListProps = {
  approvals: PaginatedPendingApprovals
  pagination: ApprovalListPagination
}

export function ApprovalList({ approvals, pagination }: ApprovalListProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingBulkAction, setPendingBulkAction] = useState<
    'approved' | 'rejected' | null
  >(null)

  const selectableIds = useMemo(
    () =>
      approvals.data
        .filter((row) =>
          row.availableActions.some(
            (action) =>
              action.action === 'approved' || action.action === 'rejected'
          )
        )
        .map((row) => row.claim.id),
    [approvals.data]
  )

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allSelected =
    selectableIds.length > 0 && selectedIds.length === selectableIds.length
  const partiallySelected = selectedIds.length > 0 && !allSelected

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? selectableIds : [])
  }

  function toggleSelection(claimId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(claimId) ? current : [...current, claimId]
      }

      return current.filter((id) => id !== claimId)
    })
  }

  async function runBulkAction(action: 'approved' | 'rejected') {
    if (selectedIds.length === 0) {
      return
    }

    setIsSubmitting(true)
    setPendingBulkAction(action)

    try {
      const result = await submitBulkApprovalAction({
        claimIds: selectedIds,
        action,
        notes,
        allowResubmit: false,
      })

      if (result.succeeded > 0) {
        toast.success(
          `${result.succeeded} claim(s) ${
            action === 'approved' ? 'approved' : 'rejected'
          } successfully.`
        )
      }

      if (result.failed > 0) {
        toast.error(result.error ?? `${result.failed} claim(s) failed.`)
      }

      if (result.ok) {
        setSelectedIds([])
        setNotes('')
      }

      router.refresh()
    } catch {
      toast.error('Unexpected error while processing bulk approval action.')
    } finally {
      setIsSubmitting(false)
      setPendingBulkAction(null)
    }
  }

  if (approvals.data.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Pending Approvals</h2>
        <p className="mt-2 text-sm text-foreground/70">
          No pending approvals at your level.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Pending Approvals</h2>

      <CursorPaginationControls
        backHref={pagination.backHref}
        nextHref={pagination.nextHref}
        pageNumber={pagination.pageNumber}
      />

      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2 font-medium text-foreground/80">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(node) => {
                if (node) {
                  node.indeterminate = partiallySelected
                }
              }}
              onChange={(event) => toggleSelectAll(event.target.checked)}
              disabled={isSubmitting || selectableIds.length === 0}
            />
            Select All ({selectedIds.length}/{selectableIds.length})
          </label>

          <button
            type="button"
            onClick={() => runBulkAction('approved')}
            disabled={isSubmitting || selectedIds.length === 0}
            className="rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-60"
          >
            {isSubmitting && pendingBulkAction === 'approved'
              ? 'Approving...'
              : 'Bulk Approve'}
          </button>

          <button
            type="button"
            onClick={() => runBulkAction('rejected')}
            disabled={isSubmitting || selectedIds.length === 0}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium disabled:opacity-60"
          >
            {isSubmitting && pendingBulkAction === 'rejected'
              ? 'Rejecting...'
              : 'Bulk Reject'}
          </button>
        </div>

        <label className="mt-3 block space-y-1 text-sm">
          <span className="text-foreground/80">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-175 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-foreground/70">
              <th className="px-3 py-2 font-medium">Select</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">
                Claim ID
              </th>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {approvals.data.map((row) => (
              <tr key={row.claim.id} className="border-b border-border/70">
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(row.claim.id)}
                    disabled={
                      isSubmitting || !selectableIds.includes(row.claim.id)
                    }
                    onChange={(event) =>
                      toggleSelection(row.claim.id, event.target.checked)
                    }
                  />
                </td>
                <td className="px-3 py-3 font-medium whitespace-nowrap">
                  <Link
                    href={`/approvals/${row.claim.id}`}
                    className="inline-block whitespace-nowrap underline decoration-border underline-offset-4 hover:decoration-foreground"
                  >
                    {row.claim.claim_number}
                  </Link>
                </td>
                <td className="px-3 py-3">{row.owner.employee_name}</td>
                <td className="px-3 py-3 text-xs text-foreground/70">
                  {row.owner.designations?.designation_name ?? ''}
                </td>
                <td className="px-3 py-3">
                  {formatDate(row.claim.claim_date)}
                </td>
                <td className="px-3 py-3">{row.claim.work_location}</td>
                <td className="px-3 py-3">
                  Rs. {Number(row.claim.total_amount).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
