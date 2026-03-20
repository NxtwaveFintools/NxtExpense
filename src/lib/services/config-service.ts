import type { SupabaseClient } from '@supabase/supabase-js'

import { getIntracityAllowanceRateTypeByVehicleCode } from '@/lib/constants/claim-expense'

// ────────────────────────────────────────────────────────────
// Shared ID-based types for the entire application
// All lookup table row shapes live here — features import from this file
// ────────────────────────────────────────────────────────────

type Designation = {
  id: string
  designation_code: string
  designation_name: string
  designation_abbreviation: string
  hierarchy_level: number
  is_active: boolean
}

type State = {
  id: string
  state_code: string
  state_name: string
  is_active: boolean
}

type City = {
  id: string
  city_name: string
  state_id: string
}

export type WorkLocation = {
  id: string
  location_code: string
  location_name: string
  requires_vehicle_selection: boolean
  requires_outstation_details: boolean
  allows_expenses: boolean
  display_order: number
  is_active: boolean
}

export type VehicleType = {
  id: string
  vehicle_code: string
  vehicle_name: string
  base_fuel_rate_per_day: number
  intercity_rate_per_km: number
  max_km_round_trip: number
  display_order: number
  is_active: boolean
}

type ClaimStatus = {
  id: string
  status_code: string
  status_name: string
  approval_level: number | null
  is_approval: boolean
  is_rejection: boolean
  is_terminal: boolean
  is_payment_issued: boolean
  requires_comment: boolean
  display_color: string | null
  display_order: number
  is_active: boolean
}

type ExpenseRate = {
  id: string
  designation_id: string | null
  location_id: string
  expense_type: string
  rate_amount: number
  effective_from: string
  effective_to: string | null
  is_active: boolean
}

export type DesignationApprovalFlow = {
  id: string
  designation_id: string
  required_approval_levels: number[]
  is_active: boolean
}

// ────────────────────────────────────────────────────────────
// Config service — single entry point for all lookup data
// ────────────────────────────────────────────────────────────

export async function getAllDesignations(
  supabase: SupabaseClient
): Promise<Designation[]> {
  const { data, error } = await supabase
    .from('designations')
    .select(
      'id, designation_code, designation_name, designation_abbreviation, hierarchy_level, is_active'
    )
    .eq('is_active', true)
    .order('hierarchy_level')

  if (error) throw new Error(`Failed to fetch designations: ${error.message}`)
  return data as Designation[]
}

export async function getAllStates(supabase: SupabaseClient): Promise<State[]> {
  const { data, error } = await supabase
    .from('states')
    .select('id, state_code, state_name, is_active')
    .eq('is_active', true)
    .order('state_name')

  if (error) throw new Error(`Failed to fetch states: ${error.message}`)
  return data as State[]
}

export async function getAllCities(supabase: SupabaseClient): Promise<City[]> {
  const { data, error } = await supabase
    .from('cities')
    .select('id, city_name, state_id')
    .eq('is_active', true)
    .order('city_name')

  if (error) throw new Error(`Failed to fetch cities: ${error.message}`)
  return data as City[]
}

export async function getAllWorkLocations(
  supabase: SupabaseClient
): Promise<WorkLocation[]> {
  const { data, error } = await supabase
    .from('work_locations')
    .select(
      'id, location_code, location_name, requires_vehicle_selection, requires_outstation_details, allows_expenses, display_order, is_active'
    )
    .eq('is_active', true)
    .order('display_order')

  if (error) throw new Error(`Failed to fetch work locations: ${error.message}`)
  return data as WorkLocation[]
}

export async function getAllVehicleTypes(
  supabase: SupabaseClient
): Promise<VehicleType[]> {
  const { data, error } = await supabase
    .from('vehicle_types')
    .select(
      'id, vehicle_code, vehicle_name, base_fuel_rate_per_day, intercity_rate_per_km, max_km_round_trip, display_order, is_active'
    )
    .eq('is_active', true)
    .order('display_order')

  if (error) throw new Error(`Failed to fetch vehicle types: ${error.message}`)
  return data as VehicleType[]
}

export async function getVehicleTypesByDesignation(
  supabase: SupabaseClient,
  designationId: string
): Promise<VehicleType[]> {
  const { data, error } = await supabase
    .from('designation_vehicle_permissions')
    .select(
      'vehicle_type_id, vehicle_types(id, vehicle_code, vehicle_name, base_fuel_rate_per_day, intercity_rate_per_km, max_km_round_trip, display_order, is_active)'
    )
    .eq('designation_id', designationId)

  if (error)
    throw new Error(`Failed to fetch vehicle permissions: ${error.message}`)

  return (data ?? [])
    .map((row: Record<string, unknown>) => row.vehicle_types as VehicleType)
    .filter(Boolean)
}

const CLAIM_STATUS_COLUMNS =
  'id, status_code, status_name, approval_level, is_approval, is_rejection, is_terminal, is_payment_issued, requires_comment, display_color, display_order, is_active'

export async function getAllClaimStatuses(
  supabase: SupabaseClient
): Promise<ClaimStatus[]> {
  const { data, error } = await supabase
    .from('claim_statuses')
    .select(CLAIM_STATUS_COLUMNS)
    .order('display_order')

  if (error) throw new Error(`Failed to fetch claim statuses: ${error.message}`)
  return data as ClaimStatus[]
}

const EXPENSE_RATE_COLUMNS =
  'id, designation_id, location_id, expense_type, rate_amount, effective_from, effective_to, is_active'

export async function getExpenseRateByType(
  supabase: SupabaseClient,
  locationId: string,
  expenseType: string,
  designationId?: string | null
): Promise<ExpenseRate | null> {
  let query = supabase
    .from('expense_rates')
    .select(EXPENSE_RATE_COLUMNS)
    .eq('location_id', locationId)
    .eq('expense_type', expenseType)
    .eq('is_active', true)

  if (designationId) {
    query = query.eq('designation_id', designationId)
  } else {
    query = query.is('designation_id', null)
  }

  const { data, error } = await query.maybeSingle()

  if (error) throw new Error(`Failed to fetch expense rate: ${error.message}`)
  return data as ExpenseRate | null
}

export async function getIntracityAllowanceRateByVehicle(
  supabase: SupabaseClient,
  workLocationId: string,
  vehicleCode: string
): Promise<number> {
  const expenseType = getIntracityAllowanceRateTypeByVehicleCode(vehicleCode)

  if (!expenseType) {
    return 0
  }

  const rate = await getExpenseRateByType(
    supabase,
    workLocationId,
    expenseType,
    null
  )

  return rate ? Number(rate.rate_amount) : 0
}

export async function getAllowedEmailDomains(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase
    .from('allowed_email_domains')
    .select('domain_name')
    .eq('is_active', true)

  if (error)
    throw new Error(`Failed to fetch allowed domains: ${error.message}`)
  return (data as { domain_name: string }[]).map((row) => row.domain_name)
}

export async function getDesignationApprovalFlow(
  supabase: SupabaseClient,
  designationId: string
): Promise<DesignationApprovalFlow> {
  const { data, error } = await supabase
    .from('designation_approval_flow')
    .select('id, designation_id, required_approval_levels, is_active')
    .eq('designation_id', designationId)
    .eq('is_active', true)
    .single()

  if (error) throw new Error(`Failed to fetch approval flow: ${error.message}`)
  return data as DesignationApprovalFlow
}
