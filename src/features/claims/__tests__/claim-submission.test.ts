import { describe, expect, it } from 'vitest'

import { claimSubmissionSchema } from '@/features/claims/validations'

// ── Helper: a date guaranteed to be in the past ─────────────────────────────
const PAST_DATE = '06/03/2026'
const FUTURE_DATE = '06/03/2099'

describe('claimSubmissionSchema — work location branches', () => {
  // ── SUBMIT-001: Office / WFH ──────────────────────────────────────────────

  it('accepts Office / WFH claim with only date', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Office / WFH',
    })
    expect(parsed.success).toBe(true)
  })

  // ── Leave ─────────────────────────────────────────────────────────────────

  it('accepts Leave claim with only date', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Leave',
    })
    expect(parsed.success).toBe(true)
  })

  // ── Week-off ──────────────────────────────────────────────────────────────

  it('accepts Week-off claim with only date', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Week-off',
    })
    expect(parsed.success).toBe(true)
  })

  // ── Field - Base Location: Two Wheeler ────────────────────────────────────

  it('accepts base location claim with Two Wheeler', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Base Location',
      vehicleType: 'Two Wheeler',
    })
    expect(parsed.success).toBe(true)
  })

  // ── Field - Base Location: Four Wheeler ───────────────────────────────────

  it('accepts base location claim with Four Wheeler', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Base Location',
      vehicleType: 'Four Wheeler',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects base location without vehicle type', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Base Location',
    })
    expect(parsed.success).toBe(false)
  })

  // ── Field - Outstation: Taxi (no own vehicle) ─────────────────────────────

  it('accepts outstation taxi claim (Rapido/Uber/Ola)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      transportType: 'Rapido/Uber/Ola',
      outstationLocation: 'Bengaluru',
      taxiAmount: 500,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts outstation taxi claim (Rental Vehicle)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      transportType: 'Rental Vehicle',
      outstationLocation: 'Chennai',
      taxiAmount: 1200,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts outstation taxi claim with zero taxi amount', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      transportType: 'Rapido/Uber/Ola',
      outstationLocation: 'Pune',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects outstation taxi without outstation location', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      transportType: 'Rapido/Uber/Ola',
      outstationLocation: '',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects outstation taxi without transport type', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      outstationLocation: 'Pune',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects negative taxi amount', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      transportType: 'Rapido/Uber/Ola',
      outstationLocation: 'Pune',
      taxiAmount: -100,
    })
    expect(parsed.success).toBe(false)
  })

  // ── Field - Outstation: Own Vehicle ───────────────────────────────────────

  it('accepts outstation own vehicle claim (2W within KM limit)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationLocation: 'Vijayawada',
      vehicleType: 'Two Wheeler',
      fromCity: 'Hyderabad',
      toCity: 'Vijayawada',
      kmTravelled: 100,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts outstation own vehicle claim (2W at exact 150 km limit)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationLocation: 'Vijayawada',
      vehicleType: 'Two Wheeler',
      fromCity: 'Hyderabad',
      toCity: 'Vijayawada',
      kmTravelled: 150,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts outstation own vehicle claim (4W at exact 300 km limit)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationLocation: 'Guntur',
      vehicleType: 'Four Wheeler',
      fromCity: 'Hyderabad',
      toCity: 'Guntur',
      kmTravelled: 300,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects outstation own vehicle without from city', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationLocation: 'Vijayawada',
      vehicleType: 'Two Wheeler',
      fromCity: '',
      toCity: 'Vijayawada',
      kmTravelled: 100,
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects outstation own vehicle without to city', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationLocation: 'Vijayawada',
      vehicleType: 'Two Wheeler',
      fromCity: 'Hyderabad',
      toCity: '',
      kmTravelled: 100,
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects outstation own vehicle with zero km', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationLocation: 'Vijayawada',
      vehicleType: 'Two Wheeler',
      fromCity: 'Hyderabad',
      toCity: 'Vijayawada',
      kmTravelled: 0,
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects outstation own vehicle with negative km', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationLocation: 'Vijayawada',
      vehicleType: 'Two Wheeler',
      fromCity: 'Hyderabad',
      toCity: 'Vijayawada',
      kmTravelled: -50,
    })
    expect(parsed.success).toBe(false)
  })
})

describe('claimSubmissionSchema — KM limit validation (EDGE-005, EDGE-006)', () => {
  it('rejects 2W outstation claim above 150 km (EDGE-005)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationLocation: 'Vijayawada',
      vehicleType: 'Two Wheeler',
      fromCity: 'Hyderabad',
      toCity: 'Vijayawada',
      kmTravelled: 200,
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const kmIssue = parsed.error.issues.find((issue) =>
        issue.path.includes('kmTravelled')
      )
      expect(kmIssue?.message).toContain('150')
    }
  })

  it('rejects 2W at 151 km (boundary above limit)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationLocation: 'Vijayawada',
      vehicleType: 'Two Wheeler',
      fromCity: 'Hyderabad',
      toCity: 'Vijayawada',
      kmTravelled: 151,
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects 4W outstation claim above 300 km (EDGE-006)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationLocation: 'Guntur',
      vehicleType: 'Four Wheeler',
      fromCity: 'Hyderabad',
      toCity: 'Guntur',
      kmTravelled: 350,
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const kmIssue = parsed.error.issues.find((issue) =>
        issue.path.includes('kmTravelled')
      )
      expect(kmIssue?.message).toContain('300')
    }
  })

  it('rejects 4W at 301 km (boundary above limit)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationLocation: 'Guntur',
      vehicleType: 'Four Wheeler',
      fromCity: 'Hyderabad',
      toCity: 'Guntur',
      kmTravelled: 301,
    })
    expect(parsed.success).toBe(false)
  })
})

describe('claimSubmissionSchema — date validation (EDGE-004)', () => {
  it('rejects future date claim (EDGE-004)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: FUTURE_DATE,
      workLocation: 'Leave',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects empty date string', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: '',
      workLocation: 'Leave',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects invalid date format (MM/DD/YYYY)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: '12/31/2025',
      workLocation: 'Leave',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects malformed date (DD-MM-YYYY)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: '06-03-2026',
      workLocation: 'Leave',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects impossible calendar date (31/02/2026)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: '31/02/2026',
      workLocation: 'Leave',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts a past date (yesterday relative to 2026-03-08)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: '07/03/2026',
      workLocation: 'Leave',
    })
    expect(parsed.success).toBe(true)
  })
})

describe('claimSubmissionSchema — invalid work location', () => {
  it('rejects unknown work location', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Remote',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects empty work location', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: '',
    })
    expect(parsed.success).toBe(false)
  })
})

describe('claimSubmissionSchema — coercion edge cases', () => {
  it('coerces string km_travelled to number', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationLocation: 'Vijayawada',
      vehicleType: 'Two Wheeler',
      fromCity: 'Hyderabad',
      toCity: 'Vijayawada',
      kmTravelled: '100',
    })
    expect(parsed.success).toBe(true)
    if (
      parsed.success &&
      parsed.data.workLocation === 'Field - Outstation' &&
      parsed.data.ownVehicleUsed
    ) {
      expect(parsed.data.kmTravelled).toBe(100)
    }
  })

  it('coerces string taxi amount to number', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      transportType: 'Rapido/Uber/Ola',
      outstationLocation: 'Bengaluru',
      taxiAmount: '500',
    })
    expect(parsed.success).toBe(true)
    if (
      parsed.success &&
      parsed.data.workLocation === 'Field - Outstation' &&
      !parsed.data.ownVehicleUsed
    ) {
      expect(parsed.data.taxiAmount).toBe(500)
    }
  })
})
