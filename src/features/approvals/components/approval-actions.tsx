'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { submitApprovalAction } from '@/features/approvals/actions'
import type { ClaimAvailableAction } from '@/features/claims/types'
import {
  getWorkflowActionAllowReclaimLabel,
  getWorkflowActionCtaLabel,
} from '@/lib/utils/workflow-action-labels'

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
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const actions = useMemo(() => availableActions, [availableActions])

  const BUTTON_TONES = [
    'bg-emerald-600 hover:bg-emerald-700',
    'bg-rose-600 hover:bg-rose-700',
    'bg-sky-600 hover:bg-sky-700',
  ] as const

  function getActionIntentKey(actionCode: string, allowResubmit: boolean) {
    return `${actionCode}:${allowResubmit ? 'allow_resubmit' : 'default'}`
  }

  async function handleAction(
    action: ClaimAvailableAction,
    allowResubmit = false
  ) {
    const shouldAllowResubmit =
      allowResubmit && action.supports_allow_resubmit === true
    const intent = getActionIntentKey(action.action, shouldAllowResubmit)

    setIsSubmitting(true)
    setPendingAction(intent)
    setError(null)

    try {
      const result = await submitApprovalAction({
        claimId,
        action: action.action,
        notes,
        allowResubmit: shouldAllowResubmit ? true : undefined,
      })

      if (!result.ok) {
        setError(result.error)
        toast.error(result.error ?? 'Unable to submit approval action.')
        return
      }

      const actionLabel = shouldAllowResubmit
        ? getWorkflowActionAllowReclaimLabel(action)
        : getWorkflowActionCtaLabel(action)
      toast.success(`${actionLabel} submitted successfully.`)
      router.push('/approvals')
    } catch {
      const message = 'Unexpected error while submitting approval action.'
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
        <>
          <label className="mt-4 block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-24 w-full rounded-md border border-border bg-background px-4 py-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground"
              placeholder="Add notes for your decision (required for rejection actions)..."
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
        {actions.map((action, index) => {
          const intentKey = getActionIntentKey(action.action, false)
          const toneClass = BUTTON_TONES[index % BUTTON_TONES.length]

          return (
            <button
              key={intentKey}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleAction(action, false)}
              className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 ${toneClass}`}
            >
              {isSubmitting && pendingAction === intentKey ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {isSubmitting && pendingAction === intentKey
                ? 'Submitting...'
                : getWorkflowActionCtaLabel(action)}
            </button>
          )
        })}

        {actions
          .filter((action) => action.supports_allow_resubmit)
          .map((action) => {
            const intentKey = getActionIntentKey(action.action, true)

            return (
              <button
                key={intentKey}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleAction(action, true)}
                className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-amber-700 disabled:opacity-50"
              >
                {isSubmitting && pendingAction === intentKey ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {isSubmitting && pendingAction === intentKey
                  ? 'Submitting...'
                  : getWorkflowActionAllowReclaimLabel(action)}
              </button>
            )
          })}
      </div>
    </section>
  )
}
