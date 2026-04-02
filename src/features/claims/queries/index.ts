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
import { getClaimStatusDisplay } from '@/lib/utils/claim-status'
import {
  buildClaimStatusFilterOptions,
  parseClaimStatusFilterValue,
} from '@/lib/utils/claim-status-filter'

const LEGACY_CLAIM_COLUMNS =
  'id, claim_number, employee_id, claim_date, work_location_id, work_locations(location_name), own_vehicle_used, vehicle_type_id, vehicle_types(vehicle_name), outstation_state_id, outstation_city_id, from_city_id, to_city_id, outstation_state:states!outstation_state_id(state_name), outstation_city:cities!outstation_city_id(city_name), from_city_data:cities!from_city_id(city_name), to_city_data:cities!to_city_id(city_name), km_travelled, total_amount, status_id, claim_statuses!status_id(status_code, status_name, display_color, allow_resubmit_status_name, allow_resubmit_display_color, is_terminal, is_rejection), allow_resubmit, is_superseded, current_approval_level, submitted_at, created_at, updated_at, resubmission_count, last_rejection_notes, last_rejected_at, accommodation_nights, food_with_principals_amount'

const SEGMENT_CLAIM_COLUMNS =
  'has_intercity_travel, has_intracity_travel, intercity_own_vehicle_used, intracity_own_vehicle_used, intracity_vehicle_mode'

export const CLAIM_COLUMNS = LEGACY_CLAIM_COLUMNS

const CLAIM_COLUMNS_WITH_SEGMENTS = `${LEGACY_CLAIM_COLUMNS}, ${SEGMENT_CLAIM_COLUMNS}`
const CLAIM_AVAILABLE_ACTIONS_MAX_RETRIES = 2
const CLAIM_AVAILABLE_ACTIONS_RETRY_DELAY_MS = 250

function isTransientNetworkErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('fetch failed') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('timeout') ||
    normalized.includes('connect') ||
    normalized.includes('terminated')
  )
}

async function waitForRetry(attempt: number): Promise<void> {
  await new Promise((resolve) =>
    setTimeout(resolve, CLAIM_AVAILABLE_ACTIONS_RETRY_DELAY_MS * attempt)
  )
}

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
    message.includes('expense_claims.intracity_own_vehicle_used') ||
    message.includes('expense_claims.intracity_vehicle_mode')
  )
}

// Maps raw Supabase FK join row to flat Claim type
export function mapClaimRow(raw: Record<string, unknown>): Claim {
  const r = raw as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const statusInfo = Array.isArray(r.claim_statuses)
    ? r.claim_statuses[0]
    : r.claim_statuses
  const statusCode = statusInfo?.status_code
  const statusDisplay = getClaimStatusDisplay({
    statusCode,
    statusName: statusInfo?.status_name,
    statusDisplayColor: statusInfo?.display_color,
    allowResubmit: Boolean(r.allow_resubmit),
    allowResubmitStatusName: statusInfo?.allow_resubmit_status_name,
    allowResubmitDisplayColor: statusInfo?.allow_resubmit_display_color,
  })
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
    intracity_vehicle_mode: r.intracity_vehicle_mode ?? null,
    allow_resubmit: r.allow_resubmit ?? false,
    is_superseded: r.is_superseded ?? false,
    statusName: statusDisplay.label,
    statusDisplayColor: statusDisplay.colorToken,
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
  claimDateFrom: null,
  claimDateTo: null,
}

type ClaimsFilterQuery = {
  eq: (column: string, value: unknown) => unknown
  gte: (column: string, value: unknown) => unknown
  lte: (column: string, value: unknown) => unknown
}

function applyMyClaimsFilters(
  query: ClaimsFilterQuery,
  filters: MyClaimsFilters
): void {
  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)

  if (parsedStatusFilter) {
    query.eq('status_id', parsedStatusFilter.statusId)

    if (parsedStatusFilter.allowResubmitOnly) {
      query.eq('allow_resubmit', true)
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

    applyMyClaimsFilters(query, filters)
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
      'id, status_code, status_name, is_terminal, display_order, display_color, allow_resubmit_status_name, allow_resubmit_display_color'
    )
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const statusRows = (data ?? []) as Array<{
    id: string
    status_code: string
    status_name: string
    is_terminal: boolean
    display_order: number
    display_color: string | null
    allow_resubmit_status_name: string | null
    allow_resubmit_display_color: string | null
  }>

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

export async function getClaimAvailableActions(
  supabase: SupabaseClient,
  claimId: string
): Promise<ClaimAvailableAction[]> {
  for (
    let attempt = 0;
    attempt <= CLAIM_AVAILABLE_ACTIONS_MAX_RETRIES;
    attempt += 1
  ) {
    const { data, error } = await supabase.rpc('get_claim_available_actions', {
      p_claim_id: claimId,
    })

    if (!error) {
      return (data ?? []) as ClaimAvailableAction[]
    }

    const shouldRetry =
      attempt < CLAIM_AVAILABLE_ACTIONS_MAX_RETRIES &&
      isTransientNetworkErrorMessage(error.message)

    if (shouldRetry) {
      await waitForRetry(attempt + 1)
      continue
    }

    throw new Error(error.message)
  }

  throw new Error('Failed to fetch claim actions after retries.')
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

export async function getMyClaimsTotalCount(
  supabase: SupabaseClient,
  employeeId: string,
  filters: MyClaimsFilters
): Promise<number> {
  const query = supabase
    .from('expense_claims')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', employeeId)

  applyMyClaimsFilters(query, filters)

  const { count, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

export type MyClaimsMetricSummary = {
  count: number
  amount: number
}

export type MyClaimsStats = {
  total: MyClaimsMetricSummary
  pending: MyClaimsMetricSummary
  rejected: MyClaimsMetricSummary
  rejectedAllowReclaim: MyClaimsMetricSummary
}

type ClaimStatusSummaryRow = {
  id: string
  is_rejection: boolean
  is_payment_issued: boolean
}

type MyClaimStatsRow = {
  id: string
  created_at: string
  status_id: string
  total_amount: number | string
  allow_resubmit: boolean
}

function createMetricSummary(): MyClaimsMetricSummary {
  return { count: 0, amount: 0 }
}

function addToMetric(metric: MyClaimsMetricSummary, amount: number) {
  metric.count += 1
  metric.amount += amount
}

export async function getMyClaimsStats(
  supabase: SupabaseClient,
  employeeId: string,
  filters: MyClaimsFilters
): Promise<MyClaimsStats> {
  const { data: statusRows, error: statusError } = await supabase
    .from('claim_statuses')
    .select('id, is_rejection, is_payment_issued')
    .eq('is_active', true)

  if (statusError) {
    throw new Error(statusError.message)
  }

  const rejectedStatusIds = new Set(
    ((statusRows ?? []) as ClaimStatusSummaryRow[])
      .filter((status) => status.is_rejection)
      .map((status) => status.id)
  )

  const approvedStatusIds = new Set(
    ((statusRows ?? []) as ClaimStatusSummaryRow[])
      .filter((status) => status.is_payment_issued)
      .map((status) => status.id)
  )

  const stats: MyClaimsStats = {
    total: createMetricSummary(),
    pending: createMetricSummary(),
    rejected: createMetricSummary(),
    rejectedAllowReclaim: createMetricSummary(),
  }

  const pageSize = 500
  let lastCursor: { createdAt: string; id: string } | null = null

  for (;;) {
    let query = supabase
      .from('expense_claims')
      .select('id, created_at, status_id, total_amount, allow_resubmit')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize)

    if (lastCursor) {
      query = query.or(
        `created_at.lt.${lastCursor.createdAt},and(created_at.eq.${lastCursor.createdAt},id.lt.${lastCursor.id})`
      )
    }

    applyMyClaimsFilters(query, filters)

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    const claimRows = (data ?? []) as MyClaimStatsRow[]

    if (claimRows.length === 0) {
      break
    }

    for (const row of claimRows) {
      const amount = Number(row.total_amount ?? 0)
      addToMetric(stats.total, amount)

      if (rejectedStatusIds.has(row.status_id)) {
        if (row.allow_resubmit) {
          addToMetric(stats.rejectedAllowReclaim, amount)
        } else {
          addToMetric(stats.rejected, amount)
        }
        continue
      }

      if (approvedStatusIds.has(row.status_id)) {
        continue
      }

      addToMetric(stats.pending, amount)
    }

    if (claimRows.length < pageSize) {
      break
    }

    const lastRow = claimRows[claimRows.length - 1]
    lastCursor = {
      createdAt: lastRow.created_at,
      id: lastRow.id,
    }
  }

  return stats
}
