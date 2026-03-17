import { describe, expect, it } from 'vitest'

import type { ClaimHistoryEntry } from '@/features/claims/types'
import { withSubmittedHistoryFallback } from '@/features/claims/utils/history'

const CLAIM_ID = '5db22d75-b209-4f30-b5c8-f4f27ebee9e8'
const OWNER_EMAIL = 'owner@nxtwave.co.in'
const OWNER_NAME = 'Mutluri Yohan'

function makeEntry(partial: Partial<ClaimHistoryEntry>): ClaimHistoryEntry {
  return {
    id: partial.id ?? 'entry-id',
    claim_id: partial.claim_id ?? CLAIM_ID,
    approver_email: partial.approver_email ?? 'approver@nxtwave.co.in',
    approver_name: partial.approver_name ?? 'Approver',
    approval_level: partial.approval_level ?? 1,
    action: partial.action ?? 'approved',
    notes: partial.notes ?? null,
    rejection_notes: partial.rejection_notes ?? null,
    allow_resubmit: partial.allow_resubmit ?? null,
    bypass_reason: partial.bypass_reason ?? null,
    skipped_levels: partial.skipped_levels ?? null,
    reason: partial.reason ?? null,
    acted_at: partial.acted_at ?? '2026-03-17T10:00:00.000Z',
  }
}

describe('withSubmittedHistoryFallback', () => {
  it('adds submitted fallback when no submit/resubmit entry exists', () => {
    const history: ClaimHistoryEntry[] = [
      makeEntry({
        id: 'approved-1',
        action: 'approved',
        acted_at: '2026-03-17T12:00:00.000Z',
      }),
    ]

    const result = withSubmittedHistoryFallback({
      claimId: CLAIM_ID,
      history,
      submittedAt: '2026-03-17T08:00:00.000Z',
      createdAt: '2026-03-17T07:55:00.000Z',
      ownerEmail: OWNER_EMAIL,
      ownerName: OWNER_NAME,
    })

    expect(result).toHaveLength(2)
    expect(result[0]?.action).toBe('submit')
    expect(result[0]?.approver_email).toBe(OWNER_EMAIL)
    expect(result[0]?.approver_name).toBe(OWNER_NAME)
  })

  it('does not add fallback when submit entry already exists', () => {
    const history: ClaimHistoryEntry[] = [
      makeEntry({
        id: 'submit-1',
        action: 'submit',
        acted_at: '2026-03-17T08:00:00.000Z',
      }),
      makeEntry({
        id: 'approved-1',
        action: 'approved',
        acted_at: '2026-03-17T12:00:00.000Z',
      }),
    ]

    const result = withSubmittedHistoryFallback({
      claimId: CLAIM_ID,
      history,
      submittedAt: '2026-03-17T08:00:00.000Z',
      createdAt: '2026-03-17T07:55:00.000Z',
      ownerEmail: OWNER_EMAIL,
      ownerName: OWNER_NAME,
    })

    expect(result).toHaveLength(2)
    expect(result[0]?.id).toBe('submit-1')
  })

  it('does not add fallback when resubmit entry already exists', () => {
    const history: ClaimHistoryEntry[] = [
      makeEntry({
        id: 'resubmit-1',
        action: 'resubmit',
        acted_at: '2026-03-17T09:00:00.000Z',
      }),
    ]

    const result = withSubmittedHistoryFallback({
      claimId: CLAIM_ID,
      history,
      submittedAt: null,
      createdAt: '2026-03-17T07:55:00.000Z',
      ownerEmail: OWNER_EMAIL,
      ownerName: OWNER_NAME,
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('resubmit-1')
  })

  it('uses createdAt when submittedAt is missing', () => {
    const result = withSubmittedHistoryFallback({
      claimId: CLAIM_ID,
      history: [],
      submittedAt: null,
      createdAt: '2026-03-17T07:55:00.000Z',
      ownerEmail: OWNER_EMAIL,
      ownerName: OWNER_NAME,
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.acted_at).toBe('2026-03-17T07:55:00.000Z')
  })
})
