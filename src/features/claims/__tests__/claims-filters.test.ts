import { describe, expect, it } from 'vitest'

import {
  addMyClaimsFiltersToParams,
  normalizeMyClaimsFilters,
} from '@/features/claims/utils/filters'

describe('normalizeMyClaimsFilters', () => {
  // ─── Happy Path ────────────────────────────────────────────────────────────

  it('normalizes ISO date inputs from native date pickers', () => {
    const result = normalizeMyClaimsFilters({
      claimDateFrom: '2026-03-01',
      claimDateTo: '2026-03-07',
    })
    expect(result.claimDateFrom).toBe('2026-03-01')
    expect(result.claimDateTo).toBe('2026-03-07')
  })

  it('normalizes DD/MM/YYYY date inputs to ISO', () => {
    const result = normalizeMyClaimsFilters({
      claimDateFrom: '01/03/2026',
      claimDateTo: '07/03/2026',
    })
    expect(result.claimDateFrom).toBe('2026-03-01')
    expect(result.claimDateTo).toBe('2026-03-07')
  })

  it('normalizes claimStatus to trimmed string', () => {
    const result = normalizeMyClaimsFilters({
      claimStatus: '  finance_rejected  ',
    })
    expect(result.claimStatus).toBe('finance_rejected')
  })

  it('applies valid workLocation filter', () => {
    const result = normalizeMyClaimsFilters({
      workLocation: 'Field - Base Location',
    })
    expect(result.workLocation).toBe('Field - Base Location')
  })

  it('normalizes resubmittedOnly = "true" to boolean true', () => {
    const result = normalizeMyClaimsFilters({ resubmittedOnly: 'true' })
    expect(result.resubmittedOnly).toBe(true)
  })

  it('defaults resubmittedOnly to false when absent', () => {
    const result = normalizeMyClaimsFilters({})
    expect(result.resubmittedOnly).toBe(false)
  })

  it('applies all filters simultaneously', () => {
    const result = normalizeMyClaimsFilters({
      claimStatus: 'submitted',
      workLocation: 'Field - Outstation',
      claimDateFrom: '2026-03-01',
      claimDateTo: '2026-03-07',
      resubmittedOnly: 'true',
    })
    expect(result.claimStatus).toBe('submitted')
    expect(result.workLocation).toBe('Field - Outstation')
    expect(result.claimDateFrom).toBe('2026-03-01')
    expect(result.claimDateTo).toBe('2026-03-07')
    expect(result.resubmittedOnly).toBe(true)
  })

  // ─── Empty / Null States ───────────────────────────────────────────────────

  it('returns null for empty claimStatus string', () => {
    const result = normalizeMyClaimsFilters({ claimStatus: '' })
    expect(result.claimStatus).toBeNull()
  })

  it('returns null for empty claimDateFrom string', () => {
    const result = normalizeMyClaimsFilters({ claimDateFrom: '' })
    expect(result.claimDateFrom).toBeNull()
  })

  it('returns null for empty claimDateTo string', () => {
    const result = normalizeMyClaimsFilters({ claimDateTo: '' })
    expect(result.claimDateTo).toBeNull()
  })

  it('returns null for null workLocation (absent filter)', () => {
    const result = normalizeMyClaimsFilters({})
    expect(result.workLocation).toBeNull()
  })

  // ─── CLAIMS-001 Regression: empty workLocation must NOT block other filters ─

  it('does NOT throw when workLocation is empty string (CLAIMS-001 regression)', () => {
    // Before fix: '' is not a valid WORK_LOCATION_FILTER_VALUES enum member
    // and is NOT undefined, so z.enum().optional() would reject it, causing
    // the entire schema parse to fail and ALL filters to be reset.
    expect(() =>
      normalizeMyClaimsFilters({
        claimStatus: 'finance_rejected',
        workLocation: '',
      })
    ).not.toThrow()
  })

  it('preserves claimStatus when workLocation is empty string (CLAIMS-001 regression)', () => {
    // This is the exact scenario from the CLAIMS-001 bug report:
    // form submits claimStatus=finance_rejected&workLocation=&claimDateFrom=&claimDateTo=
    const result = normalizeMyClaimsFilters({
      claimStatus: 'finance_rejected',
      workLocation: '',
      claimDateFrom: '',
      claimDateTo: '',
    })
    expect(result.claimStatus).toBe('finance_rejected')
    expect(result.workLocation).toBeNull()
    expect(result.claimDateFrom).toBeNull()
    expect(result.claimDateTo).toBeNull()
  })

  it('treats empty workLocation as no filter (null) when all fields are empty strings', () => {
    // Full form submit with nothing selected — all fields are empty strings
    const result = normalizeMyClaimsFilters({
      claimStatus: '',
      workLocation: '',
      claimDateFrom: '',
      claimDateTo: '',
    })
    expect(result.claimStatus).toBeNull()
    expect(result.workLocation).toBeNull()
    expect(result.claimDateFrom).toBeNull()
    expect(result.claimDateTo).toBeNull()
    expect(result.resubmittedOnly).toBe(false)
  })

  it('does NOT throw for all empty form fields (full form submit, nothing selected)', () => {
    expect(() =>
      normalizeMyClaimsFilters({
        claimStatus: '',
        workLocation: '',
        claimDateFrom: '',
        claimDateTo: '',
        resubmittedOnly: undefined,
      })
    ).not.toThrow()
  })

  // ─── Validation Errors (expected throws) ──────────────────────────────────

  it('throws on invalid date format (not ISO or DD/MM/YYYY)', () => {
    expect(() =>
      normalizeMyClaimsFilters({ claimDateFrom: '03-07-2026' })
    ).toThrowError('Claim date from must be in DD/MM/YYYY format.')
  })

  it('throws when date range is inverted', () => {
    expect(() =>
      normalizeMyClaimsFilters({
        claimDateFrom: '2026-03-08',
        claimDateTo: '2026-03-01',
      })
    ).toThrowError('Claim date to must be on or after claim date from.')
  })

  it('throws on invalid workLocation value (not in allowed enum)', () => {
    expect(() =>
      normalizeMyClaimsFilters({ workLocation: 'Invalid Location' })
    ).toThrow()
  })
})

describe('addMyClaimsFiltersToParams', () => {
  const emptyFilters = {
    claimStatus: null,
    workLocation: null,
    claimDateFrom: null,
    claimDateTo: null,
    resubmittedOnly: false,
  }

  it('produces empty params when all filters are null/false', () => {
    const params = addMyClaimsFiltersToParams(
      new URLSearchParams(),
      emptyFilters
    )
    expect(params.toString()).toBe('')
  })

  it('adds claimStatus param when set', () => {
    const params = addMyClaimsFiltersToParams(new URLSearchParams(), {
      ...emptyFilters,
      claimStatus: 'finance_rejected',
    })
    expect(params.get('claimStatus')).toBe('finance_rejected')
  })

  it('adds workLocation param when set', () => {
    const params = addMyClaimsFiltersToParams(new URLSearchParams(), {
      ...emptyFilters,
      workLocation: 'Field - Base Location',
    })
    expect(params.get('workLocation')).toBe('Field - Base Location')
  })

  it('adds claimDateFrom param when set', () => {
    const params = addMyClaimsFiltersToParams(new URLSearchParams(), {
      ...emptyFilters,
      claimDateFrom: '2026-03-01',
    })
    expect(params.get('claimDateFrom')).toBe('2026-03-01')
  })

  it('adds claimDateTo param when set', () => {
    const params = addMyClaimsFiltersToParams(new URLSearchParams(), {
      ...emptyFilters,
      claimDateTo: '2026-03-07',
    })
    expect(params.get('claimDateTo')).toBe('2026-03-07')
  })

  it('adds resubmittedOnly=true when flag is set', () => {
    const params = addMyClaimsFiltersToParams(new URLSearchParams(), {
      ...emptyFilters,
      resubmittedOnly: true,
    })
    expect(params.get('resubmittedOnly')).toBe('true')
  })

  it('does NOT add resubmittedOnly when false', () => {
    const params = addMyClaimsFiltersToParams(new URLSearchParams(), {
      ...emptyFilters,
      resubmittedOnly: false,
    })
    expect(params.has('resubmittedOnly')).toBe(false)
  })

  it('adds multiple active filters simultaneously', () => {
    const params = addMyClaimsFiltersToParams(new URLSearchParams(), {
      claimStatus: 'submitted',
      workLocation: 'Office / WFH',
      claimDateFrom: '2026-03-01',
      claimDateTo: '2026-03-07',
      resubmittedOnly: true,
    })
    expect(params.get('claimStatus')).toBe('submitted')
    expect(params.get('workLocation')).toBe('Office / WFH')
    expect(params.get('claimDateFrom')).toBe('2026-03-01')
    expect(params.get('claimDateTo')).toBe('2026-03-07')
    expect(params.get('resubmittedOnly')).toBe('true')
  })

  it('round-trip: normalize then add to params preserves filters', () => {
    // Simulates the full page flow: form submit → normalize → build canonical URL
    const normalized = normalizeMyClaimsFilters({
      claimStatus: 'finance_rejected',
      workLocation: '', // empty from form
      claimDateFrom: '',
      claimDateTo: '',
    })
    const params = addMyClaimsFiltersToParams(new URLSearchParams(), normalized)
    // claimStatus=finance_rejected should be in params, workLocation should NOT
    expect(params.get('claimStatus')).toBe('finance_rejected')
    expect(params.has('workLocation')).toBe(false)
  })
})
