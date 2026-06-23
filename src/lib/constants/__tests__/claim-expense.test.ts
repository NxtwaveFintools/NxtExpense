import { describe, expect, it } from 'vitest'

import {
  BASE_LOCATION_DAY_TYPE_CODES,
  DESIGNATION_CODES,
  EMPLOYEE_STATUS_CODES,
  EXPENSE_RATE_TYPES,
  INTRACITY_VEHICLE_MODES,
  VEHICLE_CODES,
  WORK_LOCATION_CODES,
  getIntracityAllowanceRateTypeByVehicleCode,
} from '../claim-expense'

// These constants mirror codes stored in Postgres lookup tables. The exact
// string values ARE the contract with the database — this test fails loudly if
// any value drifts from what the DB stores.
describe('claim-expense lookup codes', () => {
  it('exposes employee status codes', () => {
    expect(EMPLOYEE_STATUS_CODES.ACTIVE).toBe('ACTIVE')
    expect(EMPLOYEE_STATUS_CODES.INACTIVE).toBe('INACTIVE')
  })

  it('exposes work location codes', () => {
    expect(WORK_LOCATION_CODES.FIELD_BASE).toBe('FIELD_BASE')
    expect(WORK_LOCATION_CODES.FIELD_OUTSTATION).toBe('FIELD_OUTSTATION')
  })

  it('exposes the zonal business head designation code', () => {
    expect(DESIGNATION_CODES.ZONAL_BUSINESS_HEAD).toBe('ZBH')
  })

  it('exposes vehicle codes', () => {
    expect(VEHICLE_CODES.TWO_WHEELER).toBe('TWO_WHEELER')
    expect(VEHICLE_CODES.FOUR_WHEELER).toBe('FOUR_WHEELER')
  })

  it('exposes intracity vehicle modes', () => {
    expect(INTRACITY_VEHICLE_MODES.OWN_VEHICLE).toBe('OWN_VEHICLE')
    expect(INTRACITY_VEHICLE_MODES.RENTAL_VEHICLE).toBe('RENTAL_VEHICLE')
  })

  it('exposes base-location day-type codes', () => {
    expect(BASE_LOCATION_DAY_TYPE_CODES.FULL_DAY).toBe('FULL_DAY')
    expect(BASE_LOCATION_DAY_TYPE_CODES.HALF_DAY).toBe('HALF_DAY')
    expect(BASE_LOCATION_DAY_TYPE_CODES.HALF_DAY_FUEL_ONLY).toBe(
      'HALF_DAY_FUEL_ONLY'
    )
  })
})

describe('getIntracityAllowanceRateTypeByVehicleCode', () => {
  it('maps two-wheeler to its intracity allowance rate type', () => {
    expect(
      getIntracityAllowanceRateTypeByVehicleCode(VEHICLE_CODES.TWO_WHEELER)
    ).toBe(EXPENSE_RATE_TYPES.INTRACITY_ALLOWANCE_TWO_WHEELER)
  })

  it('maps four-wheeler to its intracity allowance rate type', () => {
    expect(
      getIntracityAllowanceRateTypeByVehicleCode(VEHICLE_CODES.FOUR_WHEELER)
    ).toBe(EXPENSE_RATE_TYPES.INTRACITY_ALLOWANCE_FOUR_WHEELER)
  })

  it('returns null for an unknown vehicle code', () => {
    expect(getIntracityAllowanceRateTypeByVehicleCode('SPACESHIP')).toBeNull()
  })
})
