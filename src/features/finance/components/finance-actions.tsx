'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { submitFinanceAction } from '@/features/finance/actions'
import type { ClaimAvailableAction } from '@/features/claims/types'
import {
  buildFinanceActionIntents,
  getFinanceActionToneClass,
  sortFinanceActionIntents,
  type FinanceActionIntent,
} from '@/features/finance/utils/action-intents'

type FinanceActionsProps = {
  claimId: string
  availableActions: ClaimAvailableAction[]
}

export function FinanceActions({
  claimId,
  availableActions,
}: FinanceActionsProps) {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const actions = useMemo(() => availableActions, [availableActions])
  const actionsByCode = useMemo(
    () => new Map(actions.map((action) => [action.action, action])),
    [actions]
  )
  const actionIntents = useMemo(
    () =>
      sortFinanceActionIntents(
        actions.flatMap((action) => buildFinanceActionIntents(action))
      ),
    [actions]
  )

  function getActionIntentKey(actionCode: string, allowResubmit: boolean) {
    return `${actionCode}:${allowResubmit ? 'allow_resubmit' : 'default'}`
  }

  async function handleAction(
    action: ClaimAvailableAction,
    intent: FinanceActionIntent
  ) {
    const shouldAllowResubmit =
      intent.allowResubmit && action.supports_allow_resubmit === true
    const intentKey = getActionIntentKey(action.action, shouldAllowResubmit)

    setIsSubmitting(true)
    setPendingAction(intentKey)
    setError(null)

    try {
      const result = await submitFinanceAction({
        claimId,
        action: action.action,
        notes,
        allowResubmit: shouldAllowResubmit ? true : undefined,
      })

      if (!result.ok) {
        setError(result.error)
        toast.error(result.error ?? 'Unable to submit finance action.')
        return
      }

      toast.success(`${intent.label} submitted successfully.`)
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
            Notes for the selected workflow action
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
        {actionIntents.map((intent) => {
          const action = actionsByCode.get(intent.actionCode)
          if (!action) {
            return null
          }

          const intentKey = intent.key
          const toneClass = getFinanceActionToneClass(intent)

          return (
            <button
              key={intentKey}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleAction(action, intent)}
              className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 ${toneClass}`}
            >
              {isSubmitting && pendingAction === intentKey ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {isSubmitting && pendingAction === intentKey
                ? 'Submitting...'
                : intent.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
