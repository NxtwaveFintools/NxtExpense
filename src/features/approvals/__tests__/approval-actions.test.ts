import { describe, expect, it } from 'vitest'

import {
  approvalActionSchema,
  approvalHistoryFiltersSchema,
  bulkApprovalActionSchema,
} from '@/features/approvals/validations'

const VALID_UUID = '5db22d75-b209-4f30-b5c8-f4f27ebee9e8'
const VALID_UUID_2 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

describe('approvalActionSchema', () => {
  // ── Happy-path approval ───────────────────────────────────────────────────

  it('accepts approve action without notes', () => {
    const parsed = approvalActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'approved',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts approve action with optional notes', () => {
    const parsed = approvalActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'approved',
      notes: 'Looks good',
    })
    expect(parsed.success).toBe(true)
  })

  // ── Happy-path rejection ──────────────────────────────────────────────────

  it('accepts reject action with notes', () => {
    const parsed = approvalActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'rejected',
      notes: 'Incorrect location selected',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts reject action with allowResubmit flag', () => {
    const parsed = approvalActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'rejected',
      notes: 'Please fix the amount',
      allowResubmit: true,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.allowResubmit).toBe(true)
    }
  })

  // ── Rejection without notes (allowed; DB validates workflow rules) ────────

  it('accepts rejection without notes at schema level', () => {
    const parsed = approvalActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'rejected',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts whitespace-only notes (trimmed) at schema level', () => {
    const parsed = approvalActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'rejected',
      notes: '   ',
    })
    expect(parsed.success).toBe(true)
  })

  // ── Invalid inputs ────────────────────────────────────────────────────────

  it('rejects invalid UUID', () => {
    const parsed = approvalActionSchema.safeParse({
      claimId: 'not-a-uuid',
      action: 'approved',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts any non-empty action code', () => {
    const parsed = approvalActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'issued',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts notes exceeding 500 characters at schema level (enforced in actions)', () => {
    const parsed = approvalActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'rejected',
      notes: 'x'.repeat(501),
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts notes at exactly 500 characters', () => {
    const parsed = approvalActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'rejected',
      notes: 'x'.repeat(500),
    })
    expect(parsed.success).toBe(true)
  })
})

describe('bulkApprovalActionSchema', () => {
  it('accepts bulk approval with multiple claim IDs', () => {
    const parsed = bulkApprovalActionSchema.safeParse({
      claimIds: [VALID_UUID, VALID_UUID_2],
      action: 'approved',
    })
    expect(parsed.success).toBe(true)
  })

  it('requires at least one claim ID', () => {
    const parsed = bulkApprovalActionSchema.safeParse({
      claimIds: [],
      action: 'approved',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts bulk rejection without notes at schema level', () => {
    const parsed = bulkApprovalActionSchema.safeParse({
      claimIds: [VALID_UUID],
      action: 'rejected',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts bulk rejection with notes', () => {
    const parsed = bulkApprovalActionSchema.safeParse({
      claimIds: [VALID_UUID],
      action: 'rejected',
      notes: 'Invalid claims',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects invalid UUID in claim IDs array', () => {
    const parsed = bulkApprovalActionSchema.safeParse({
      claimIds: [VALID_UUID, 'bad-id'],
      action: 'approved',
    })
    expect(parsed.success).toBe(false)
  })
})

describe('approvalHistoryFiltersSchema', () => {
  it('accepts empty filters with defaults', () => {
    const parsed = approvalHistoryFiltersSchema.safeParse({})
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.claimStatus).toBeUndefined()
    }
  })

  it('accepts claimStatus filter', () => {
    const parsed = approvalHistoryFiltersSchema.safeParse({
      claimStatus: VALID_UUID,
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.claimStatus).toBe(VALID_UUID)
    }
  })

  it('accepts ISO date filters', () => {
    const parsed = approvalHistoryFiltersSchema.safeParse({
      claimDate: '2026-03-01',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts DD/MM/YYYY date filters', () => {
    const parsed = approvalHistoryFiltersSchema.safeParse({
      claimDate: '01/03/2026',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.claimDate).toBe('2026-03-01')
    }
  })

  it('rejects inverted HOD approval date range', () => {
    const parsed = approvalHistoryFiltersSchema.safeParse({
      hodApprovedFrom: '2026-03-08',
      hodApprovedTo: '2026-03-01',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects inverted finance approval date range', () => {
    const parsed = approvalHistoryFiltersSchema.safeParse({
      financeApprovedFrom: '2026-03-08',
      financeApprovedTo: '2026-03-01',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts employee name filter', () => {
    const parsed = approvalHistoryFiltersSchema.safeParse({
      employeeName: 'Yohan',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.employeeName).toBe('Yohan')
    }
  })

  it('trims employee name filter', () => {
    const parsed = approvalHistoryFiltersSchema.safeParse({
      employeeName: '  Yohan  ',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.employeeName).toBe('Yohan')
    }
  })

  it('rejects invalid date format in filters', () => {
    const parsed = approvalHistoryFiltersSchema.safeParse({
      claimDate: '03-01-2026',
    })
    expect(parsed.success).toBe(false)
  })
})
