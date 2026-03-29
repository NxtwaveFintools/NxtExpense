import { describe, expect, it } from 'vitest'

import {
  addMyClaimsFiltersToParams,
  buildMyClaimsCsv,
  normalizeMyClaimsFilters,
} from '@/features/claims/utils/filters'
import type { Claim } from '@/features/claims/types'

const VALID_STATUS_ID = 'a02dc74a-bacc-43e2-ae71-82495147aeb6'

describe('normalizeMyClaimsFilters', () => {
  // ─── Happy Path ────────────────────────────────────────────────────────────

  it('normalizes ISO claimDateFrom input from native date picker', () => {
    const result = normalizeMyClaimsFilters({
      claimDateFrom: '2026-03-01',
    })
    expect(result.claimDateFrom).toBe('2026-03-01')
  })

  it('normalizes DD/MM/YYYY claimDateTo input to ISO', () => {
    const result = normalizeMyClaimsFilters({
      claimDateTo: '01/03/2026',
    })
    expect(result.claimDateTo).toBe('2026-03-01')
  })

  it('normalizes claimStatus to trimmed string', () => {
    const result = normalizeMyClaimsFilters({
      claimStatus: `  ${VALID_STATUS_ID}  `,
    })
    expect(result.claimStatus).toBe(VALID_STATUS_ID)
  })

  it('applies valid workLocation filter', () => {
    const result = normalizeMyClaimsFilters({
      workLocation: 'Field - Base Location',
    })
    expect(result.workLocation).toBe('Field - Base Location')
  })

  it('applies all filters simultaneously', () => {
    const result = normalizeMyClaimsFilters({
      claimStatus: VALID_STATUS_ID,
      workLocation: 'Field - Outstation',
      claimDateFrom: '2026-03-01',
      claimDateTo: '2026-03-05',
    })
    expect(result.claimStatus).toBe(VALID_STATUS_ID)
    expect(result.workLocation).toBe('Field - Outstation')
    expect(result.claimDateFrom).toBe('2026-03-01')
    expect(result.claimDateTo).toBe('2026-03-05')
  })

  // ─── Empty / Null States ───────────────────────────────────────────────────

  it('returns null for empty claimStatus string', () => {
    const result = normalizeMyClaimsFilters({ claimStatus: '' })
    expect(result.claimStatus).toBeNull()
  })

  it('returns null for empty claimDateFrom/claimDateTo strings', () => {
    const result = normalizeMyClaimsFilters({
      claimDateFrom: '',
      claimDateTo: '',
    })
    expect(result.claimDateFrom).toBeNull()
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
        claimStatus: VALID_STATUS_ID,
        workLocation: '',
      })
    ).not.toThrow()
  })

  it('preserves claimStatus when workLocation is empty string (CLAIMS-001 regression)', () => {
    // This is the exact scenario from the CLAIMS-001 bug report:
    // form submits claimStatus=REJECTED&workLocation=&claimDateFrom=&claimDateTo=
    const result = normalizeMyClaimsFilters({
      claimStatus: VALID_STATUS_ID,
      workLocation: '',
      claimDateFrom: '',
      claimDateTo: '',
    })
    expect(result.claimStatus).toBe(VALID_STATUS_ID)
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
  })

  it('does NOT throw for all empty form fields (full form submit, nothing selected)', () => {
    expect(() =>
      normalizeMyClaimsFilters({
        claimStatus: '',
        workLocation: '',
        claimDateFrom: '',
        claimDateTo: '',
      })
    ).not.toThrow()
  })

  // ─── Validation Errors (expected throws) ──────────────────────────────────

  it('throws on invalid claimDateFrom format (not ISO or DD/MM/YYYY)', () => {
    expect(() =>
      normalizeMyClaimsFilters({ claimDateFrom: '03-07-2026' })
    ).toThrowError('Claim date from must be in DD/MM/YYYY format.')
  })

  it('throws when claimDateFrom is later than claimDateTo', () => {
    expect(() =>
      normalizeMyClaimsFilters({
        claimDateFrom: '2026-03-08',
        claimDateTo: '2026-03-07',
      })
    ).toThrowError('From Date cannot be later than To Date')
  })

  it('accepts any non-empty workLocation string (values come from DB)', () => {
    const result = normalizeMyClaimsFilters({ workLocation: 'Custom Location' })
    expect(result.workLocation).toBe('Custom Location')
  })
})

describe('addMyClaimsFiltersToParams', () => {
  const emptyFilters = {
    claimStatus: null,
    workLocation: null,
    claimDateFrom: null,
    claimDateTo: null,
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
      claimStatus: VALID_STATUS_ID,
    })
    expect(params.get('claimStatus')).toBe(VALID_STATUS_ID)
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
      claimDateTo: '2026-03-31',
    })
    expect(params.get('claimDateTo')).toBe('2026-03-31')
  })

  it('adds multiple active filters simultaneously', () => {
    const params = addMyClaimsFiltersToParams(new URLSearchParams(), {
      claimStatus: VALID_STATUS_ID,
      workLocation: 'Office / WFH',
      claimDateFrom: '2026-03-01',
      claimDateTo: '2026-03-05',
    })
    expect(params.get('claimStatus')).toBe(VALID_STATUS_ID)
    expect(params.get('workLocation')).toBe('Office / WFH')
    expect(params.get('claimDateFrom')).toBe('2026-03-01')
    expect(params.get('claimDateTo')).toBe('2026-03-05')
  })

  it('round-trip: normalize then add to params preserves filters', () => {
    // Simulates the full page flow: form submit → normalize → build canonical URL
    const normalized = normalizeMyClaimsFilters({
      claimStatus: VALID_STATUS_ID,
      workLocation: '', // empty from form
      claimDateFrom: '',
      claimDateTo: '',
    })
    const params = addMyClaimsFiltersToParams(new URLSearchParams(), normalized)
    // claimStatus UUID should be in params, workLocation should NOT
    expect(params.get('claimStatus')).toBe(VALID_STATUS_ID)
    expect(params.has('workLocation')).toBe(false)
  })
})

describe('buildMyClaimsCsv', () => {
  it('builds CSV with expected columns and formatted values', () => {
    const claim = {
      id: 'claim-id-1',
      claim_number: 'CLAIM-NW0000282-130326-0051',
      employee_id: 'employee-id-1',
      claim_date: '2026-03-13',
      work_location: 'Field - Base Location',
      own_vehicle_used: true,
      vehicle_type: 'Two Wheeler',
      outstation_city_id: null,
      from_city_id: null,
      to_city_id: null,
      outstation_city_name: null,
      from_city_name: null,
      to_city_name: null,
      km_travelled: 25,
      total_amount: 300,
      statusName: 'Finance Review',
      statusDisplayColor: 'yellow',
      status_id: 'status-id-1',
      is_terminal: false,
      is_rejection: false,
      allow_resubmit: false,
      is_superseded: false,
      current_approval_level: 3,
      submitted_at: '2026-03-13T05:57:00.000Z',
      created_at: '2026-03-13T05:56:00.000Z',
      updated_at: '2026-03-13T05:57:00.000Z',
      resubmission_count: 1,
      last_rejection_notes: null,
      last_rejected_at: null,
      accommodation_nights: null,
      food_with_principals_amount: null,
    } as Claim

    const csv = buildMyClaimsCsv([claim])

    expect(csv).toContain('Claim ID')
    expect(csv).toContain('CLAIM-NW0000282-130326-0051')
    expect(csv).toContain('13/03/2026')
    expect(csv).toContain('Rs. 300.00')
    expect(csv).toContain('Finance Review')
  })
})
