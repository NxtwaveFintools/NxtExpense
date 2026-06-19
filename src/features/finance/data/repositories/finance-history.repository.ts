import type { SupabaseClient } from '@supabase/supabase-js'

import type { Claim } from '@/features/claims/types'
import {
  CLAIM_COLUMNS,
  getClaimAvailableActionsByClaimIds,
  mapClaimRow,
} from '@/features/claims/data/queries'
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

import {
  getFinanceActionCodesForDateFilter,
  isFinanceActionDateFilterField,
} from '@/features/finance/data/repositories/filter-date-resolvers.repository'
import {
  DEFAULT_FINANCE_FILTERS,
  FINANCE_OWNER_COLUMNS,
  type ExpenseClaimWithOwnerRow,
  normalizeFinanceOwner,
} from '@/features/finance/data/repositories/finance-shared.repository'
import { getFinancePaymentJournalTotalsRpc } from '@/features/finance/data/rpc/finance-export.rpc'

type ActionRow = {
  id: string
  claim_id: string
  actor_employee_id: string
  actor:
    | { employee_email: string; employee_name: string }
    | { employee_email: string; employee_name: string }[]
    | null
  action: string
  notes: string | null
  acted_at: string
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

  // SQL keyset ID-page: filtering + pagination happen in Postgres. At most
  // limit + 1 finance_actions ids ever return to Node.
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

  const idRows = (pageRows ?? []) as Array<{
    id: string
    claim_id: string
    acted_at: string
  }>
  const hasNextPage = idRows.length > limit
  const pageRowsBounded = hasNextPage ? idRows.slice(0, limit) : idRows
  const actionIds = pageRowsBounded.map((row) => row.id)

  if (actionIds.length === 0) {
    return { data: [], hasNextPage: false, nextCursor: null, limit }
  }

  // Bounded fetch of the action rows (<= limit) with the actor embed.
  const { data: actionRowsData, error: actionError } = await supabase
    .from('finance_actions')
    .select(
      'id, claim_id, actor_employee_id, action, notes, acted_at, actor:employees!actor_employee_id(employee_email, employee_name)'
    )
    .in('id', actionIds)

  if (actionError) {
    throw new Error(actionError.message)
  }

  const actionRowById = new Map(
    ((actionRowsData ?? []) as ActionRow[]).map((row) => [row.id, row])
  )

  // Preserve the keyset order from the page RPC (.in does not guarantee order).
  const orderedActions = actionIds
    .map((id) => actionRowById.get(id))
    .filter((row): row is ActionRow => row !== undefined)

  const claimIds = [...new Set(orderedActions.map((row) => row.claim_id))]

  const availableActionsByClaimId = await getClaimAvailableActionsByClaimIds(
    supabase,
    claimIds
  )

  const { data: claimData, error: claimError } = await supabase
    .from('expense_claims')
    .select(
      `${CLAIM_COLUMNS}, employees!employee_id!inner(${FINANCE_OWNER_COLUMNS})`
    )
    .in('id', claimIds)

  if (claimError) {
    throw new Error(claimError.message)
  }

  const claimMap = new Map<string, { claim: Claim; owner: FinanceOwner }>()
  for (const row of (claimData ?? []) as Array<ExpenseClaimWithOwnerRow>) {
    const ownerRelation = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees

    const owner = ownerRelation ? normalizeFinanceOwner(ownerRelation) : null

    if (!owner) {
      continue
    }

    const mapped = mapClaimRow(row)
    const claimFields = { ...mapped } as Record<string, unknown>
    delete claimFields.employees

    claimMap.set(row.id as string, {
      claim: claimFields as Claim,
      owner,
    })
  }

  const history: FinanceHistoryItem[] = orderedActions
    .map((action) => {
      const claim = claimMap.get(action.claim_id)
      if (!claim) {
        return null
      }

      const actorRaw = action.actor
      const actor = Array.isArray(actorRaw) ? actorRaw[0] : actorRaw

      return {
        claim: claim.claim,
        owner: claim.owner,
        availableActions: availableActionsByClaimId.get(action.claim_id) ?? [],
        action: {
          id: action.id,
          claim_id: action.claim_id,
          actor_email: actor?.employee_email ?? '',
          actor_name: actor?.employee_name ?? null,
          action: action.action,
          notes: action.notes,
          acted_at: action.acted_at,
        },
      }
    })
    .filter((row): row is FinanceHistoryItem => row !== null)

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
