import { describe, expect, it } from 'vitest'

import {
  bulkFinanceActionSchema,
  financeActionSchema,
  financeFiltersSchema,
} from '@/features/finance/validations'
import {
  normalizeFinanceFilters,
  hasFinanceClaimFilters,
} from '@/features/finance/utils/filters'

const VALID_UUID = '5db22d75-b209-4f30-b5c8-f4f27ebee9e8'
const VALID_UUID_2 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

// ── Finance Action Schema ───────────────────────────────────────────────────

describe('financeActionSchema — issue action', () => {
  it('accepts issued action without notes (APPROVE-005)', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'issued',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts issued action with optional notes', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'issued',
      notes: 'Processed via NEFT',
    })
    expect(parsed.success).toBe(true)
  })
})

describe('financeActionSchema — rejection action', () => {
  it('accepts finance_rejected with notes (APPROVE-006)', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'finance_rejected',
      notes: 'Bank account details incorrect',
    })
    expect(parsed.success).toBe(true)
  })

  it('requires notes for finance_rejected', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'finance_rejected',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects finance_rejected with whitespace-only notes', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'finance_rejected',
      notes: '   ',
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(
        'Notes are required for this finance action.'
      )
    }
  })

  it('accepts finance_rejected with allowResubmit', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'finance_rejected',
      notes: 'Please correct bank details',
      allowResubmit: true,
    })
    expect(parsed.success).toBe(true)
  })
})

describe('financeActionSchema — edge cases', () => {
  it('rejects invalid UUID', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: 'not-uuid',
      action: 'issued',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects reopened action (not allowed)', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'reopened',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects approved action (not a finance action)', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'approved',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects notes exceeding 500 characters', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'finance_rejected',
      notes: 'x'.repeat(501),
    })
    expect(parsed.success).toBe(false)
  })
})

// ── Bulk Finance Action Schema ──────────────────────────────────────────────

describe('bulkFinanceActionSchema', () => {
  it('accepts bulk issued action', () => {
    const parsed = bulkFinanceActionSchema.safeParse({
      claimIds: [VALID_UUID, VALID_UUID_2],
      action: 'issued',
    })
    expect(parsed.success).toBe(true)
  })

  it('requires at least one claim ID', () => {
    const parsed = bulkFinanceActionSchema.safeParse({
      claimIds: [],
      action: 'issued',
    })
    expect(parsed.success).toBe(false)
  })

  it('requires notes for bulk finance_rejected', () => {
    const parsed = bulkFinanceActionSchema.safeParse({
      claimIds: [VALID_UUID],
      action: 'finance_rejected',
      notes: '',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts bulk finance_rejected with notes', () => {
    const parsed = bulkFinanceActionSchema.safeParse({
      claimIds: [VALID_UUID],
      action: 'finance_rejected',
      notes: 'All claims have issues',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects invalid UUID in array', () => {
    const parsed = bulkFinanceActionSchema.safeParse({
      claimIds: [VALID_UUID, 'invalid'],
      action: 'issued',
    })
    expect(parsed.success).toBe(false)
  })
})

// ── Finance Filters Schema ──────────────────────────────────────────────────

describe('financeFiltersSchema', () => {
  it('accepts all-empty filters with defaults', () => {
    const parsed = financeFiltersSchema.safeParse({})
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.actionFilter).toBe('all')
    }
  })

  it('treats empty string actionFilter as default "all"', () => {
    const parsed = financeFiltersSchema.safeParse({ actionFilter: '' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.actionFilter).toBe('all')
    }
  })

  it('accepts valid actionFilter values', () => {
    for (const filter of ['all', 'issued', 'finance_rejected'] as const) {
      const parsed = financeFiltersSchema.safeParse({ actionFilter: filter })
      expect(parsed.success).toBe(true)
    }
  })

  it('treats empty hodApproverEmail as no filter', () => {
    const parsed = financeFiltersSchema.safeParse({ hodApproverEmail: '' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.hodApproverEmail).toBeUndefined()
    }
  })

  it('accepts valid hodApproverEmail', () => {
    const parsed = financeFiltersSchema.safeParse({
      hodApproverEmail: 'mansoor@nxtwave.co.in',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects invalid hodApproverEmail', () => {
    const parsed = financeFiltersSchema.safeParse({
      hodApproverEmail: 'not-an-email',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts ISO date filters', () => {
    const parsed = financeFiltersSchema.safeParse({
      claimDateFrom: '2026-03-01',
      claimDateTo: '2026-03-07',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects inverted claim date range', () => {
    const parsed = financeFiltersSchema.safeParse({
      claimDateFrom: '2026-03-08',
      claimDateTo: '2026-03-01',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects inverted action date range', () => {
    const parsed = financeFiltersSchema.safeParse({
      actionDateFrom: '2026-03-08',
      actionDateTo: '2026-03-01',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts status/location/resubmitted combination', () => {
    const parsed = financeFiltersSchema.safeParse({
      claimStatus: 'finance_review',
      workLocation: 'Field - Base Location',
      resubmittedOnly: 'true',
    })
    expect(parsed.success).toBe(true)
  })

  it('treats empty workLocation as empty string (normalization happens later)', () => {
    const parsed = financeFiltersSchema.safeParse({ workLocation: '' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.workLocation).toBe('')
    }
  })
})

// ── normalizeFinanceFilters ─────────────────────────────────────────────────

describe('normalizeFinanceFilters', () => {
  it('normalizes all-empty filters to nulls/defaults', () => {
    const result = normalizeFinanceFilters({})
    expect(result.employeeName).toBeNull()
    expect(result.claimNumber).toBeNull()
    expect(result.ownerDesignation).toBeNull()
    expect(result.hodApproverEmail).toBeNull()
    expect(result.claimStatus).toBeNull()
    expect(result.workLocation).toBeNull()
    expect(result.resubmittedOnly).toBe(false)
    expect(result.actionFilter).toBe('all')
    expect(result.claimDateFrom).toBeNull()
    expect(result.claimDateTo).toBeNull()
    expect(result.actionDateFrom).toBeNull()
    expect(result.actionDateTo).toBeNull()
  })

  it('normalizes trimmed string filters', () => {
    const result = normalizeFinanceFilters({
      employeeName: '  Yohan  ',
      claimNumber: '  CLM-001  ',
    })
    expect(result.employeeName).toBe('Yohan')
    expect(result.claimNumber).toBe('CLM-001')
  })

  it('converts DD/MM/YYYY dates to ISO', () => {
    const result = normalizeFinanceFilters({
      claimDateFrom: '01/03/2026',
      claimDateTo: '07/03/2026',
    })
    expect(result.claimDateFrom).toBe('2026-03-01')
    expect(result.claimDateTo).toBe('2026-03-07')
  })

  it('preserves ISO dates', () => {
    const result = normalizeFinanceFilters({
      actionDateFrom: '2026-03-01',
      actionDateTo: '2026-03-07',
    })
    expect(result.actionDateFrom).toBe('2026-03-01')
    expect(result.actionDateTo).toBe('2026-03-07')
  })

  it('throws on invalid date format', () => {
    expect(() =>
      normalizeFinanceFilters({ claimDateFrom: '03-01-2026' })
    ).toThrow()
  })

  it('regression: empty workLocation does not throw (FINANCE-001)', () => {
    expect(() =>
      normalizeFinanceFilters({
        claimStatus: 'finance_review',
        workLocation: '',
      })
    ).not.toThrow()
  })

  it('regression: empty hodApproverEmail does not throw (FINANCE-002)', () => {
    expect(() =>
      normalizeFinanceFilters({
        employeeName: 'Test',
        hodApproverEmail: '',
      })
    ).not.toThrow()
  })

  it('regression: empty actionFilter defaults to all (FINANCE-003)', () => {
    const result = normalizeFinanceFilters({ actionFilter: '' })
    expect(result.actionFilter).toBe('all')
  })
})

// ── hasFinanceClaimFilters ──────────────────────────────────────────────────

describe('hasFinanceClaimFilters', () => {
  it('returns false when all filters are null/empty/false', () => {
    expect(
      hasFinanceClaimFilters({
        employeeName: null,
        claimNumber: null,
        ownerDesignation: null,
        hodApproverEmail: null,
        claimStatus: null,
        workLocation: null,
        resubmittedOnly: false,
        actionFilter: 'all',
        claimDateFrom: null,
        claimDateTo: null,
        actionDateFrom: null,
        actionDateTo: null,
      })
    ).toBe(false)
  })

  it('returns true when employeeName is set', () => {
    expect(
      hasFinanceClaimFilters({
        employeeName: 'Yohan',
        claimNumber: null,
        ownerDesignation: null,
        hodApproverEmail: null,
        claimStatus: null,
        workLocation: null,
        resubmittedOnly: false,
        actionFilter: 'all',
        claimDateFrom: null,
        claimDateTo: null,
        actionDateFrom: null,
        actionDateTo: null,
      })
    ).toBe(true)
  })

  it('returns true when resubmittedOnly is true', () => {
    expect(
      hasFinanceClaimFilters({
        employeeName: null,
        claimNumber: null,
        ownerDesignation: null,
        hodApproverEmail: null,
        claimStatus: null,
        workLocation: null,
        resubmittedOnly: true,
        actionFilter: 'all',
        claimDateFrom: null,
        claimDateTo: null,
        actionDateFrom: null,
        actionDateTo: null,
      })
    ).toBe(true)
  })
})
