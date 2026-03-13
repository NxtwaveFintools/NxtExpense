import type { SupabaseClient } from '@supabase/supabase-js'

// ────────────────────────────────────────────────────────────
// Shared ID-based types for the entire application
// All lookup table row shapes live here — features import from this file
// ────────────────────────────────────────────────────────────

export type Designation = {
  id: string
  designation_code: string
  designation_name: string
  designation_abbreviation: string
  hierarchy_level: number
  is_active: boolean
}

export type State = {
  id: string
  state_code: string
  state_name: string
  is_active: boolean
}

export type City = {
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

export type TransportType = {
  id: string
  transport_code: string
  transport_name: string
  display_order: number
  is_active: boolean
}

export type ClaimStatus = {
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

export type ClaimStatusTransition = {
  id: string
  from_status_id: string
  to_status_id: string
  required_role_id: string | null
  auto_transition: boolean
}

export type ExpenseRate = {
  id: string
  designation_id: string | null
  location_id: string
  expense_type: string
  rate_amount: number
  effective_from: string
  effective_to: string | null
  is_active: boolean
}

export type ValidationRule = {
  id: string
  rule_code: string
  rule_value: string
  description: string | null
}

export type SystemSetting = {
  id: string
  setting_key: string
  setting_value: string
  description: string | null
}

export type AllowedEmailDomain = {
  id: string
  domain_name: string
  is_active: boolean
}

export type DesignationVehiclePermission = {
  id: string
  designation_id: string
  vehicle_type_id: string
}

export type ApprovalRouting = {
  id: string
  submitter_designation_id: string
  submitter_state_id: string | null
  approval_level: number
  approver_role_id: string
  approver_designation_id: string | null
  approver_state_id: string | null
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

export async function getDesignationByCode(
  supabase: SupabaseClient,
  code: string
): Promise<Designation | null> {
  const { data, error } = await supabase
    .from('designations')
    .select(
      'id, designation_code, designation_name, designation_abbreviation, hierarchy_level, is_active'
    )
    .eq('designation_code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (error)
    throw new Error(`Failed to fetch designation by code: ${error.message}`)
  return data as Designation | null
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

export async function getCitiesByState(
  supabase: SupabaseClient,
  stateId: string
): Promise<City[]> {
  const { data, error } = await supabase
    .from('cities')
    .select('id, city_name, state_id')
    .eq('state_id', stateId)
    .order('city_name')

  if (error) throw new Error(`Failed to fetch cities: ${error.message}`)
  return data as City[]
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

export async function getAllTransportTypes(
  supabase: SupabaseClient
): Promise<TransportType[]> {
  const { data, error } = await supabase
    .from('transport_types')
    .select('id, transport_code, transport_name, display_order, is_active')
    .eq('is_active', true)
    .order('display_order')

  if (error)
    throw new Error(`Failed to fetch transport types: ${error.message}`)
  return data as TransportType[]
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

export async function getClaimStatusByCode(
  supabase: SupabaseClient,
  statusCode: string
): Promise<ClaimStatus> {
  const { data, error } = await supabase
    .from('claim_statuses')
    .select(CLAIM_STATUS_COLUMNS)
    .ilike('status_code', statusCode)
    .single()

  if (error)
    throw new Error(
      `Failed to fetch claim status '${statusCode}': ${error.message}`
    )
  return data as ClaimStatus
}

const EXPENSE_RATE_COLUMNS =
  'id, designation_id, location_id, expense_type, rate_amount, effective_from, effective_to, is_active'

export async function getExpenseRates(
  supabase: SupabaseClient,
  locationId: string,
  designationId?: string | null
): Promise<ExpenseRate[]> {
  let query = supabase
    .from('expense_rates')
    .select(EXPENSE_RATE_COLUMNS)
    .eq('location_id', locationId)
    .eq('is_active', true)

  if (designationId) {
    query = query.eq('designation_id', designationId)
  } else {
    query = query.is('designation_id', null)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch expense rates: ${error.message}`)
  return data as ExpenseRate[]
}

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

export async function getValidationRules(
  supabase: SupabaseClient
): Promise<ValidationRule[]> {
  const { data, error } = await supabase
    .from('validation_rules')
    .select('id, rule_code, rule_value, description')

  if (error)
    throw new Error(`Failed to fetch validation rules: ${error.message}`)
  return data as ValidationRule[]
}

export async function getValidationRule(
  supabase: SupabaseClient,
  ruleCode: string
): Promise<string> {
  const { data, error } = await supabase
    .from('validation_rules')
    .select('rule_value')
    .eq('rule_code', ruleCode)
    .single()

  if (error)
    throw new Error(`Failed to fetch rule '${ruleCode}': ${error.message}`)
  return (data as { rule_value: string }).rule_value
}

export async function getSystemSetting(
  supabase: SupabaseClient,
  settingKey: string
): Promise<string> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', settingKey)
    .single()

  if (error)
    throw new Error(`Failed to fetch setting '${settingKey}': ${error.message}`)
  return (data as { setting_value: string }).setting_value
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

const APPROVAL_ROUTING_COLUMNS =
  'id, submitter_designation_id, submitter_state_id, approval_level, approver_role_id, approver_designation_id, approver_state_id, is_active'

export async function getApprovalRouting(
  supabase: SupabaseClient,
  designationId: string,
  stateId: string | null,
  approvalLevel: number
): Promise<ApprovalRouting | null> {
  let query = supabase
    .from('approval_routing')
    .select(APPROVAL_ROUTING_COLUMNS)
    .eq('submitter_designation_id', designationId)
    .eq('approval_level', approvalLevel)
    .eq('is_active', true)

  if (stateId) {
    query = query.eq('submitter_state_id', stateId)
  } else {
    query = query.is('submitter_state_id', null)
  }

  const { data, error } = await query.maybeSingle()

  if (error)
    throw new Error(`Failed to fetch approval routing: ${error.message}`)
  return data as ApprovalRouting | null
}

/** Get all approval routing entries for a submitter designation */
export async function getApprovalRoutingForDesignation(
  supabase: SupabaseClient,
  designationId: string,
  stateId?: string | null
): Promise<ApprovalRouting[]> {
  let query = supabase
    .from('approval_routing')
    .select(APPROVAL_ROUTING_COLUMNS)
    .eq('submitter_designation_id', designationId)
    .eq('is_active', true)
    .order('approval_level')

  if (stateId) {
    // Fetch state-specific + state-null entries
    query = query.or(
      `submitter_state_id.eq.${stateId},submitter_state_id.is.null`
    )
  }

  const { data, error } = await query

  if (error)
    throw new Error(`Failed to fetch approval routing: ${error.message}`)
  return data as ApprovalRouting[]
}

export async function getClaimStatusTransitions(
  supabase: SupabaseClient,
  fromStatusId: string
): Promise<ClaimStatusTransition[]> {
  const { data, error } = await supabase
    .from('claim_status_transitions')
    .select(
      'id, from_status_id, to_status_id, required_role_id, auto_transition'
    )
    .eq('from_status_id', fromStatusId)

  if (error)
    throw new Error(`Failed to fetch status transitions: ${error.message}`)
  return data as ClaimStatusTransition[]
}
