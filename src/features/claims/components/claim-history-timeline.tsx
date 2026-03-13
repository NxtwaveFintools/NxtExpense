import { formatDatetime } from '@/lib/utils/date'

import type { ClaimHistoryEntry } from '@/features/claims/types'

type ClaimHistoryTimelineProps = {
  history: ClaimHistoryEntry[]
}

const ACTION_LABELS: Record<string, string> = {
  submit: 'Submitted',
  resubmit: 'Resubmitted (New Claim)',
  approved: 'Approved',
  rejected: 'Rejected',
  finance_issued: 'Payment Issued',
  finance_rejected: 'Finance Rejected',
  reopened: 'Reopened',
  admin_override: 'Admin Override',
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Level 1 — State Business Head',
  2: 'Level 2 — HOD (Mansoor)',
}

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll('_', ' ')
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
                  {LEVEL_LABELS[entry.approval_level] ??
                    `Level ${entry.approval_level}`}
                </p>
              ) : null}
              <p className="text-foreground/70">
                {entry.approver_name ?? entry.approver_email}
              </p>
              <p className="text-foreground/70">
                {formatDatetime(entry.acted_at)}
              </p>
              {entry.rejection_notes ? (
                <p className="mt-1 text-red-600 dark:text-red-400">
                  Reason: {entry.rejection_notes}
                </p>
              ) : null}
              {entry.allow_resubmit !== null &&
              (entry.action === 'rejected' ||
                entry.action === 'finance_rejected') ? (
                entry.allow_resubmit ? (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                    New claim allowed
                  </p>
                ) : (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                    Permanently closed
                  </p>
                )
              ) : null}
              {entry.bypass_reason ? (
                <p className="mt-1 text-foreground/60">
                  Bypass reason: {entry.bypass_reason}
                </p>
              ) : null}
              {entry.notes && !entry.rejection_notes ? (
                <p className="mt-1 text-foreground/70">{entry.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
