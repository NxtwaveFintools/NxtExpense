import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getExpenseRateByType,
  type ExpenseRate,
  type VehicleType,
} from '@/lib/services/config-service'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

/** Shape of a single expense line item produced by calculation */
export type CalculatedExpenseItem = {
  expense_type: string
  amount: number
  description: string
}

/** Input for a base-location day calculation */
export type BaseLocationInput = {
  workLocationId: string
  vehicleType: VehicleType
}

/** Input for an outstation day calculation — own vehicle */
export type OutstationOwnVehicleInput = {
  workLocationId: string
  designationId: string
  vehicleType: VehicleType
  kmTravelled: number
  accommodationNights?: number
  foodWithPrincipalsAmount?: number
}

/** Input for an outstation day calculation — taxi/transport */
export type OutstationTaxiInput = {
  workLocationId: string
  taxiAmount: number
  transportTypeName: string
  designationId?: string
  accommodationNights?: number
  foodWithPrincipalsAmount?: number
}

/** Input for accommodation rate lookup */
export type AccommodationInput = {
  workLocationId: string
  designationId: string
}

// ────────────────────────────────────────────────────────────
// Vehicle type helpers
// ────────────────────────────────────────────────────────────

/** Fetch a vehicle type by ID */
export async function getVehicleTypeById(
  supabase: SupabaseClient,
  vehicleTypeId: string
): Promise<VehicleType> {
  const { data, error } = await supabase
    .from('vehicle_types')
    .select(
      'id, vehicle_code, vehicle_name, base_fuel_rate_per_day, intercity_rate_per_km, max_km_round_trip, display_order, is_active'
    )
    .eq('id', vehicleTypeId)
    .single()

  if (error) throw new Error(`Failed to fetch vehicle type: ${error.message}`)
  return data as VehicleType
}

/** Check if km exceeds the round-trip limit for the vehicle type */
export function isKmWithinLimit(
  vehicleType: VehicleType,
  kmTravelled: number
): { valid: boolean; maxKm: number } {
  return {
    valid: kmTravelled <= vehicleType.max_km_round_trip,
    maxKm: vehicleType.max_km_round_trip,
  }
}

// ────────────────────────────────────────────────────────────
// Rate lookups (all from DB — zero hardcoded values)
// ────────────────────────────────────────────────────────────

/** Get food rate for a work location (designation-independent) */
export async function getFoodRate(
  supabase: SupabaseClient,
  workLocationId: string
): Promise<ExpenseRate | null> {
  // Food rates: FOOD_BASE for base location, FOOD_OUTSTATION for outstation
  // These are not designation-specific — designation_id is null
  const base = await getExpenseRateByType(
    supabase,
    workLocationId,
    'FOOD_BASE',
    null
  )
  if (base) return base

  return getExpenseRateByType(supabase, workLocationId, 'FOOD_OUTSTATION', null)
}

/** Get accommodation limit for a designation at a given work location */
export async function getAccommodationLimit(
  supabase: SupabaseClient,
  input: AccommodationInput
): Promise<number> {
  const rate = await getExpenseRateByType(
    supabase,
    input.workLocationId,
    'ACCOMMODATION',
    input.designationId
  )
  if (!rate) return 0
  return Number(rate.rate_amount)
}

/** Get food with principals max per occurrence for a designation */
export async function getFoodWithPrincipalsLimit(
  supabase: SupabaseClient,
  workLocationId: string,
  designationId: string
): Promise<number> {
  const rate = await getExpenseRateByType(
    supabase,
    workLocationId,
    'FOOD_WITH_PRINCIPALS',
    designationId
  )
  if (!rate) return 0
  return Number(rate.rate_amount)
}

/** Count how many food_with_principals claims an employee has in a given month */
export async function countFoodWithPrincipalsInMonth(
  supabase: SupabaseClient,
  employeeId: string,
  yearMonth: string // format: YYYY-MM
): Promise<number> {
  const startDate = `${yearMonth}-01`
  const endDate = `${yearMonth}-31`

  const { count, error } = await supabase
    .from('expense_claims')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', employeeId)
    .gte('claim_date', startDate)
    .lte('claim_date', endDate)
    .gt('food_with_principals_amount', 0)

  if (error)
    throw new Error(`Failed to count food with principals: ${error.message}`)
  return count ?? 0
}

// ────────────────────────────────────────────────────────────
// Claim item builders — Field Base Location
// ────────────────────────────────────────────────────────────

/**
 * Calculate expense items for a Field – Base Location day.
 * Returns food allowance + base fuel allowance from DB rates.
 */
export async function calculateBaseLocationItems(
  supabase: SupabaseClient,
  input: BaseLocationInput
): Promise<{ items: CalculatedExpenseItem[]; total: number }> {
  const items: CalculatedExpenseItem[] = []

  // Food rate (designation-independent)
  const foodRate = await getExpenseRateByType(
    supabase,
    input.workLocationId,
    'FOOD_BASE',
    null
  )
  if (foodRate) {
    items.push({
      expense_type: 'food',
      amount: Number(foodRate.rate_amount),
      description: 'Base location food allowance',
    })
  }

  // Fuel rate (from vehicle_types.base_fuel_rate_per_day)
  items.push({
    expense_type: 'fuel',
    amount: Number(input.vehicleType.base_fuel_rate_per_day),
    description: `${input.vehicleType.vehicle_name} base location fuel allowance`,
  })

  const total = items.reduce((sum, item) => sum + item.amount, 0)
  return { items, total }
}

// ────────────────────────────────────────────────────────────
// Claim item builders — Field Outstation (own vehicle)
// ────────────────────────────────────────────────────────────

/**
 * Calculate expense items for an outstation day with own vehicle.
 * Food from expense_rates + fuel = intercity_rate_per_km × km.
 */
export async function calculateOutstationOwnVehicleItems(
  supabase: SupabaseClient,
  input: OutstationOwnVehicleInput
): Promise<{ items: CalculatedExpenseItem[]; total: number }> {
  const items: CalculatedExpenseItem[] = []

  // Food rate (designation-independent)
  const foodRate = await getExpenseRateByType(
    supabase,
    input.workLocationId,
    'FOOD_OUTSTATION',
    null
  )
  if (foodRate) {
    items.push({
      expense_type: 'food',
      amount: Number(foodRate.rate_amount),
      description: 'Outstation food allowance',
    })
  }

  // Intercity fuel = rate_per_km × km
  const ratePerKm = Number(input.vehicleType.intercity_rate_per_km)
  const fuelAmount = ratePerKm * input.kmTravelled
  items.push({
    expense_type: 'intercity_travel',
    amount: fuelAmount,
    description: `${input.kmTravelled} KM @ ₹${ratePerKm}/KM`,
  })

  // Accommodation (if nights > 0)
  if (input.accommodationNights && input.accommodationNights > 0) {
    const accommodationRate = await getAccommodationLimit(supabase, {
      workLocationId: input.workLocationId,
      designationId: input.designationId,
    })
    if (accommodationRate > 0) {
      items.push({
        expense_type: 'accommodation',
        amount: accommodationRate * input.accommodationNights,
        description: `${input.accommodationNights} night(s) @ ₹${accommodationRate}/night`,
      })
    }
  }

  // Food with Principals (capped at rate)
  if (input.foodWithPrincipalsAmount && input.foodWithPrincipalsAmount > 0) {
    const fwpLimit = await getFoodWithPrincipalsLimit(
      supabase,
      input.workLocationId,
      input.designationId
    )
    if (fwpLimit > 0) {
      const cappedAmount = Math.min(input.foodWithPrincipalsAmount, fwpLimit)
      items.push({
        expense_type: 'food_with_principals',
        amount: cappedAmount,
        description: `Food with principals (capped at ₹${fwpLimit})`,
      })
    }
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0)
  return { items, total }
}

// ────────────────────────────────────────────────────────────
// Claim item builders — Field Outstation (taxi/transport)
// ────────────────────────────────────────────────────────────

/**
 * Calculate expense items for an outstation day with taxi/transport.
 * Food from expense_rates + taxi bill amount (user-provided).
 */
export async function calculateOutstationTaxiItems(
  supabase: SupabaseClient,
  input: OutstationTaxiInput
): Promise<{ items: CalculatedExpenseItem[]; total: number }> {
  const items: CalculatedExpenseItem[] = []

  // Food rate (designation-independent)
  const foodRate = await getExpenseRateByType(
    supabase,
    input.workLocationId,
    'FOOD_OUTSTATION',
    null
  )
  if (foodRate) {
    items.push({
      expense_type: 'food',
      amount: Number(foodRate.rate_amount),
      description: 'Outstation food allowance',
    })
  }

  // Taxi bill (user-submitted amount, no DB rate)
  items.push({
    expense_type: 'taxi_bill',
    amount: input.taxiAmount,
    description: `${input.transportTypeName} bill submitted for outstation travel`,
  })

  // Accommodation (if nights > 0)
  if (
    input.accommodationNights &&
    input.accommodationNights > 0 &&
    input.designationId
  ) {
    const accommodationRate = await getAccommodationLimit(supabase, {
      workLocationId: input.workLocationId,
      designationId: input.designationId,
    })
    if (accommodationRate > 0) {
      items.push({
        expense_type: 'accommodation',
        amount: accommodationRate * input.accommodationNights,
        description: `${input.accommodationNights} night(s) @ ₹${accommodationRate}/night`,
      })
    }
  }

  // Food with Principals (capped at rate)
  if (
    input.foodWithPrincipalsAmount &&
    input.foodWithPrincipalsAmount > 0 &&
    input.designationId
  ) {
    const fwpLimit = await getFoodWithPrincipalsLimit(
      supabase,
      input.workLocationId,
      input.designationId
    )
    if (fwpLimit > 0) {
      const cappedAmount = Math.min(input.foodWithPrincipalsAmount, fwpLimit)
      items.push({
        expense_type: 'food_with_principals',
        amount: cappedAmount,
        description: `Food with principals (capped at ₹${fwpLimit})`,
      })
    }
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0)
  return { items, total }
}
