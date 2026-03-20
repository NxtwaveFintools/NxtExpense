import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  Claim,
  ClaimAvailableAction,
  ClaimHistoryEntry,
  MyClaimsFilters,
  ClaimItem,
  ClaimStatusCatalogItem,
  ClaimWithItems,
  PaginatedClaims,
} from '@/features/claims/types'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'
import { getClaimStatusDisplayLabel } from '@/lib/utils/claim-status'

const LEGACY_CLAIM_COLUMNS =
  'id, claim_number, employee_id, claim_date, work_location_id, work_locations(location_name), own_vehicle_used, vehicle_type_id, vehicle_types(vehicle_name), outstation_state_id, outstation_city_id, from_city_id, to_city_id, outstation_state:states!outstation_state_id(state_name), outstation_city:cities!outstation_city_id(city_name), from_city_data:cities!from_city_id(city_name), to_city_data:cities!to_city_id(city_name), km_travelled, total_amount, status_id, allow_resubmit, is_superseded, claim_statuses!status_id(status_code, status_name, display_color, is_terminal, is_rejection), current_approval_level, submitted_at, created_at, updated_at, resubmission_count, last_rejection_notes, last_rejected_at, accommodation_nights, food_with_principals_amount'

const SEGMENT_CLAIM_COLUMNS =
  'has_intercity_travel, has_intracity_travel, intercity_own_vehicle_used, intracity_own_vehicle_used'

export const CLAIM_COLUMNS = LEGACY_CLAIM_COLUMNS

const CLAIM_COLUMNS_WITH_SEGMENTS = `${LEGACY_CLAIM_COLUMNS}, ${SEGMENT_CLAIM_COLUMNS}`

function isMissingOutstationSegmentColumnsError(
  error: { message?: string } | null
): boolean {
  const message = error?.message?.toLowerCase() ?? ''

  if (!message.includes('does not exist')) {
    return false
  }

  return (
    message.includes('expense_claims.has_intercity_travel') ||
    message.includes('expense_claims.has_intracity_travel') ||
    message.includes('expense_claims.intercity_own_vehicle_used') ||
    message.includes('expense_claims.intracity_own_vehicle_used')
  )
}

// Maps raw Supabase FK join row to flat Claim type
export function mapClaimRow(raw: Record<string, unknown>): Claim {
  const r = raw as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const statusInfo = Array.isArray(r.claim_statuses)
    ? r.claim_statuses[0]
    : r.claim_statuses
  const statusCode = statusInfo?.status_code
  const outstationCity = Array.isArray(r.outstation_city)
    ? r.outstation_city[0]
    : r.outstation_city
  const outstationState = Array.isArray(r.outstation_state)
    ? r.outstation_state[0]
    : r.outstation_state
  const fromCityObj = Array.isArray(r.from_city_data)
    ? r.from_city_data[0]
    : r.from_city_data
  const toCityObj = Array.isArray(r.to_city_data)
    ? r.to_city_data[0]
    : r.to_city_data
  return {
    ...r,
    has_intercity_travel: r.has_intercity_travel ?? false,
    has_intracity_travel: r.has_intracity_travel ?? false,
    intercity_own_vehicle_used: r.intercity_own_vehicle_used ?? null,
    intracity_own_vehicle_used: r.intracity_own_vehicle_used ?? null,
    statusName: getClaimStatusDisplayLabel(statusCode, statusInfo?.status_name),
    statusDisplayColor: statusInfo?.display_color ?? 'neutral',
    is_terminal: statusInfo?.is_terminal ?? false,
    is_rejection: statusInfo?.is_rejection ?? false,
    outstation_state_name: outstationState?.state_name ?? null,
    work_location: r.work_locations?.location_name ?? '',
    vehicle_type: r.vehicle_types?.vehicle_name ?? null,
    outstation_city_name: outstationCity?.city_name ?? null,
    from_city_name: fromCityObj?.city_name ?? null,
    to_city_name: toCityObj?.city_name ?? null,
  } as Claim
}

const DEFAULT_MY_CLAIMS_FILTERS: MyClaimsFilters = {
  claimStatus: null,
  workLocation: null,
  claimDate: null,
}

export async function getMyClaimsPaginated(
  supabase: SupabaseClient,
  employeeId: string,
  cursor: string | null,
  limit = 10,
  filters: MyClaimsFilters = DEFAULT_MY_CLAIMS_FILTERS
): Promise<PaginatedClaims> {
  const runClaimsQuery = async (columns: string) => {
    let query = supabase
      .from('expense_claims')
      .select(columns)
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

    if (filters.claimStatus) {
      query = query.eq('status_id', filters.claimStatus)
    }

    if (filters.workLocation) {
      query = query.eq('work_location_id', filters.workLocation)
    }

    if (filters.claimDate) {
      query = query.eq('claim_date', filters.claimDate)
    }

    return query
  }

  let { data, error } = await runClaimsQuery(CLAIM_COLUMNS_WITH_SEGMENTS)

  if (error && isMissingOutstationSegmentColumnsError(error)) {
    ;({ data, error } = await runClaimsQuery(CLAIM_COLUMNS))
  }

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
  const runClaimByIdQuery = async (columns: string) => {
    return supabase
      .from('expense_claims')
      .select(columns)
      .eq('id', claimId)
      .maybeSingle()
  }

  let { data: claimData, error: claimError } = await runClaimByIdQuery(
    CLAIM_COLUMNS_WITH_SEGMENTS
  )

  if (claimError && isMissingOutstationSegmentColumnsError(claimError)) {
    ;({ data: claimData, error: claimError } =
      await runClaimByIdQuery(CLAIM_COLUMNS))
  }

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
      'id, status_code, status_name, is_terminal, display_order, display_color'
    )
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    status_id: row.id,
    display_label: getClaimStatusDisplayLabel(row.status_code, row.status_name),
    is_terminal: row.is_terminal,
    sort_order: row.display_order,
    color_token: row.display_color ?? 'neutral',
    description: null,
  }))
}

export async function getClaimAvailableActions(
  supabase: SupabaseClient,
  claimId: string
): Promise<ClaimAvailableAction[]> {
  const { data, error } = await supabase.rpc('get_claim_available_actions', {
    p_claim_id: claimId,
  })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ClaimAvailableAction[]
}

type BulkClaimAvailableActionRow = ClaimAvailableAction & {
  claim_id: string
}

function isMissingBulkActionsRpcError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ''

  return (
    message.includes('get_claim_available_actions_bulk') &&
    (message.includes('schema cache') || message.includes('does not exist'))
  )
}

export async function getClaimAvailableActionsByClaimIds(
  supabase: SupabaseClient,
  claimIds: string[]
): Promise<Map<string, ClaimAvailableAction[]>> {
  const uniqueClaimIds = [...new Set(claimIds)]

  if (uniqueClaimIds.length === 0) {
    return new Map()
  }

  const actionsByClaimId = new Map<string, ClaimAvailableAction[]>(
    uniqueClaimIds.map((claimId) => [claimId, []])
  )

  const { data, error } = await supabase.rpc(
    'get_claim_available_actions_bulk',
    {
      p_claim_ids: uniqueClaimIds,
    }
  )

  // Keep compatibility with environments where the bulk RPC migration
  // has not been applied yet by falling back to per-claim lookups.
  if (error) {
    if (!isMissingBulkActionsRpcError(error)) {
      throw new Error(error.message)
    }

    const fallbackResults = await Promise.all(
      uniqueClaimIds.map(async (claimId) => {
        const actions = await getClaimAvailableActions(supabase, claimId)
        return { claimId, actions }
      })
    )

    for (const fallbackResult of fallbackResults) {
      actionsByClaimId.set(fallbackResult.claimId, fallbackResult.actions)
    }

    return actionsByClaimId
  }

  for (const row of (data ?? []) as BulkClaimAvailableActionRow[]) {
    const existing = actionsByClaimId.get(row.claim_id)

    if (!existing) {
      actionsByClaimId.set(row.claim_id, [row])
      continue
    }

    existing.push({
      action: row.action,
      display_label: row.display_label,
      require_notes: row.require_notes,
      supports_allow_resubmit: row.supports_allow_resubmit,
      actor_scope: row.actor_scope,
    })
  }

  return actionsByClaimId
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

export async function getAllFilteredMyClaims(
  supabase: SupabaseClient,
  employeeId: string,
  filters: MyClaimsFilters,
  batchSize = 200
): Promise<Claim[]> {
  const allRows: Claim[] = []
  let cursor: string | null = null

  for (;;) {
    const page = await getMyClaimsPaginated(
      supabase,
      employeeId,
      cursor,
      batchSize,
      filters
    )

    allRows.push(...page.data)

    if (!page.hasNextPage || !page.nextCursor) {
      break
    }

    cursor = page.nextCursor
  }

  return allRows
}
