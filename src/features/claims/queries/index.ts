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

const CLAIM_COLUMNS =
  'id, claim_number, employee_id, claim_date, work_location, own_vehicle_used, vehicle_type, outstation_location, from_city, to_city, km_travelled, total_amount, status, current_approval_level, submitted_at, created_at, updated_at, tenant_id, resubmission_count, last_rejection_notes, last_rejected_by_email, last_rejected_at'

const DEFAULT_MY_CLAIMS_FILTERS: MyClaimsFilters = {
  claimStatus: null,
  workLocation: null,
  claimDateFrom: null,
  claimDateTo: null,
  resubmittedOnly: false,
}

export async function getMyClaimsPaginated(
  supabase: SupabaseClient,
  employeeId: string,
  cursor: string | null,
  limit = 10,
  filters: MyClaimsFilters = DEFAULT_MY_CLAIMS_FILTERS
): Promise<PaginatedClaims> {
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

  if (filters.claimStatus) {
    query = query.eq('status', filters.claimStatus)
  }

  if (filters.workLocation) {
    query = query.eq('work_location', filters.workLocation)
  }

  if (filters.claimDateFrom) {
    query = query.gte('claim_date', filters.claimDateFrom)
  }

  if (filters.claimDateTo) {
    query = query.lte('claim_date', filters.claimDateTo)
  }

  if (filters.resubmittedOnly) {
    query = query.gt('resubmission_count', 0)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Claim[]
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
    claim: claimData as Claim,
    items: (itemData ?? []) as ClaimItem[],
  }
}

export async function getClaimStatusCatalog(
  supabase: SupabaseClient
): Promise<ClaimStatusCatalogItem[]> {
  const { data, error } = await supabase
    .from('claim_status_catalog')
    .select(
      'status, display_label, is_terminal, sort_order, color_token, description'
    )
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ClaimStatusCatalogItem[]
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

export async function getClaimHistory(
  supabase: SupabaseClient,
  claimId: string
): Promise<ClaimHistoryEntry[]> {
  const { data, error } = await supabase
    .from('approval_history')
    .select(
      'id, claim_id, approver_email, approval_level, action, notes, rejection_notes, allow_resubmit, bypass_reason, skipped_levels, reason, acted_at'
    )
    .eq('claim_id', claimId)
    .order('acted_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ClaimHistoryEntry[]
}
