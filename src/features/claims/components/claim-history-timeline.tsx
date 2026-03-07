import { formatDatetime } from '@/lib/utils/date'

import type { ClaimHistoryEntry } from '@/features/claims/types'

type ClaimHistoryTimelineProps = {
  history: ClaimHistoryEntry[]
}

function formatActionLabel(action: string) {
  return action.replaceAll('_', ' ')
}

export function ClaimHistoryTimeline({ history }: ClaimHistoryTimelineProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-base font-semibold">Claim History</h3>
      {history.length === 0 ? (
        <p className="mt-2 text-sm text-foreground/70">
          No actions recorded yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {history.map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg border border-border bg-background p-3 text-sm"
            >
              <p className="font-medium capitalize">
                {formatActionLabel(entry.action)}
              </p>
              {entry.approval_level ? (
                <p className="text-foreground/70">
                  Level {entry.approval_level}
                </p>
              ) : null}
              <p className="text-foreground/70">{entry.approver_email}</p>
              <p className="text-foreground/70">
                {formatDatetime(entry.acted_at)}
              </p>
              {entry.rejection_notes ? (
                <p className="mt-1">Rejection notes: {entry.rejection_notes}</p>
              ) : null}
              {entry.allow_resubmit !== null ? (
                <p className="text-foreground/70">
                  Allow resubmit: {entry.allow_resubmit ? 'Yes' : 'No'}
                </p>
              ) : null}
              {entry.bypass_reason ? (
                <p className="mt-1">Bypass reason: {entry.bypass_reason}</p>
              ) : null}
              {entry.reason ? (
                <p className="mt-1">Reason: {entry.reason}</p>
              ) : null}
              {entry.notes ? <p className="mt-1">{entry.notes}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
