import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  ClaimHistoryEntry,
  ClaimItem,
  ClaimStatusCatalogItem,
  ClaimWithItems,
  ExpenseItemType,
  IntracityVehicleMode,
  MyClaimsFilters,
  PaginatedClaims,
} from '@/features/claims/types'
import {
  buildClaimStatusFilterOptions,
  parseClaimStatusFilterValue,
} from '@/lib/utils/claim-status-filter'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'
import { resolveClaimAllowResubmitFilterValue } from '@/features/claims/data/queries/claim-status-filter.query'

import {
  CLAIM_COLUMNS,
  mapClaimRow,
} from '@/features/claims/data/queries/claim-columns'

const DEFAULT_MY_CLAIMS_FILTERS: MyClaimsFilters = {
  claimStatus: null,
  workLocation: null,
  claimDateFrom: null,
  claimDateTo: null,
}

type ClaimsFilterQuery = {
  eq: (column: string, value: unknown) => unknown
  gte: (column: string, value: unknown) => unknown
  lte: (column: string, value: unknown) => unknown
}

type ResolvedMyClaimsStatusFilter = {
  statusId: string
  allowResubmitFilter: boolean | null
}

export type ClaimPayload = {
  employeeId: string
  claimDateIso: string
  workLocationId: string | null
  expenseLocationId: string | null
  baseLocationDayTypeCode: string | null
  ownVehicleUsed: boolean | null
  hasIntercityTravel: boolean
  hasIntracityTravel: boolean
  intercityOwnVehicleUsed: boolean | null
  intracityOwnVehicleUsed: boolean | null
  intracityVehicleMode: IntracityVehicleMode | null
  vehicleTypeId: string | null
  outstationStateId: string | null
  outstationCityId: string | null
  fromCityId: string | null
  toCityId: string | null
  kmTravelled: number | null
  totalAmount: number
  statusId: string | null
  currentApprovalLevel: number | null
  submittedAt: string | null
  designationId: string | null
  accommodationNights: number | null
  foodWithPrincipalsAmount: number | null
}

export type InsertClaimItemInput = {
  claimId: string
  itemType: ExpenseItemType
  description: string | null
  amount: number
}

type ClaimStatusRow = {
  id: string
  status_code: string
  status_name: string
  is_terminal: boolean
  display_order: number
  display_color: string | null
  allow_resubmit_status_name: string | null
  allow_resubmit_display_color: string | null
}

type ClaimForDate = {
  id: string
  claim_number: string
  status_code: string
  current_approval_level: number | null
  is_rejection: boolean
  is_terminal: boolean
  allow_resubmit: boolean
  is_superseded: boolean
}

export type InitialWorkflowState = {
  statusId: string
  currentApprovalLevel: number | null
}

async function resolveMyClaimsStatusFilter(
  supabase: SupabaseClient,
  filters: MyClaimsFilters
): Promise<ResolvedMyClaimsStatusFilter | null> {
  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)

  if (!parsedStatusFilter) {
    return null
  }

  const allowResubmitFilter = await resolveClaimAllowResubmitFilterValue(
    supabase,
    parsedStatusFilter
  )

  return {
    statusId: parsedStatusFilter.statusId,
    allowResubmitFilter,
  }
}

function applyMyClaimsFilters(
  query: ClaimsFilterQuery,
  filters: MyClaimsFilters,
  statusFilter: ResolvedMyClaimsStatusFilter | null
): void {
  if (statusFilter) {
    query.eq('status_id', statusFilter.statusId)

    if (statusFilter.allowResubmitFilter !== null) {
      query.eq('allow_resubmit', statusFilter.allowResubmitFilter)
    }
  }

  if (filters.workLocation) {
    query.eq('work_location_id', filters.workLocation)
  }

  if (filters.claimDateFrom) {
    query.gte('claim_date', filters.claimDateFrom)
  }

  if (filters.claimDateTo) {
    query.lte('claim_date', filters.claimDateTo)
  }
}

export async function getMyClaimsPaginated(
  supabase: SupabaseClient,
  employeeId: string,
  cursor: string | null,
  limit = 10,
  filters: MyClaimsFilters = DEFAULT_MY_CLAIMS_FILTERS
): Promise<PaginatedClaims> {
  const statusFilter = await resolveMyClaimsStatusFilter(supabase, filters)

  let query = supabase
    .from('expense_claims')
    .select(CLAIM_COLUMNS)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    const decoded = decodeCursor(cursor)
    query = query.or(
      `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
    )
  }

  applyMyClaimsFilters(query, filters, statusFilter)

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map(
    mapClaimRow
  )
  const hasNextPage = rows.length > limit
  const pageData = hasNextPage ? rows.slice(0, limit) : rows

  const lastRecord = pageData.at(-1)
  const nextCursor =
    hasNextPage && lastRecord
      ? encodeCursor({
          created_at: lastRecord.created_at,
          id: lastRecord.id,
        })
      : null

  return {
    data: pageData,
    hasNextPage,
    nextCursor,
    limit,
  }
}

export async function getClaimById(
  supabase: SupabaseClient,
  claimId: string
): Promise<ClaimWithItems | null> {
  const { data: claimData, error: claimError } = await supabase
    .from('expense_claims')
    .select(CLAIM_COLUMNS)
    .eq('id', claimId)
    .maybeSingle()

  if (claimError) {
    throw new Error(claimError.message)
  }

  if (!claimData) {
    return null
  }

  const { data: itemData, error: itemsError } = await supabase
    .from('expense_claim_items')
    .select('id, claim_id, item_type, description, amount, created_at')
    .eq('claim_id', claimId)

  if (itemsError) {
    throw new Error(itemsError.message)
  }

  return {
    claim: mapClaimRow(claimData as unknown as Record<string, unknown>),
    items: (itemData ?? []) as ClaimItem[],
  }
}

export async function getClaimStatusCatalog(
  supabase: SupabaseClient
): Promise<ClaimStatusCatalogItem[]> {
  const { data, error } = await supabase
    .from('claim_statuses')
    .select(
      'id, status_code, status_name, is_terminal, display_order, display_color, allow_resubmit_status_name, allow_resubmit_display_color'
    )
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const statusRows = (data ?? []) as ClaimStatusRow[]
  const statusRowById = new Map(statusRows.map((row) => [row.id, row]))
  const statusFilterOptions = buildClaimStatusFilterOptions(statusRows)

  return statusFilterOptions.map((option) => {
    const sourceStatus = statusRowById.get(option.statusId)
    const baseColorToken = sourceStatus?.display_color?.trim() || 'neutral'
    const allowResubmitColorToken =
      sourceStatus?.allow_resubmit_display_color?.trim() || baseColorToken

    return {
      status_id: option.statusId,
      status_filter_value: option.value,
      allow_resubmit_only: option.allowResubmitOnly,
      display_label: option.label,
      is_terminal: sourceStatus?.is_terminal ?? false,
      sort_order: sourceStatus?.display_order ?? 0,
      color_token: option.allowResubmitOnly
        ? allowResubmitColorToken
        : baseColorToken,
      description: null,
    }
  })
}

export async function getClaimHistory(
  supabase: SupabaseClient,
  claimId: string
): Promise<ClaimHistoryEntry[]> {
  const { data, error } = await supabase
    .from('approval_history')
    .select(
      'id, claim_id, approver_employee_id, approver:employees!approver_employee_id(employee_email, employee_name), approval_level, action, notes, rejection_notes, allow_resubmit, bypass_reason, skipped_levels, reason, acted_at'
    )
    .eq('claim_id', claimId)
    .order('acted_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    return {
      ...r,
      approver_email: r.approver?.employee_email ?? '',
      approver_name: r.approver?.employee_name ?? null,
    } as ClaimHistoryEntry
  })
}

export async function getMyClaimsTotalCount(
  supabase: SupabaseClient,
  employeeId: string,
  filters: MyClaimsFilters
): Promise<number> {
  const statusFilter = await resolveMyClaimsStatusFilter(supabase, filters)

  const query = supabase
    .from('expense_claims')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', employeeId)

  applyMyClaimsFilters(query, filters, statusFilter)

  const { count, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

export async function insertClaim(
  supabase: SupabaseClient,
  input: ClaimPayload
): Promise<{ id: string; claim_number: string }> {
  const payload = {
    employee_id: input.employeeId,
    claim_date: input.claimDateIso,
    work_location_id: input.workLocationId,
    expense_location_id: input.expenseLocationId,
    base_location_day_type_code: input.baseLocationDayTypeCode,
    own_vehicle_used: input.ownVehicleUsed,
    has_intercity_travel: input.hasIntercityTravel,
    has_intracity_travel: input.hasIntracityTravel,
    intercity_own_vehicle_used: input.intercityOwnVehicleUsed,
    intracity_own_vehicle_used: input.intracityOwnVehicleUsed,
    intracity_vehicle_mode: input.intracityVehicleMode,
    vehicle_type_id: input.vehicleTypeId,
    outstation_state_id: input.outstationStateId,
    outstation_city_id: input.outstationCityId,
    from_city_id: input.fromCityId,
    to_city_id: input.toCityId,
    km_travelled: input.kmTravelled,
    total_amount: input.totalAmount,
    status_id: input.statusId,
    current_approval_level: input.currentApprovalLevel,
    submitted_at: input.submittedAt,
    designation_id: input.designationId,
    accommodation_nights: input.accommodationNights,
    food_with_principals_amount: input.foodWithPrincipalsAmount,
  }

  const { data, error } = await supabase
    .from('expense_claims')
    .insert(payload)
    .select('id, claim_number')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as { id: string; claim_number: string }
}

export async function insertClaimItems(
  supabase: SupabaseClient,
  items: InsertClaimItemInput[]
): Promise<void> {
  if (items.length === 0) {
    return
  }

  const { error } = await supabase.from('expense_claim_items').insert(
    items.map((item) => ({
      claim_id: item.claimId,
      item_type: item.itemType,
      description: item.description,
      amount: item.amount,
    }))
  )

  if (error) {
    throw new Error(error.message)
  }
}

export async function getClaimForDate(
  supabase: SupabaseClient,
  employeeId: string,
  claimDateIso: string
): Promise<ClaimForDate | null> {
  const { data, error } = await supabase
    .from('expense_claims')
    .select(
      'id, claim_number, current_approval_level, allow_resubmit, is_superseded, claim_statuses!status_id(status_code, is_rejection, is_terminal)'
    )
    .eq('employee_id', employeeId)
    .eq('claim_date', claimDateIso)
    .eq('is_superseded', false)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  const rowData = (data ?? [])[0]

  if (!rowData) {
    return null
  }

  const row = rowData as unknown as {
    id: string
    claim_number: string
    current_approval_level: number | null
    allow_resubmit: boolean
    is_superseded: boolean
    claim_statuses:
      | { status_code: string; is_rejection: boolean; is_terminal: boolean }
      | Array<{
          status_code: string
          is_rejection: boolean
          is_terminal: boolean
        }>
  }

  const statusInfo = Array.isArray(row.claim_statuses)
    ? row.claim_statuses[0]
    : row.claim_statuses
  const isRejection = statusInfo?.is_rejection ?? false

  return {
    id: row.id,
    claim_number: row.claim_number,
    status_code: statusInfo?.status_code ?? 'UNKNOWN',
    current_approval_level: row.current_approval_level ?? null,
    allow_resubmit: isRejection ? row.allow_resubmit : false,
    is_superseded: row.is_superseded,
    is_rejection: isRejection,
    is_terminal: statusInfo?.is_terminal ?? false,
  }
}

export async function resolveInitialWorkflowState(
  supabase: SupabaseClient,
  firstLevel: number | null | undefined
): Promise<InitialWorkflowState> {
  if (!firstLevel) {
    throw new Error(
      `Unsupported first approval level configured for employee: ${firstLevel ?? 'none'}.`
    )
  }

  const { data: status, error } = await supabase
    .from('claim_statuses')
    .select('id')
    .eq('approval_level', firstLevel)
    .eq('is_approval', false)
    .eq('is_rejection', false)
    .eq('is_terminal', false)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .maybeSingle()

  if (error) {
    throw new Error(
      `Failed to resolve initial claim workflow state: ${error.message}`
    )
  }

  if (!status) {
    throw new Error(
      `No active pending claim status found for approval level ${firstLevel}.`
    )
  }

  return {
    statusId: status.id,
    currentApprovalLevel: firstLevel >= 3 ? null : firstLevel,
  }
}

export async function validateCitiesForSelectedState(
  supabase: SupabaseClient,
  stateId: string,
  cityIds: Array<string | undefined>
): Promise<string | null> {
  const { data: selectedState, error: stateError } = await supabase
    .from('states')
    .select('id, is_active')
    .eq('id', stateId)
    .maybeSingle()

  if (stateError) {
    return 'Unable to validate selected state.'
  }

  if (!selectedState) {
    return 'Selected state is invalid.'
  }

  if (!selectedState.is_active) {
    return 'Selected state is inactive. Please choose an active state.'
  }

  const uniqueCityIds = [...new Set(cityIds.filter(Boolean))] as string[]

  if (uniqueCityIds.length === 0) {
    return null
  }

  const { data, error } = await supabase
    .from('cities')
    .select('id')
    .eq('state_id', stateId)
    .eq('is_active', true)
    .in('id', uniqueCityIds)

  if (error) {
    return 'Unable to validate selected cities for the chosen state.'
  }

  const validIds = new Set((data ?? []).map((row) => row.id as string))
  const hasInvalidCity = uniqueCityIds.some((cityId) => !validIds.has(cityId))

  return hasInvalidCity
    ? 'Selected cities must be active and belong to the selected state.'
    : null
}
