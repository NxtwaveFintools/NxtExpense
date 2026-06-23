export const CLAIM_ITEM_TYPES = {
  FOOD: 'food',
  FUEL: 'fuel',
  INTERCITY_TRAVEL: 'intercity_travel',
  INTRACITY_ALLOWANCE: 'intracity_allowance',
  TAXI_BILL: 'taxi_bill',
  ACCOMMODATION: 'accommodation',
  FOOD_WITH_PRINCIPALS: 'food_with_principals',
} as const

export const EXPENSE_RATE_TYPES = {
  FOOD_BASE: 'FOOD_BASE',
  FOOD_OUTSTATION: 'FOOD_OUTSTATION',
  ACCOMMODATION: 'ACCOMMODATION',
  FOOD_WITH_PRINCIPALS: 'FOOD_WITH_PRINCIPALS',
  INTRACITY_ALLOWANCE_TWO_WHEELER: 'INTRACITY_ALLOWANCE_TWO_WHEELER',
  INTRACITY_ALLOWANCE_FOUR_WHEELER: 'INTRACITY_ALLOWANCE_FOUR_WHEELER',
} as const

// ────────────────────────────────────────────────────────────
// Lookup-table code constants
//
// Each value below mirrors a `*_code` column stored in a Postgres lookup table
// (employee_statuses, work_locations, designations, vehicle_types,
// base_location_day_types) or an enum-style column (intracity_vehicle_mode).
// They are centralized here so runtime comparisons against these codes stop
// being scattered, untyped string literals. The string VALUES are the contract
// with the database and must not change without a corresponding migration.
// ────────────────────────────────────────────────────────────

export const EMPLOYEE_STATUS_CODES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const

export const WORK_LOCATION_CODES = {
  FIELD_BASE: 'FIELD_BASE',
  FIELD_OUTSTATION: 'FIELD_OUTSTATION',
} as const

export const DESIGNATION_CODES = {
  ZONAL_BUSINESS_HEAD: 'ZBH',
} as const

export const VEHICLE_CODES = {
  TWO_WHEELER: 'TWO_WHEELER',
  FOUR_WHEELER: 'FOUR_WHEELER',
} as const

export const INTRACITY_VEHICLE_MODES = {
  OWN_VEHICLE: 'OWN_VEHICLE',
  RENTAL_VEHICLE: 'RENTAL_VEHICLE',
} as const

export type IntracityVehicleMode =
  (typeof INTRACITY_VEHICLE_MODES)[keyof typeof INTRACITY_VEHICLE_MODES]

export const BASE_LOCATION_DAY_TYPE_CODES = {
  FULL_DAY: 'FULL_DAY',
  HALF_DAY: 'HALF_DAY',
  HALF_DAY_FUEL_ONLY: 'HALF_DAY_FUEL_ONLY',
} as const

export function getIntracityAllowanceRateTypeByVehicleCode(
  vehicleCode: string
): string | null {
  if (vehicleCode === VEHICLE_CODES.TWO_WHEELER) {
    return EXPENSE_RATE_TYPES.INTRACITY_ALLOWANCE_TWO_WHEELER
  }

  if (vehicleCode === VEHICLE_CODES.FOUR_WHEELER) {
    return EXPENSE_RATE_TYPES.INTRACITY_ALLOWANCE_FOUR_WHEELER
  }

  return null
}
