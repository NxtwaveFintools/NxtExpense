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
import { toIstDayEnd, toIstDayStart } from '@/features/finance/utils/filters'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'

import {
  getFinanceActionCodesForDateFilter,
  isFinanceActionDateFilterField,
} from '@/features/finance/data/repositories/filter-date-resolvers.repository'
import { getFilteredClaimIdsForFinance } from '@/features/finance/data/repositories/finance-filters.repository'
import {
  DEFAULT_FINANCE_FILTERS,
  FINANCE_OWNER_COLUMNS,
  type ExpenseClaimWithOwnerRow,
  normalizeFinanceOwner,
} from '@/features/finance/data/repositories/finance-shared.repository'

const SAFE_IN_BATCH_SIZE = 150

type FinanceHistoryPaginationOptions = {
  maxFilteredClaimIds?: number | null
}

export async function getFinanceHistoryPaginated(
  supabase: SupabaseClient,
  cursor: string | null,
  limit = 10,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS,
  options: FinanceHistoryPaginationOptions = {}
): Promise<PaginatedFinanceHistory> {
  const filteredClaimIds = await getFilteredClaimIdsForFinance(
    supabase,
    filters,
    { maxClaimIds: options.maxFilteredClaimIds }
  )

  if (Array.isArray(filteredClaimIds) && filteredClaimIds.length === 0) {
    return {
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit,
    }
  }

  const actionDateFilterField = isFinanceActionDateFilterField(
    filters.dateFilterField
  )
    ? filters.dateFilterField
    : null

  const filterByFinanceActionDate =
    actionDateFilterField !== null && (filters.dateFrom || filters.dateTo)

  let resolvedDateFilterActions: string[] = []
  if (filterByFinanceActionDate) {
    resolvedDateFilterActions = await getFinanceActionCodesForDateFilter(
      supabase,
      actionDateFilterField
    )

    if (resolvedDateFilterActions.length === 0) {
      return {
        data: [],
        hasNextPage: false,
        nextCursor: null,
        limit,
      }
    }
  }

  const buildHistoryPageQuery = (claimIdBatch: string[] | null) => {
    let q = supabase
      .from('finance_actions')
      .select(
        'id, claim_id, actor_employee_id, action, notes, acted_at, actor:employees!actor_employee_id(employee_email, employee_name)'
      )
      .order('acted_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1)

    if (filterByFinanceActionDate) {
      q = q.in('action', resolvedDateFilterActions)
    } else if (filters.actionFilter) {
      const actionCodes = getFinanceActionCodesForFilter(filters.actionFilter)
      if (actionCodes.length > 1) {
        q = q.in('action', actionCodes)
      } else {
        q = q.eq('action', actionCodes[0])
      }
    }

    if (filterByFinanceActionDate) {
      const dateFrom = toIstDayStart(filters.dateFrom)
      const dateTo = toIstDayEnd(filters.dateTo)
      if (dateFrom) q = q.gte('acted_at', dateFrom)
      if (dateTo) q = q.lte('acted_at', dateTo)
    }

    if (claimIdBatch !== null) {
      q = q.in('claim_id', claimIdBatch)
    }

    if (cursor) {
      const decoded = decodeCursor(cursor)
      q = q.or(
        `acted_at.lt.${decoded.created_at},and(acted_at.eq.${decoded.created_at},id.lt.${decoded.id})`
      )
    }

    return q
  }

  let rawRows: unknown[]

  if (
    Array.isArray(filteredClaimIds) &&
    filteredClaimIds.length > SAFE_IN_BATCH_SIZE
  ) {
    const batches: string[][] = []
    for (let i = 0; i < filteredClaimIds.length; i += SAFE_IN_BATCH_SIZE) {
      batches.push(filteredClaimIds.slice(i, i + SAFE_IN_BATCH_SIZE))
    }
    const results = await Promise.all(
      batches.map((b) => buildHistoryPageQuery(b))
    )
    for (const { error } of results) {
      if (error) throw new Error(error.message)
    }
    const merged = results.flatMap((r) => (r.data ?? []) as unknown[])
    merged.sort((a, b) => {
      const ra = a as { acted_at: string; id: string }
      const rb = b as { acted_at: string; id: string }
      if (ra.acted_at !== rb.acted_at) return rb.acted_at > ra.acted_at ? 1 : -1
      return rb.id > ra.id ? 1 : -1
    })
    rawRows = merged.slice(0, limit + 1)
  } else {
    const { data, error } = await buildHistoryPageQuery(
      Array.isArray(filteredClaimIds) ? filteredClaimIds : null
    )
    if (error) throw new Error(error.message)
    rawRows = (data ?? []) as unknown[]
  }

  const actionRows = rawRows as unknown as Array<{
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
  }>

  const hasNextPage = actionRows.length > limit
  const pageData = hasNextPage ? actionRows.slice(0, limit) : actionRows

  if (pageData.length === 0) {
    return {
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit,
    }
  }

  const claimIds = [...new Set(pageData.map((row) => row.claim_id))]
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

  const history: FinanceHistoryItem[] = pageData
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

  const lastRecord = pageData.at(-1)
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
  const filteredClaimIds = await getFilteredClaimIdsForFinance(
    supabase,
    filters
  )

  if (Array.isArray(filteredClaimIds)) {
    if (filteredClaimIds.length === 0) return 0

    const batches: string[][] = []
    for (let i = 0; i < filteredClaimIds.length; i += SAFE_IN_BATCH_SIZE) {
      batches.push(filteredClaimIds.slice(i, i + SAFE_IN_BATCH_SIZE))
    }
    const results = await Promise.all(
      batches.map((b) =>
        supabase
          .from('finance_actions')
          .select('id', { count: 'exact', head: true })
          .in('claim_id', b)
      )
    )
    let total = 0
    for (const { count, error } of results) {
      if (error) throw new Error(error.message)
      total += count ?? 0
    }
    return total
  }

  const { count, error } = await supabase
    .from('finance_actions')
    .select('id', { count: 'exact', head: true })

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}
