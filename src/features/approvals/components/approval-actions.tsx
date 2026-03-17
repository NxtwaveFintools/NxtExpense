'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { submitApprovalAction } from '@/features/approvals/actions'
import type { ClaimAvailableAction } from '@/features/claims/types'

type ApprovalActionsProps = {
  claimId: string
  availableActions: ClaimAvailableAction[]
}

export function ApprovalActions({
  claimId,
  availableActions,
}: ApprovalActionsProps) {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [showRejectConfirmation, setShowRejectConfirmation] = useState(false)
  const [allowResubmit, setAllowResubmit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const actions = useMemo(
    () =>
      availableActions.filter(
        (action) => action.action === 'approved' || action.action === 'rejected'
      ),
    [availableActions]
  )

  async function handleAction(action: 'approved' | 'rejected') {
    setIsSubmitting(true)
    setPendingAction(action)
    setError(null)

    try {
      const result = await submitApprovalAction({
        claimId,
        action,
        notes,
        allowResubmit: action === 'rejected' ? allowResubmit : false,
      })

      if (!result.ok) {
        setError(result.error)
        toast.error(result.error ?? 'Unable to submit approval action.')
        return
      }

      toast.success('Approval action submitted successfully.')
      router.push('/approvals')
    } catch {
      const message = 'Unexpected error while submitting approval action.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
      setPendingAction(null)
      if (action === 'rejected') {
        setShowRejectConfirmation(false)
        setAllowResubmit(false)
      }
    }
  }

  const approvedAction = actions.find((action) => action.action === 'approved')
  const rejectedAction = actions.find((action) => action.action === 'rejected')

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h3 className="text-base font-semibold">Take Action</h3>

      {actions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No workflow actions are available for this claim.
        </p>
      ) : (
        <>
          <label className="mt-4 block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-24 w-full rounded-md border border-border bg-background px-4 py-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground"
              placeholder="Add notes for your decision (optional)..."
            />
          </label>
        </>
      )}

      {error ? (
        <p className="mt-3 rounded-md border border-error/20 bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex gap-2.5">
        {approvedAction ? (
          <button
            key={`${approvedAction.action}-${approvedAction.display_label}`}
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction('approved')}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSubmitting && pendingAction === approvedAction.action ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {isSubmitting && pendingAction === approvedAction.action
              ? 'Submitting...'
              : approvedAction.display_label}
          </button>
        ) : null}

        {rejectedAction && !showRejectConfirmation ? (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => setShowRejectConfirmation(true)}
            className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium shadow-xs transition-all hover:bg-muted disabled:opacity-50"
          >
            {rejectedAction.display_label}
          </button>
        ) : null}

        {rejectedAction && showRejectConfirmation ? (
          <>
            <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-md border border-amber-200 bg-warning-light px-4 py-3 text-sm dark:border-amber-500/20">
              <input
                type="checkbox"
                checked={allowResubmit}
                onChange={(e) => setAllowResubmit(e.target.checked)}
                className="size-4 rounded accent-primary"
              />
              <span className="text-amber-700 dark:text-amber-400 font-medium">
                Allow employee to raise a new claim for this date
              </span>
            </label>
            <div className="mt-3 flex gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleAction('rejected')}
                className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-rose-700 disabled:opacity-50"
              >
                {isSubmitting && pendingAction === rejectedAction.action ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {isSubmitting && pendingAction === rejectedAction.action
                  ? 'Submitting...'
                  : 'Confirm Reject'}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setShowRejectConfirmation(false)
                  setAllowResubmit(false)
                }}
                className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium shadow-xs transition-all hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
