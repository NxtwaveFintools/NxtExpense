import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getExpenseRateByType,
  getIntracityAllowanceRateByVehicle,
  type VehicleType,
} from '@/lib/services/config-service'
import {
  CLAIM_ITEM_TYPES,
  EXPENSE_RATE_TYPES,
} from '@/lib/constants/claim-expense'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

/** Shape of a single expense line item produced by calculation */
type CalculatedExpenseItem = {
  expense_type: string
  amount: number
  description: string
}

/** Input for a base-location day calculation */
type BaseLocationInput = {
  workLocationId: string
  vehicleType: VehicleType
}

/** Input for outstation with inter-city/intra-city segment selections */
type OutstationTravelInput = {
  workLocationId: string
  designationId: string
  hasIntercityTravel: boolean
  hasIntracityTravel: boolean
  intercityOwnVehicleUsed: boolean
  intracityOwnVehicleUsed: boolean
  vehicleType: VehicleType | null
  kmTravelled?: number
  accommodationNights?: number
  foodWithPrincipalsAmount?: number
}

/** Input for accommodation rate lookup */
type AccommodationInput = {
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

// ────────────────────────────────────────────────────────────
// Rate lookups (all from DB — zero hardcoded values)
// ────────────────────────────────────────────────────────────

/** Get accommodation limit for a designation at a given work location */
async function getAccommodationLimit(
  supabase: SupabaseClient,
  input: AccommodationInput
): Promise<number> {
  const rate = await getExpenseRateByType(
    supabase,
    input.workLocationId,
    EXPENSE_RATE_TYPES.ACCOMMODATION,
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
    EXPENSE_RATE_TYPES.FOOD_WITH_PRINCIPALS,
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
    EXPENSE_RATE_TYPES.FOOD_BASE,
    null
  )
  if (foodRate) {
    items.push({
      expense_type: CLAIM_ITEM_TYPES.FOOD,
      amount: Number(foodRate.rate_amount),
      description: 'Base location food allowance',
    })
  }

  // Fuel rate (from vehicle_types.base_fuel_rate_per_day)
  items.push({
    expense_type: CLAIM_ITEM_TYPES.FUEL,
    amount: Number(input.vehicleType.base_fuel_rate_per_day),
    description: `${input.vehicleType.vehicle_name} base location fuel allowance`,
  })

  const total = items.reduce((sum, item) => sum + item.amount, 0)
  return { items, total }
}

/**
 * Calculate expense items for outstation with inter-city/intra-city segments.
 * - Food allowance is always added once for outstation claims.
 * - Inter-city own vehicle adds per-km reimbursement.
 * - Intra-city own vehicle adds a fixed daily allowance from expense_rates.
 * - Inter-city own vehicle implies intra-city allowance for the same day/vehicle.
 * - Non-own-vehicle segments do not add transport reimbursement in this flow.
 */
export async function calculateOutstationTravelItems(
  supabase: SupabaseClient,
  input: OutstationTravelInput
): Promise<{ items: CalculatedExpenseItem[]; total: number }> {
  const items: CalculatedExpenseItem[] = []

  const foodRate = await getExpenseRateByType(
    supabase,
    input.workLocationId,
    EXPENSE_RATE_TYPES.FOOD_OUTSTATION,
    null
  )

  if (foodRate) {
    items.push({
      expense_type: CLAIM_ITEM_TYPES.FOOD,
      amount: Number(foodRate.rate_amount),
      description: 'Outstation food allowance',
    })
  }

  const requiresVehicleType =
    (input.hasIntercityTravel && input.intercityOwnVehicleUsed) ||
    (input.hasIntracityTravel && input.intracityOwnVehicleUsed)

  const includesIntracityAllowance =
    (input.hasIntercityTravel && input.intercityOwnVehicleUsed) ||
    (input.hasIntracityTravel && input.intracityOwnVehicleUsed)

  if (requiresVehicleType && !input.vehicleType) {
    throw new Error('Vehicle type is required for selected own-vehicle travel.')
  }

  if (
    input.hasIntercityTravel &&
    input.intercityOwnVehicleUsed &&
    input.vehicleType
  ) {
    const kmTravelled = input.kmTravelled ?? 0
    const ratePerKm = Number(input.vehicleType.intercity_rate_per_km)
    const intercityAmount = kmTravelled * ratePerKm

    items.push({
      expense_type: CLAIM_ITEM_TYPES.INTERCITY_TRAVEL,
      amount: intercityAmount,
      description: `${kmTravelled} KM @ ₹${ratePerKm}/KM`,
    })
  }

  if (includesIntracityAllowance && input.vehicleType) {
    const intracityAllowance = await getIntracityAllowanceRateByVehicle(
      supabase,
      input.workLocationId,
      input.vehicleType.vehicle_code
    )

    if (intracityAllowance > 0) {
      items.push({
        expense_type: CLAIM_ITEM_TYPES.INTRACITY_ALLOWANCE,
        amount: intracityAllowance,
        description: `${input.vehicleType.vehicle_name} intra-city allowance`,
      })
    }
  }

  if (input.accommodationNights && input.accommodationNights > 0) {
    const accommodationRate = await getAccommodationLimit(supabase, {
      workLocationId: input.workLocationId,
      designationId: input.designationId,
    })

    if (accommodationRate > 0) {
      items.push({
        expense_type: CLAIM_ITEM_TYPES.ACCOMMODATION,
        amount: accommodationRate * input.accommodationNights,
        description: `${input.accommodationNights} night(s) @ ₹${accommodationRate}/night`,
      })
    }
  }

  if (input.foodWithPrincipalsAmount && input.foodWithPrincipalsAmount > 0) {
    const fwpLimit = await getFoodWithPrincipalsLimit(
      supabase,
      input.workLocationId,
      input.designationId
    )

    if (fwpLimit > 0) {
      const cappedAmount = Math.min(input.foodWithPrincipalsAmount, fwpLimit)
      items.push({
        expense_type: CLAIM_ITEM_TYPES.FOOD_WITH_PRINCIPALS,
        amount: cappedAmount,
        description: `Food with principals (capped at ₹${fwpLimit})`,
      })
    }
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0)
  return { items, total }
}
