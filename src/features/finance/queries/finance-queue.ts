import type { SupabaseClient } from '@supabase/supabase-js'

import type { Claim } from '@/features/claims/types'
import {
  getClaimAvailableActionsByClaimIds,
  CLAIM_COLUMNS,
  mapClaimRow,
} from '@/features/claims/queries'
import type {
  FinanceFilters,
  PaginatedFinanceQueue,
} from '@/features/finance/types'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'
import { getFilteredClaimIdsForFinance } from './filters'
import {
  DEFAULT_FINANCE_FILTERS,
  FINANCE_OWNER_COLUMNS,
  type ExpenseClaimWithOwnerRow,
  normalizeFinanceOwner,
} from './finance-shared'

export async function getFinanceQueuePaginated(
  supabase: SupabaseClient,
  cursor: string | null,
  limit = 10,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<PaginatedFinanceQueue> {
  const { data: financeStatusRow } = await supabase
    .from('claim_statuses')
    .select('id')
    .eq('approval_level', 3)
    .eq('is_rejection', false)
    .eq('is_terminal', false)
    .eq('is_approval', false)
    .eq('is_active', true)
    .maybeSingle()

  if (!financeStatusRow) {
    return { data: [], hasNextPage: false, nextCursor: null, limit }
  }

  const filteredClaimIds = await getFilteredClaimIdsForFinance(
    supabase,
    filters,
    { requiredStatusId: financeStatusRow.id }
  )

  if (Array.isArray(filteredClaimIds) && filteredClaimIds.length === 0) {
    return {
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit,
    }
  }

  let query = supabase
    .from('expense_claims')
    .select(
      `${CLAIM_COLUMNS}, employees!employee_id!inner(${FINANCE_OWNER_COLUMNS})`
    )
    .eq('status_id', financeStatusRow.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (Array.isArray(filteredClaimIds)) {
    query = query.in('id', filteredClaimIds)
  }

  if (cursor) {
    const decoded = decodeCursor(cursor)
    query = query.or(
      `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
    )
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Array<ExpenseClaimWithOwnerRow>
  const hasNextPage = rows.length > limit
  const pageData = hasNextPage ? rows.slice(0, limit) : rows
  const availableActionsByClaimId = await getClaimAvailableActionsByClaimIds(
    supabase,
    pageData.map((row) => row.id as string)
  )

  const mappedData = pageData.map((row) => {
    const ownerRelation = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees

    const owner = ownerRelation ? normalizeFinanceOwner(ownerRelation) : null

    if (!owner) {
      throw new Error('Claim owner mapping not found.')
    }

    const claimId = row.id as string

    return {
      claim: mapClaimRow(row) as Claim,
      owner,
      availableActions: availableActionsByClaimId.get(claimId) ?? [],
    }
  })

  const lastRecord = pageData.at(-1)
  const nextCursor =
    hasNextPage && lastRecord
      ? encodeCursor({
          created_at: lastRecord.created_at as string,
          id: lastRecord.id as string,
        })
      : null

  return {
    data: mappedData,
    hasNextPage,
    nextCursor,
    limit,
  }
}

export async function getFinanceQueueTotalCount(
  supabase: SupabaseClient,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<number> {
  const { data: financeStatusRow } = await supabase
    .from('claim_statuses')
    .select('id')
    .eq('approval_level', 3)
    .eq('is_rejection', false)
    .eq('is_terminal', false)
    .eq('is_approval', false)
    .eq('is_active', true)
    .maybeSingle()

  if (!financeStatusRow) {
    return 0
  }

  const filteredClaimIds = await getFilteredClaimIdsForFinance(
    supabase,
    filters,
    { requiredStatusId: financeStatusRow.id }
  )

  if (Array.isArray(filteredClaimIds) && filteredClaimIds.length === 0) {
    return 0
  }

  let query = supabase
    .from('expense_claims')
    .select('id', { count: 'exact', head: true })
    .eq('status_id', financeStatusRow.id)

  if (Array.isArray(filteredClaimIds)) {
    query = query.in('id', filteredClaimIds)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}
