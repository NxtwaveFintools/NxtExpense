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

  it('accepts Office / WFH claim when optional outstation fields are empty strings', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Office / WFH',
      outstationCityId: '',
      fromCityId: '',
      toCityId: '',
      vehicleType: '',
      transportType: '',
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

  it('accepts base location without vehicle type (conditional fields validated server-side)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Base Location',
    })
    expect(parsed.success).toBe(true)
  })

  // ── Field - Outstation: Taxi (no own vehicle) ─────────────────────────────

  it('accepts outstation taxi claim (Rapido/Uber/Ola)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      transportType: 'Rapido/Uber/Ola',
      outstationCityId: 'mock-city-uuid',
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
      outstationCityId: 'mock-city-uuid',
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
      outstationCityId: 'mock-city-uuid',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts outstation taxi without outstation location at schema level (validated server-side)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      transportType: 'Rapido/Uber/Ola',
      outstationLocation: '',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts outstation taxi without transport type at schema level (validated server-side)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      outstationCityId: 'mock-city-uuid',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects negative taxi amount', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      transportType: 'Rapido/Uber/Ola',
      outstationCityId: 'mock-city-uuid',
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
      outstationCityId: 'mock-city-uuid',
      vehicleType: 'Two Wheeler',
      fromCityId: 'mock-city-uuid',
      toCityId: 'mock-city-uuid',
      kmTravelled: 100,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts outstation own vehicle claim (2W at exact 150 km limit)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationCityId: 'mock-city-uuid',
      vehicleType: 'Two Wheeler',
      fromCityId: 'mock-city-uuid',
      toCityId: 'mock-city-uuid',
      kmTravelled: 150,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts outstation own vehicle claim (4W at exact 300 km limit)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationCityId: 'mock-city-uuid',
      vehicleType: 'Four Wheeler',
      fromCityId: 'mock-city-uuid',
      toCityId: 'mock-city-uuid',
      kmTravelled: 300,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts outstation own vehicle without from city at schema level (validated server-side)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationCityId: 'mock-city-uuid',
      vehicleType: 'Two Wheeler',
      toCityId: 'mock-city-uuid',
      kmTravelled: 100,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts outstation own vehicle without to city at schema level (validated server-side)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationCityId: 'mock-city-uuid',
      vehicleType: 'Two Wheeler',
      fromCityId: 'mock-city-uuid',
      kmTravelled: 100,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts outstation own vehicle with zero km at schema level (validated server-side)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationCityId: 'mock-city-uuid',
      vehicleType: 'Two Wheeler',
      fromCityId: 'mock-city-uuid',
      toCityId: 'mock-city-uuid',
      kmTravelled: 0,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts outstation own vehicle with negative km at schema level (validated server-side)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationCityId: 'mock-city-uuid',
      vehicleType: 'Two Wheeler',
      fromCityId: 'mock-city-uuid',
      toCityId: 'mock-city-uuid',
      kmTravelled: -50,
    })
    expect(parsed.success).toBe(true)
  })
})

describe('claimSubmissionSchema — KM limit validation (EDGE-005, EDGE-006)', () => {
  // KM limits are now validated server-side using max_km_round_trip from the
  // vehicle_types DB table. Schema accepts any positive number.

  it('accepts 2W outstation claim above 150 km at schema level (KM limit validated server-side)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationCityId: 'mock-city-uuid',
      vehicleType: 'Two Wheeler',
      fromCityId: 'mock-city-uuid',
      toCityId: 'mock-city-uuid',
      kmTravelled: 200,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts 2W at 151 km at schema level', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationCityId: 'mock-city-uuid',
      vehicleType: 'Two Wheeler',
      fromCityId: 'mock-city-uuid',
      toCityId: 'mock-city-uuid',
      kmTravelled: 151,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts 4W outstation claim above 300 km at schema level (KM limit validated server-side)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationCityId: 'mock-city-uuid',
      vehicleType: 'Four Wheeler',
      fromCityId: 'mock-city-uuid',
      toCityId: 'mock-city-uuid',
      kmTravelled: 350,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts 4W at 301 km at schema level', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationCityId: 'mock-city-uuid',
      vehicleType: 'Four Wheeler',
      fromCityId: 'mock-city-uuid',
      toCityId: 'mock-city-uuid',
      kmTravelled: 301,
    })
    expect(parsed.success).toBe(true)
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
  // Work location validity is now checked server-side via DB lookup.
  // Schema only validates non-empty string.
  it('accepts unknown work location at schema level (validated server-side)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Remote',
    })
    expect(parsed.success).toBe(true)
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
      outstationCityId: 'mock-city-uuid',
      vehicleType: 'Two Wheeler',
      fromCityId: 'mock-city-uuid',
      toCityId: 'mock-city-uuid',
      kmTravelled: '100',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.kmTravelled).toBe(100)
    }
  })

  it('coerces string taxi amount to number', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: PAST_DATE,
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      transportType: 'Rapido/Uber/Ola',
      outstationCityId: 'mock-city-uuid',
      taxiAmount: '500',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.taxiAmount).toBe(500)
    }
  })
})
