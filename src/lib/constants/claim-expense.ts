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

export function getIntracityAllowanceRateTypeByVehicleCode(
  vehicleCode: string
): string | null {
  if (vehicleCode === 'TWO_WHEELER') {
    return EXPENSE_RATE_TYPES.INTRACITY_ALLOWANCE_TWO_WHEELER
  }

  if (vehicleCode === 'FOUR_WHEELER') {
    return EXPENSE_RATE_TYPES.INTRACITY_ALLOWANCE_FOUR_WHEELER
  }

  return null
}
