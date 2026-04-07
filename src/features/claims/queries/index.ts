import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  Claim,
  ClaimHistoryEntry,
  MyClaimsFilters,
  ClaimItem,
  ClaimStatusCatalogItem,
  ClaimWithItems,
  PaginatedClaims,
} from '@/features/claims/types'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'
import {
  buildClaimStatusFilterOptions,
  parseClaimStatusFilterValue,
} from '@/lib/utils/claim-status-filter'
import { resolveClaimAllowResubmitFilterValue } from '@/lib/services/claim-status-filter-service'
import { CLAIM_COLUMNS, mapClaimRow } from './claim-columns'

// Re-export submodules for barrel access
export { CLAIM_COLUMNS, mapClaimRow } from './claim-columns'
export {
  getClaimAvailableActions,
  getClaimAvailableActionsByClaimIds,
} from './claim-actions'
export {
  getMyClaimsStats,
  type MyClaimsMetricSummary,
  type MyClaimsStats,
} from './claim-stats'

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

    applyMyClaimsFilters(query, filters, statusFilter)
    return query
  }

  const { data, error } = await runClaimsQuery(CLAIM_COLUMNS)

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

  const { data: claimData, error: claimError } =
    await runClaimByIdQuery(CLAIM_COLUMNS)

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
  void supabase
  void employeeId
  void filters
  void batchSize

  throw new Error(
    'Unbounded getAllFilteredMyClaims is disabled. Use getMyClaimsPaginated for cursor-based access.'
  )
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
