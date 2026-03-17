import type { ClaimHistoryEntry } from '@/features/claims/types'

type SubmittedHistoryFallbackParams = {
  claimId: string
  history: ClaimHistoryEntry[]
  submittedAt: string | null
  createdAt: string
  ownerEmail: string
  ownerName: string
}

export function withSubmittedHistoryFallback(
  params: SubmittedHistoryFallbackParams
): ClaimHistoryEntry[] {
  const hasSubmissionEntry = params.history.some(
    (entry) =>
      entry.action === 'submit' ||
      entry.action === 'submitted' ||
      entry.action === 'resubmit' ||
      entry.action === 'resubmitted'
  )

  if (hasSubmissionEntry) {
    return params.history
  }

  const submittedAt = params.submittedAt ?? params.createdAt
  const fallbackEntry: ClaimHistoryEntry = {
    id: `${params.claimId}-submitted-fallback`,
    claim_id: params.claimId,
    approver_email: params.ownerEmail,
    approver_name: params.ownerName,
    approval_level: null,
    action: 'submit',
    notes: null,
    rejection_notes: null,
    allow_resubmit: null,
    bypass_reason: null,
    skipped_levels: null,
    reason: null,
    acted_at: submittedAt,
  }

  return [...params.history, fallbackEntry].sort((a, b) => {
    const aTime = new Date(a.acted_at).getTime()
    const bTime = new Date(b.acted_at).getTime()
    return aTime - bTime
  })
}
