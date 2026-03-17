'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { submitFinanceAction } from '@/features/finance/actions'
import type { ClaimAvailableAction } from '@/features/claims/types'

type FinanceActionsProps = {
  claimId: string
  availableActions: ClaimAvailableAction[]
}

type FinanceActionIntent =
  | 'issued'
  | 'finance_rejected'
  | 'finance_rejected_allow_reclaim'

export function FinanceActions({
  claimId,
  availableActions,
}: FinanceActionsProps) {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingAction, setPendingAction] =
    useState<FinanceActionIntent | null>(null)

  const actions = useMemo(
    () =>
      availableActions.filter(
        (action) =>
          action.action === 'issued' || action.action === 'finance_rejected'
      ),
    [availableActions]
  )

  const issuedAction = actions.find((action) => action.action === 'issued')
  const rejectedAction = actions.find(
    (action) => action.action === 'finance_rejected'
  )

  async function handleAction(
    action: 'issued' | 'finance_rejected',
    allowReclaim = false
  ) {
    const intent: FinanceActionIntent =
      action === 'finance_rejected' && allowReclaim
        ? 'finance_rejected_allow_reclaim'
        : action

    setIsSubmitting(true)
    setPendingAction(intent)
    setError(null)

    try {
      const result = await submitFinanceAction({
        claimId,
        action,
        notes,
        allowResubmit: action === 'finance_rejected' ? allowReclaim : false,
      })

      if (!result.ok) {
        setError(result.error)
        toast.error(result.error ?? 'Unable to submit finance action.')
        return
      }

      toast.success('Finance action submitted successfully.')
      router.push('/finance')
    } catch {
      const message = 'Unexpected error while submitting finance action.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
      setPendingAction(null)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h3 className="text-base font-semibold">Take Action</h3>

      {actions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No workflow actions are available for this claim.
        </p>
      ) : (
        <label className="mt-4 block space-y-1.5 text-sm">
          <span className="font-medium text-foreground">
            Notes (required for rejection actions)
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-24 w-full rounded-md border border-border bg-background px-4 py-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground"
            placeholder="Add notes for your decision..."
          />
        </label>
      )}

      {error ? (
        <p className="mt-3 rounded-md border border-error/20 bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2.5">
        {issuedAction ? (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction('issued')}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSubmitting && pendingAction === 'issued' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {isSubmitting && pendingAction === 'issued'
              ? 'Submitting...'
              : issuedAction.display_label}
          </button>
        ) : null}

        {rejectedAction ? (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction('finance_rejected', false)}
            className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-rose-700 disabled:opacity-50"
          >
            {isSubmitting && pendingAction === 'finance_rejected' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {isSubmitting && pendingAction === 'finance_rejected'
              ? 'Submitting...'
              : rejectedAction.display_label}
          </button>
        ) : null}

        {rejectedAction ? (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction('finance_rejected', true)}
            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-amber-700 disabled:opacity-50"
          >
            {isSubmitting &&
            pendingAction === 'finance_rejected_allow_reclaim' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {isSubmitting && pendingAction === 'finance_rejected_allow_reclaim'
              ? 'Submitting...'
              : 'Reject & Allow Reclaim'}
          </button>
        ) : null}
      </div>
    </section>
  )
}
