import type { SupabaseClient } from '@supabase/supabase-js'

import type { Claim } from '@/features/claims/types'
import { getClaimAvailableActionsByClaimIds } from '@/features/claims/data/queries'
import type {
  FinanceFilters,
  FinanceHistoryItem,
  FinanceOwner,
  PaginatedFinanceHistory,
} from '@/features/finance/types'
import { getFinanceActionCodesForFilter } from '@/features/finance/utils/action-filter'
import {
  hasFinanceClaimFilters,
  toIstDayEnd,
  toIstDayStart,
} from '@/features/finance/utils/filters'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'
import { getClaimStatusDisplay } from '@/lib/utils/claim-status'

import {
  getFinanceActionCodesForDateFilter,
  isFinanceActionDateFilterField,
} from '@/features/finance/data/repositories/filter-date-resolvers.repository'
import { DEFAULT_FINANCE_FILTERS } from '@/features/finance/data/repositories/finance-shared.repository'
import { getFinancePaymentJournalTotalsRpc } from '@/features/finance/data/rpc/finance-export.rpc'

// Raw row shape returned by get_finance_history_page since the Phase-6 rewrite
// (docs/superpowers/plans/2026-07-01-finance-history-single-rpc-hydration.md): one
// fully-hydrated row per page entry, flat columns (not nested jsonb — see that plan's
// review doc for why flat columns were chosen over jsonb mimicking PostgREST embeds).
// Fields sourced from a LEFT-joined relation are typed `| null` regardless of the
// underlying column's own nullability, since the join itself can produce null.
type HydratedHistoryPageRow = {
  id: string
  claim_id: string
  acted_at: string
  action_type: string
  action_notes: string | null
  actor_employee_email: string | null
  actor_employee_name: string | null

  claim_number: string
  claim_employee_id: string
  claim_date: string
  work_location_id: string | null
  work_location_name: string | null
  expense_location_id: string | null
  expense_location_name: string | null
  expense_region_code: string | null
  own_vehicle_used: boolean | null
  vehicle_type_id: string | null
  vehicle_type_name: string | null
  outstation_state_id: string | null
  outstation_city_id: string | null
  from_city_id: string | null
  to_city_id: string | null
  outstation_state_name_snapshot: string | null
  outstation_city_name_snapshot: string | null
  from_city_name_snapshot: string | null
  to_city_name_snapshot: string | null
  km_travelled: number | null
  total_amount: number
  status_id: string
  status_code: string | null
  status_name: string | null
  status_display_color: string | null
  allow_resubmit_status_name: string | null
  allow_resubmit_display_color: string | null
  status_is_terminal: boolean | null
  status_is_rejection: boolean | null
  allow_resubmit: boolean | null
  is_superseded: boolean | null
  current_approval_level: number | null
  submitted_at: string | null
  claim_created_at: string
  claim_updated_at: string
  resubmission_count: number
  last_rejection_notes: string | null
  last_rejected_at: string | null
  accommodation_nights: number | null
  food_with_principals_amount: number | null
  has_intercity_travel: boolean | null
  has_intracity_travel: boolean | null
  intercity_own_vehicle_used: boolean | null
  intracity_own_vehicle_used: boolean | null
  intracity_vehicle_mode: string | null
  base_location_day_type_code: string | null

  owner_uuid: string
  owner_employee_code: string
  owner_employee_name: string
  owner_employee_email: string
  owner_designation_id: string | null
  owner_designation_name: string | null
}

// Maps one hydrated RPC row directly to claim/owner/action — no PostgREST embed
// unwrapping needed since the RPC already returns flat columns. Does NOT include
// availableActions: that's computed once per page (batched across all claim ids) by
// the caller, not per-row.
export function mapHydratedHistoryRow(
  row: HydratedHistoryPageRow
): Pick<FinanceHistoryItem, 'claim' | 'owner' | 'action'> {
  const statusDisplay = getClaimStatusDisplay({
    statusCode: row.status_code,
    statusName: row.status_name,
    statusDisplayColor: row.status_display_color,
    allowResubmit: row.allow_resubmit,
    allowResubmitStatusName: row.allow_resubmit_status_name,
    allowResubmitDisplayColor: row.allow_resubmit_display_color,
  })

  const claim: Claim = {
    id: row.claim_id,
    claim_number: row.claim_number,
    employee_id: row.claim_employee_id,
    claim_date: row.claim_date,
    work_location: row.work_location_name ?? '',
    expense_location_id: row.expense_location_id,
    expense_location_name: row.expense_location_name,
    expense_region_code: row.expense_region_code,
    base_location_day_type_code: row.base_location_day_type_code,
    own_vehicle_used: row.own_vehicle_used,
    vehicle_type: row.vehicle_type_name,
    outstation_state_id: row.outstation_state_id,
    outstation_city_id: row.outstation_city_id,
    from_city_id: row.from_city_id,
    to_city_id: row.to_city_id,
    has_intercity_travel: row.has_intercity_travel ?? false,
    has_intracity_travel: row.has_intracity_travel ?? false,
    intercity_own_vehicle_used: row.intercity_own_vehicle_used ?? null,
    intracity_own_vehicle_used: row.intracity_own_vehicle_used ?? null,
    intracity_vehicle_mode:
      row.intracity_vehicle_mode as Claim['intracity_vehicle_mode'],
    outstation_state_name: row.outstation_state_name_snapshot,
    outstation_city_name: row.outstation_city_name_snapshot,
    from_city_name: row.from_city_name_snapshot,
    to_city_name: row.to_city_name_snapshot,
    km_travelled: row.km_travelled,
    total_amount: row.total_amount,
    statusName: statusDisplay.label,
    statusDisplayColor: statusDisplay.colorToken,
    status_id: row.status_id,
    is_terminal: row.status_is_terminal ?? false,
    is_rejection: row.status_is_rejection ?? false,
    allow_resubmit: row.allow_resubmit ?? false,
    is_superseded: row.is_superseded ?? false,
    current_approval_level: row.current_approval_level,
    submitted_at: row.submitted_at,
    created_at: row.claim_created_at,
    updated_at: row.claim_updated_at,
    resubmission_count: row.resubmission_count,
    last_rejection_notes: row.last_rejection_notes,
    last_rejected_at: row.last_rejected_at,
    accommodation_nights: row.accommodation_nights,
    food_with_principals_amount: row.food_with_principals_amount,
  }

  const owner: FinanceOwner = {
    id: row.owner_uuid,
    employee_id: row.owner_employee_code,
    employee_name: row.owner_employee_name,
    employee_email: row.owner_employee_email,
    designation_id: row.owner_designation_id,
    designations: row.owner_designation_name
      ? { designation_name: row.owner_designation_name }
      : null,
  }

  return {
    claim,
    owner,
    action: {
      id: row.id,
      claim_id: row.claim_id,
      actor_email: row.actor_employee_email ?? '',
      actor_name: row.actor_employee_name ?? null,
      action: row.action_type,
      notes: row.action_notes,
      acted_at: row.acted_at,
    },
  }
}

// Date fields whose bounds the resolver expects as IST day-boundary timestamptz
// (claim_date is compared as a plain date). Mirrors finance-resolver-parity's
// usesIstBoundary.
function usesIstBoundary(field: FinanceFilters['dateFilterField']): boolean {
  return (
    field === 'payment_released_date' ||
    field === 'finance_approved_date' ||
    field === 'submitted_at' ||
    field === 'hod_approved_date'
  )
}

function buildHistoryResolverArgs(
  filters: FinanceFilters
): Record<string, unknown> {
  const useIst = usesIstBoundary(filters.dateFilterField)
  return {
    p_employee_id: filters.employeeId,
    p_employee_name: filters.employeeName,
    p_claim_number: filters.claimNumber,
    p_owner_designation: filters.ownerDesignation,
    p_hod_approver_emp: filters.hodApproverEmployeeId,
    p_claim_status: filters.claimStatus,
    p_work_location: filters.workLocation,
    p_action_filter: filters.actionFilter,
    p_date_field: filters.dateFilterField,
    p_date_from: useIst ? toIstDayStart(filters.dateFrom) : filters.dateFrom,
    p_date_to: useIst ? toIstDayEnd(filters.dateTo) : filters.dateTo,
  }
}

// Feed-row scope shared by every reader of the Approved History feed (the paginated
// list and the payment-journals export). Computes the bounded feed-row action filter
// exactly as the legacy path did: action-date filters resolve to their action codes;
// otherwise an explicit actionFilter expands to its codes. This is independent of
// hasFinanceClaimFilters so a plain actionFilter still scopes the feed rows even when
// the resolver is skipped. `isEmpty` flags an action-date filter that resolved to zero
// action codes (the feed is then empty without touching the DB further).
type FinanceHistoryFeedScope = {
  pHasFilters: boolean
  resolverArgs: Record<string, unknown>
  feedActionCodes: string[] | null
  feedFrom: string | null
  feedTo: string | null
  isEmpty: boolean
}

async function buildFinanceHistoryFeedScope(
  supabase: SupabaseClient,
  filters: FinanceFilters
): Promise<FinanceHistoryFeedScope> {
  const actionDateFilterField = isFinanceActionDateFilterField(
    filters.dateFilterField
  )
    ? filters.dateFilterField
    : null

  const filterByFinanceActionDate =
    actionDateFilterField !== null &&
    Boolean(filters.dateFrom || filters.dateTo)

  const baseScope = {
    pHasFilters: hasFinanceClaimFilters(filters),
    resolverArgs: buildHistoryResolverArgs(filters),
  }

  let feedActionCodes: string[] | null = null
  if (filterByFinanceActionDate) {
    const resolvedDateFilterActions = await getFinanceActionCodesForDateFilter(
      supabase,
      actionDateFilterField
    )
    if (resolvedDateFilterActions.length === 0) {
      return {
        ...baseScope,
        feedActionCodes: null,
        feedFrom: null,
        feedTo: null,
        isEmpty: true,
      }
    }
    feedActionCodes = resolvedDateFilterActions
  } else if (filters.actionFilter) {
    feedActionCodes = getFinanceActionCodesForFilter(filters.actionFilter)
  }

  return {
    ...baseScope,
    feedActionCodes,
    feedFrom: filterByFinanceActionDate
      ? toIstDayStart(filters.dateFrom)
      : null,
    feedTo: filterByFinanceActionDate ? toIstDayEnd(filters.dateTo) : null,
    isEmpty: false,
  }
}

export async function getFinanceHistoryPaginated(
  supabase: SupabaseClient,
  cursor: string | null,
  limit = 10,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<PaginatedFinanceHistory> {
  const scope = await buildFinanceHistoryFeedScope(supabase, filters)

  if (scope.isEmpty) {
    return { data: [], hasNextPage: false, nextCursor: null, limit }
  }

  // SQL keyset ID-page + enrichment JOIN in one RPC call (Phase 6 — see
  // docs/superpowers/plans/2026-07-01-finance-history-single-rpc-hydration.md).
  // At most limit + 1 fully-hydrated rows ever return to Node; no follow-up
  // .in('id', ...) fetch is needed (that was the URL-length bug's root cause).
  const decoded = cursor ? decodeCursor(cursor) : null
  const { data: pageRows, error: pageError } = await supabase.rpc(
    'get_finance_history_page',
    {
      p_has_filters: scope.pHasFilters,
      ...scope.resolverArgs,
      p_feed_action_codes: scope.feedActionCodes,
      p_feed_from: scope.feedFrom,
      p_feed_to: scope.feedTo,
      // The existing cursor encodes acted_at under the created_at key.
      p_cursor_acted_at: decoded?.created_at ?? null,
      p_cursor_id: decoded?.id ?? null,
      p_limit: limit,
    }
  )

  if (pageError) {
    throw new Error(pageError.message)
  }

  const idRows = (pageRows ?? []) as HydratedHistoryPageRow[]
  const hasNextPage = idRows.length > limit
  const pageRowsBounded = hasNextPage ? idRows.slice(0, limit) : idRows

  if (pageRowsBounded.length === 0) {
    return { data: [], hasNextPage: false, nextCursor: null, limit }
  }

  const claimIds = [...new Set(pageRowsBounded.map((row) => row.claim_id))]

  const availableActionsByClaimId = await getClaimAvailableActionsByClaimIds(
    supabase,
    claimIds
  )

  const history: FinanceHistoryItem[] = pageRowsBounded.map((row) => {
    const { claim, owner, action } = mapHydratedHistoryRow(row)
    return {
      claim,
      owner,
      action,
      availableActions: availableActionsByClaimId.get(row.claim_id) ?? [],
    }
  })

  const lastRecord = pageRowsBounded.at(-1)
  const nextCursor =
    hasNextPage && lastRecord
      ? encodeCursor({
          created_at: lastRecord.acted_at,
          id: lastRecord.id,
        })
      : null

  return {
    data: history,
    hasNextPage,
    nextCursor,
    limit,
  }
}

export async function getFinanceHistoryTotalCount(
  supabase: SupabaseClient,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<number> {
  const { data, error } = await supabase.rpc('get_finance_history_count', {
    p_has_filters: hasFinanceClaimFilters(filters),
    ...buildHistoryResolverArgs(filters),
  })

  if (error) {
    throw new Error(error.message)
  }

  return Number(data ?? 0)
}

// Per-employee payment-journal totals for the export. Aggregation happens entirely in
// Postgres (get_finance_payment_journal_totals) over the SAME feed scope the Approved
// History list uses, so the export totals match the on-screen feed. The returned Map is
// bounded by employee count — no claim-ID collection is materialized in Node.
export async function getFinancePaymentJournalTotals(
  supabase: SupabaseClient,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<Map<string, number>> {
  const scope = await buildFinanceHistoryFeedScope(supabase, filters)

  if (scope.isEmpty) {
    return new Map<string, number>()
  }

  const rows = await getFinancePaymentJournalTotalsRpc(supabase, {
    p_has_filters: scope.pHasFilters,
    ...scope.resolverArgs,
    p_feed_action_codes: scope.feedActionCodes,
    p_feed_from: scope.feedFrom,
    p_feed_to: scope.feedTo,
  })

  return new Map(rows.map((row) => [row.employee_id, Number(row.total_amount)]))
}
