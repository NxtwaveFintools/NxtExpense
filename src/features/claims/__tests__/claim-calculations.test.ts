import { describe, expect, it } from 'vitest'

import { buildClaimItemsAndTotal } from '@/features/claims/utils/calculations'

// ── Rates from expense_rules.json ───────────────────────────────────────────

const BASE_RATES_2W = {
  foodBase: 120,
  fuelBase: 180,
}

const BASE_RATES_4W = {
  foodBase: 120,
  fuelBase: 300,
}

const OUTSTATION_RATES_2W = {
  foodOutstation: 350,
  intercityRate: 5,
}

const OUTSTATION_RATES_4W = {
  foodOutstation: 350,
  intercityRate: 8,
}

// ── Base Location Calculations (SUBMIT-001, SUBMIT-003) ─────────────────────

describe('buildClaimItemsAndTotal — Field - Base Location', () => {
  it('calculates ₹300 for 2W base location (SUBMIT-001)', () => {
    const result = buildClaimItemsAndTotal(
      { workLocation: 'Field - Base Location', vehicleType: 'Two Wheeler' },
      BASE_RATES_2W
    )
    expect(result.total).toBe(300)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({ itemType: 'food', amount: 120 })
    expect(result.items[1]).toMatchObject({ itemType: 'fuel', amount: 180 })
  })

  it('calculates ₹420 for 4W base location (SUBMIT-007)', () => {
    const result = buildClaimItemsAndTotal(
      { workLocation: 'Field - Base Location', vehicleType: 'Four Wheeler' },
      BASE_RATES_4W
    )
    expect(result.total).toBe(420)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({ itemType: 'food', amount: 120 })
    expect(result.items[1]).toMatchObject({ itemType: 'fuel', amount: 300 })
  })

  it('generates correct descriptions', () => {
    const result = buildClaimItemsAndTotal(
      { workLocation: 'Field - Base Location', vehicleType: 'Two Wheeler' },
      BASE_RATES_2W
    )
    expect(result.items[0]?.description).toBe('Base location food allowance')
    expect(result.items[1]?.description).toContain('Two Wheeler')
  })
})

// ── Outstation with Own Vehicle (SUBMIT-002, SUBMIT-005) ────────────────────

describe('buildClaimItemsAndTotal — Field - Outstation (own vehicle)', () => {
  it('calculates ₹850 for 2W outstation 100km (SUBMIT-002)', () => {
    const result = buildClaimItemsAndTotal(
      {
        workLocation: 'Field - Outstation',
        ownVehicleUsed: true,
        vehicleType: 'Two Wheeler',
        kmTravelled: 100,
      },
      OUTSTATION_RATES_2W
    )
    expect(result.total).toBe(850) // 350 food + 500 (100 * 5)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({ itemType: 'food', amount: 350 })
    expect(result.items[1]).toMatchObject({
      itemType: 'intercity_travel',
      amount: 500,
    })
  })

  it('calculates ₹1150 for 4W outstation 100km (SUBMIT-005)', () => {
    const result = buildClaimItemsAndTotal(
      {
        workLocation: 'Field - Outstation',
        ownVehicleUsed: true,
        vehicleType: 'Four Wheeler',
        kmTravelled: 100,
      },
      OUTSTATION_RATES_4W
    )
    expect(result.total).toBe(1150) // 350 food + 800 (100 * 8)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({ itemType: 'food', amount: 350 })
    expect(result.items[1]).toMatchObject({
      itemType: 'intercity_travel',
      amount: 800,
    })
  })

  it('calculates ₹1100 for 2W outstation at max 150km', () => {
    const result = buildClaimItemsAndTotal(
      {
        workLocation: 'Field - Outstation',
        ownVehicleUsed: true,
        vehicleType: 'Two Wheeler',
        kmTravelled: 150,
      },
      OUTSTATION_RATES_2W
    )
    expect(result.total).toBe(1100) // 350 + 750 (150 * 5)
  })

  it('calculates ₹2750 for 4W outstation at max 300km', () => {
    const result = buildClaimItemsAndTotal(
      {
        workLocation: 'Field - Outstation',
        ownVehicleUsed: true,
        vehicleType: 'Four Wheeler',
        kmTravelled: 300,
      },
      OUTSTATION_RATES_4W
    )
    expect(result.total).toBe(2750) // 350 + 2400 (300 * 8)
  })

  it('handles 1km minimum distance', () => {
    const result = buildClaimItemsAndTotal(
      {
        workLocation: 'Field - Outstation',
        ownVehicleUsed: true,
        vehicleType: 'Two Wheeler',
        kmTravelled: 1,
      },
      OUTSTATION_RATES_2W
    )
    expect(result.total).toBe(355) // 350 + 5 (1 * 5)
  })

  it('generates intercity travel description with KM and rate', () => {
    const result = buildClaimItemsAndTotal(
      {
        workLocation: 'Field - Outstation',
        ownVehicleUsed: true,
        vehicleType: 'Two Wheeler',
        kmTravelled: 100,
      },
      OUTSTATION_RATES_2W
    )
    expect(result.items[1]?.description).toContain('100 KM')
    expect(result.items[1]?.description).toContain('5/KM')
  })
})

// ── Outstation with Taxi (SUBMIT-004 variant) ───────────────────────────────

describe('buildClaimItemsAndTotal — Field - Outstation (taxi)', () => {
  it('calculates ₹350 food + taxi amount', () => {
    const result = buildClaimItemsAndTotal(
      {
        workLocation: 'Field - Outstation',
        ownVehicleUsed: false,
        taxiAmount: 500,
        transportType: 'Rapido/Uber/Ola',
      },
      { foodOutstation: 350 }
    )
    expect(result.total).toBe(850) // 350 food + 500 taxi
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({ itemType: 'food', amount: 350 })
    expect(result.items[1]).toMatchObject({
      itemType: 'taxi_bill',
      amount: 500,
    })
  })

  it('calculates food only when taxi amount is 0', () => {
    const result = buildClaimItemsAndTotal(
      {
        workLocation: 'Field - Outstation',
        ownVehicleUsed: false,
        taxiAmount: 0,
        transportType: 'Rapido/Uber/Ola',
      },
      { foodOutstation: 350 }
    )
    expect(result.total).toBe(350) // food only
    expect(result.items).toHaveLength(1) // no taxi item for 0 amount
  })

  it('calculates food only when taxiAmount is undefined', () => {
    const result = buildClaimItemsAndTotal(
      {
        workLocation: 'Field - Outstation',
        ownVehicleUsed: false,
        transportType: 'Rental Vehicle',
      },
      { foodOutstation: 350 }
    )
    expect(result.total).toBe(350)
    expect(result.items).toHaveLength(1)
  })

  it('includes taxi description with transport type', () => {
    const result = buildClaimItemsAndTotal(
      {
        workLocation: 'Field - Outstation',
        ownVehicleUsed: false,
        taxiAmount: 1200,
        transportType: 'Rental Vehicle',
      },
      { foodOutstation: 350 }
    )
    expect(result.items[1]?.description).toContain('Rental Vehicle')
  })
})

// ── No-expense Locations ────────────────────────────────────────────────────

describe('buildClaimItemsAndTotal — non-expense locations', () => {
  it('returns zero total for Office / WFH', () => {
    const result = buildClaimItemsAndTotal({ workLocation: 'Office / WFH' }, {})
    expect(result.total).toBe(0)
    expect(result.items).toHaveLength(0)
  })

  it('returns zero total for Leave', () => {
    const result = buildClaimItemsAndTotal({ workLocation: 'Leave' }, {})
    expect(result.total).toBe(0)
    expect(result.items).toHaveLength(0)
  })

  it('returns zero total for Week-off', () => {
    const result = buildClaimItemsAndTotal({ workLocation: 'Week-off' }, {})
    expect(result.total).toBe(0)
    expect(result.items).toHaveLength(0)
  })
})

// ── Edge Cases with Missing/Zero Rates ──────────────────────────────────────

describe('buildClaimItemsAndTotal — missing rates fallback to 0', () => {
  it('defaults to 0 when foodBase rate is missing', () => {
    const result = buildClaimItemsAndTotal(
      { workLocation: 'Field - Base Location', vehicleType: 'Two Wheeler' },
      { fuelBase: 180 }
    )
    expect(result.items[0]?.amount).toBe(0)
    expect(result.total).toBe(180)
  })

  it('defaults to 0 when fuelBase rate is missing', () => {
    const result = buildClaimItemsAndTotal(
      { workLocation: 'Field - Base Location', vehicleType: 'Two Wheeler' },
      { foodBase: 120 }
    )
    expect(result.items[1]?.amount).toBe(0)
    expect(result.total).toBe(120)
  })

  it('defaults to 0 when intercityRate is missing', () => {
    const result = buildClaimItemsAndTotal(
      {
        workLocation: 'Field - Outstation',
        ownVehicleUsed: true,
        vehicleType: 'Two Wheeler',
        kmTravelled: 100,
      },
      { foodOutstation: 350 }
    )
    expect(result.items[1]?.amount).toBe(0) // 100 * 0 = 0
    expect(result.total).toBe(350)
  })
})
