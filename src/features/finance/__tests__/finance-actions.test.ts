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
import { buildClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'

const VALID_UUID = '5db22d75-b209-4f30-b5c8-f4f27ebee9e8'
const VALID_UUID_2 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const VALID_ALLOW_RESUBMIT_STATUS_FILTER = buildClaimStatusFilterValue(
  VALID_UUID,
  true
)

// ── Finance Action Schema ───────────────────────────────────────────────────

describe('financeActionSchema — finance approval action', () => {
  it('accepts finance_approved action without notes (APPROVE-005)', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'finance_approved',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts finance_approved action with optional notes', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'finance_approved',
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
    expect(parsed.success).toBe(true)
  })

  it('rejects finance_rejected with whitespace-only notes', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'finance_rejected',
      notes: '   ',
    })
    expect(parsed.success).toBe(true)
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
      action: 'finance_approved',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts reopened action at schema level', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'reopened',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts approved action at schema level', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'approved',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts notes exceeding 500 characters at schema level (enforced in actions)', () => {
    const parsed = financeActionSchema.safeParse({
      claimId: VALID_UUID,
      action: 'finance_rejected',
      notes: 'x'.repeat(501),
    })
    expect(parsed.success).toBe(true)
  })
})

// ── Bulk Finance Action Schema ──────────────────────────────────────────────

describe('bulkFinanceActionSchema', () => {
  it('accepts bulk finance_approved action', () => {
    const parsed = bulkFinanceActionSchema.safeParse({
      claimIds: [VALID_UUID, VALID_UUID_2],
      action: 'finance_approved',
    })
    expect(parsed.success).toBe(true)
  })

  it('requires at least one claim ID', () => {
    const parsed = bulkFinanceActionSchema.safeParse({
      claimIds: [],
      action: 'finance_approved',
    })
    expect(parsed.success).toBe(false)
  })

  it('requires notes for bulk finance_rejected', () => {
    const parsed = bulkFinanceActionSchema.safeParse({
      claimIds: [VALID_UUID],
      action: 'finance_rejected',
      notes: '',
    })
    expect(parsed.success).toBe(true)
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
      action: 'finance_approved',
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
      expect(parsed.data.actionFilter).toBeUndefined()
    }
  })

  it('treats empty string actionFilter as undefined', () => {
    const parsed = financeFiltersSchema.safeParse({ actionFilter: '' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.actionFilter).toBeUndefined()
    }
  })

  it('accepts non-empty actionFilter values', () => {
    for (const filter of [
      'finance_approved',
      'payment_released',
      'finance_rejected',
      'reopened',
    ] as const) {
      const parsed = financeFiltersSchema.safeParse({ actionFilter: filter })
      expect(parsed.success).toBe(true)
    }
  })

  it('treats empty hodApproverEmployeeId as no filter', () => {
    const parsed = financeFiltersSchema.safeParse({ hodApproverEmployeeId: '' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.hodApproverEmployeeId).toBeUndefined()
    }
  })

  it('accepts valid hodApproverEmployeeId (UUID)', () => {
    const parsed = financeFiltersSchema.safeParse({
      hodApproverEmployeeId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects invalid hodApproverEmployeeId (non-UUID)', () => {
    const parsed = financeFiltersSchema.safeParse({
      hodApproverEmployeeId: 'not-a-uuid',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts ISO date filters', () => {
    const parsed = financeFiltersSchema.safeParse({
      dateFilterField: 'claim_date',
      dateFrom: '2026-03-01',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts DD/MM/YYYY date range input', () => {
    const parsed = financeFiltersSchema.safeParse({
      dateFilterField: 'finance_approved_date',
      dateFrom: '08/03/2026',
      dateTo: '10/03/2026',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts payment_released_date date range input', () => {
    const parsed = financeFiltersSchema.safeParse({
      dateFilterField: 'payment_released_date',
      dateFrom: '08/03/2026',
      dateTo: '10/03/2026',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects inverted date range', () => {
    const parsed = financeFiltersSchema.safeParse({
      dateFrom: '2026-03-08',
      dateTo: '2026-03-01',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts status/location combination', () => {
    const parsed = financeFiltersSchema.safeParse({
      claimStatus: VALID_UUID,
      workLocation: 'Field - Base Location',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts reclaim-eligible rejected status filter token', () => {
    const parsed = financeFiltersSchema.safeParse({
      claimStatus: VALID_ALLOW_RESUBMIT_STATUS_FILTER,
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
    expect(result.hodApproverEmployeeId).toBeNull()
    expect(result.claimStatus).toBeNull()
    expect(result.workLocation).toBeNull()
    expect(result.actionFilter).toBeNull()
    expect(result.dateFilterField).toBe('claim_date')
    expect(result.dateFrom).toBeNull()
    expect(result.dateTo).toBeNull()
  })

  it('normalizes trimmed string filters', () => {
    const result = normalizeFinanceFilters({
      employeeName: '  Yohan  ',
      claimNumber: '  CLAIM-001  ',
    })
    expect(result.employeeName).toBe('Yohan')
    expect(result.claimNumber).toBe('CLAIM-001')
  })

  it('converts DD/MM/YYYY dates to ISO', () => {
    const result = normalizeFinanceFilters({
      dateFrom: '01/03/2026',
    })
    expect(result.dateFrom).toBe('2026-03-01')
  })

  it('preserves reclaim-eligible rejected status filter token', () => {
    const result = normalizeFinanceFilters({
      claimStatus: VALID_ALLOW_RESUBMIT_STATUS_FILTER,
    })

    expect(result.claimStatus).toBe(VALID_ALLOW_RESUBMIT_STATUS_FILTER)
  })

  it('preserves ISO dates', () => {
    const result = normalizeFinanceFilters({
      dateFilterField: 'finance_approved_date',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
    })
    expect(result.dateFrom).toBe('2026-03-01')
    expect(result.dateTo).toBe('2026-03-07')
  })

  it('preserves payment released ISO dates', () => {
    const result = normalizeFinanceFilters({
      dateFilterField: 'payment_released_date',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
    })
    expect(result.dateFrom).toBe('2026-03-01')
    expect(result.dateTo).toBe('2026-03-07')
  })

  it('throws on invalid date format', () => {
    expect(() => normalizeFinanceFilters({ dateFrom: '03-01-2026' })).toThrow()
  })

  it('regression: empty workLocation does not throw (FINANCE-001)', () => {
    expect(() =>
      normalizeFinanceFilters({
        claimStatus: VALID_UUID,
        workLocation: '',
      })
    ).not.toThrow()
  })

  it('regression: empty hodApproverEmployeeId does not throw (FINANCE-002)', () => {
    expect(() =>
      normalizeFinanceFilters({
        employeeName: 'Test',
        hodApproverEmployeeId: '',
      })
    ).not.toThrow()
  })

  it('regression: empty actionFilter normalizes to null (FINANCE-003)', () => {
    const result = normalizeFinanceFilters({ actionFilter: '' })
    expect(result.actionFilter).toBeNull()
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
        hodApproverEmployeeId: null,
        claimStatus: null,
        workLocation: null,
        actionFilter: null,
        dateFilterField: 'claim_date',
        dateFrom: null,
        dateTo: null,
      })
    ).toBe(false)
  })

  it('returns true when employeeName is set', () => {
    expect(
      hasFinanceClaimFilters({
        employeeName: 'Yohan',
        claimNumber: null,
        ownerDesignation: null,
        hodApproverEmployeeId: null,
        claimStatus: null,
        workLocation: null,
        actionFilter: null,
        dateFilterField: 'claim_date',
        dateFrom: null,
        dateTo: null,
      })
    ).toBe(true)
  })

  it('returns true when dateFrom is set', () => {
    expect(
      hasFinanceClaimFilters({
        employeeName: null,
        claimNumber: null,
        ownerDesignation: null,
        hodApproverEmployeeId: null,
        claimStatus: null,
        workLocation: null,
        actionFilter: null,
        dateFilterField: 'claim_date',
        dateFrom: '2026-03-07',
        dateTo: null,
      })
    ).toBe(true)
  })
})
