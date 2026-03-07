'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

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
  const [allowResubmit, setAllowResubmit] = useState(false)
  const [showRejectConfirmation, setShowRejectConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [isRefreshing, startRefreshTransition] = useTransition()

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
        allowResubmit: action === 'rejected' ? allowResubmit : undefined,
      })

      if (!result.ok) {
        setError(result.error)
        toast.error(result.error ?? 'Unable to submit approval action.')
        return
      }

      toast.success('Approval action submitted successfully.')
      setNotes('')
      startRefreshTransition(() => {
        router.refresh()
      })
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
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-base font-semibold">Take Action</h3>

      {actions.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/70">
          No workflow actions are available for this claim.
        </p>
      ) : (
        <>
          <label className="mt-3 block space-y-2 text-sm">
            <span className="text-foreground/80">Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>

          {showRejectConfirmation && rejectedAction?.supports_allow_resubmit ? (
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={allowResubmit}
                onChange={(event) => setAllowResubmit(event.target.checked)}
              />
              Allow employee modifications and resubmission
            </label>
          ) : null}
        </>
      )}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        {approvedAction ? (
          <button
            key={`${approvedAction.action}-${approvedAction.display_label}`}
            type="button"
            disabled={isSubmitting || isRefreshing}
            onClick={() => handleAction('approved')}
            className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
          >
            {isSubmitting && pendingAction === approvedAction.action
              ? 'Submitting...'
              : approvedAction.display_label}
          </button>
        ) : null}

        {rejectedAction && !showRejectConfirmation ? (
          <button
            type="button"
            disabled={isSubmitting || isRefreshing}
            onClick={() => setShowRejectConfirmation(true)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            {rejectedAction.display_label}
          </button>
        ) : null}

        {rejectedAction && showRejectConfirmation ? (
          <>
            <button
              type="button"
              disabled={isSubmitting || isRefreshing}
              onClick={() => handleAction('rejected')}
              className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
            >
              {isSubmitting && pendingAction === rejectedAction.action
                ? 'Submitting...'
                : 'Confirm Reject'}
            </button>
            <button
              type="button"
              disabled={isSubmitting || isRefreshing}
              onClick={() => {
                setShowRejectConfirmation(false)
                setAllowResubmit(false)
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              Cancel
            </button>
          </>
        ) : null}
      </div>

      {isRefreshing ? (
        <p className="mt-3 text-xs text-foreground/70">
          Updating latest workflow state...
        </p>
      ) : null}
    </section>
  )
}
