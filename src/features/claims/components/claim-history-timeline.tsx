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

const ACTION_COLORS: Record<string, string> = {
  submit: 'bg-blue-500',
  resubmit: 'bg-blue-500',
  approved: 'bg-emerald-500',
  rejected: 'bg-rose-500',
  finance_issued: 'bg-emerald-500',
  finance_rejected: 'bg-rose-500',
  reopened: 'bg-amber-500',
  admin_override: 'bg-violet-500',
}

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll('_', ' ')
}

export function ClaimHistoryTimeline({ history }: ClaimHistoryTimelineProps) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h3 className="text-base font-semibold">Claim History</h3>
      {history.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No actions recorded yet.
        </p>
      ) : (
        <div className="mt-5 relative">
          {/* Timeline line */}
          <div className="absolute top-2 left-1.75 bottom-2 w-px bg-border" />
          <ul className="space-y-4">
            {history.map((entry) => (
              <li key={entry.id} className="relative pl-7">
                {/* Timeline dot */}
                <div
                  className={`absolute left-0 top-1.5 size-3.75 rounded-full border-2 border-surface ${
                    ACTION_COLORS[entry.action] ?? 'bg-zinc-400'
                  }`}
                />
                <div className="rounded-md border border-border bg-background p-4 text-sm">
                  <p className="font-semibold capitalize">
                    {formatActionLabel(entry.action)}
                  </p>
                  {entry.approval_level ? (
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {LEVEL_LABELS[entry.approval_level] ??
                        `Level ${entry.approval_level}`}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {entry.approver_name ?? entry.approver_email}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {formatDatetime(entry.acted_at)}
                  </p>
                  {entry.rejection_notes ? (
                    <p className="mt-2 rounded-lg border border-rose-200 bg-error-light px-3 py-2 text-xs text-rose-600 dark:border-rose-500/20 dark:text-rose-400">
                      Reason: {entry.rejection_notes}
                    </p>
                  ) : null}
                  {entry.allow_resubmit !== null ? (
                    entry.allow_resubmit ? (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        New claim allowed
                      </p>
                    ) : (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-error-light px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                        <span className="size-1.5 rounded-full bg-rose-500" />
                        Permanently closed
                      </p>
                    )
                  ) : null}
                  {entry.bypass_reason ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Bypass reason: {entry.bypass_reason}
                    </p>
                  ) : null}
                  {entry.notes && !entry.rejection_notes ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {entry.notes}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
