import type { ApprovalAction } from '@/features/approvals/types'
import { formatDatetime } from '@/lib/utils/date'

type ApprovalHistoryTimelineProps = {
  history: ApprovalAction[]
  claimLocation?: {
    workLocation: string
    outstationStateName?: string | null
    outstationCityName?: string | null
    fromCityName?: string | null
    toCityName?: string | null
  }
}

const ACTION_COLORS: Record<string, string> = {
  approved: 'bg-emerald-500',
  rejected: 'bg-rose-500',
  finance_issued: 'bg-emerald-500',
  finance_rejected: 'bg-rose-500',
}

function formatActionLabel(action: string) {
  return action.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function formatClaimLocationLabel(
  claimLocation: ApprovalHistoryTimelineProps['claimLocation']
): string | null {
  if (!claimLocation) {
    return null
  }

  const workLocation = normalizeText(claimLocation.workLocation)
  const fromCity = normalizeText(claimLocation.fromCityName)
  const toCity = normalizeText(claimLocation.toCityName)
  const outstationCity = normalizeText(claimLocation.outstationCityName)
  const outstationState = normalizeText(claimLocation.outstationStateName)

  const locationParts: string[] = []

  if (fromCity && toCity) {
    locationParts.push(`${fromCity} -> ${toCity}`)
  } else if (outstationCity && outstationState) {
    locationParts.push(`${outstationCity}, ${outstationState}`)
  } else if (outstationCity) {
    locationParts.push(outstationCity)
  } else if (outstationState) {
    locationParts.push(outstationState)
  }

  if (locationParts.length === 0) {
    return workLocation || null
  }

  return workLocation
    ? `${workLocation} (${locationParts.join(' | ')})`
    : locationParts.join(' | ')
}

export function ApprovalHistoryTimeline({
  history,
  claimLocation,
}: ApprovalHistoryTimelineProps) {
  const locationLabel = formatClaimLocationLabel(claimLocation)

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h3 className="text-base font-semibold">Approval History</h3>
      {history.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No actions recorded yet.
        </p>
      ) : (
        <div className="mt-5 relative">
          <div className="absolute top-2 left-1.75 bottom-2 w-px bg-border" />
          <ul className="space-y-4">
            {history.map((entry) => (
              <li key={entry.id} className="relative pl-7">
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
                      Level {entry.approval_level}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {entry.approver_email}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {formatDatetime(entry.acted_at)}
                  </p>
                  {locationLabel ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Location: {locationLabel}
                    </p>
                  ) : null}
                  {entry.rejection_notes ? (
                    <p className="mt-2 rounded-lg border border-rose-200 bg-error-light px-3 py-2 text-xs text-rose-600 dark:border-rose-500/20 dark:text-rose-400">
                      Rejection notes: {entry.rejection_notes}
                    </p>
                  ) : null}
                  {entry.bypass_reason ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Bypass reason: {entry.bypass_reason}
                    </p>
                  ) : null}
                  {entry.reason ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Reason: {entry.reason}
                    </p>
                  ) : null}
                  {entry.notes ? (
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
