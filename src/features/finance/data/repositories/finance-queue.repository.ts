import type { SupabaseClient } from '@supabase/supabase-js'

import type { Claim } from '@/features/claims/types'
import {
  CLAIM_COLUMNS,
  getClaimAvailableActionsByClaimIds,
  mapClaimRow,
} from '@/features/claims/data/queries'
import type {
  FinanceFilters,
  PaginatedFinanceQueue,
} from '@/features/finance/types'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'

import { getFilteredClaimIdsForFinance } from '@/features/finance/data/repositories/finance-filters.repository'
import {
  DEFAULT_FINANCE_FILTERS,
  FINANCE_OWNER_COLUMNS,
  type ExpenseClaimWithOwnerRow,
  normalizeFinanceOwner,
} from '@/features/finance/data/repositories/finance-shared.repository'

const SAFE_IN_BATCH_SIZE = 150

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

  const buildQueuePageQuery = (batchIds: string[] | null) => {
    let q = supabase
      .from('expense_claims')
      .select(
        `${CLAIM_COLUMNS}, employees!employee_id!inner(${FINANCE_OWNER_COLUMNS})`
      )
      .eq('status_id', financeStatusRow.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1)

    if (batchIds !== null) {
      q = q.in('id', batchIds)
    }

    if (cursor) {
      const decoded = decodeCursor(cursor)
      q = q.or(
        `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
      )
    }

    return q
  }

  let rows: Array<ExpenseClaimWithOwnerRow>

  if (
    Array.isArray(filteredClaimIds) &&
    filteredClaimIds.length > SAFE_IN_BATCH_SIZE
  ) {
    const batches: string[][] = []
    for (let i = 0; i < filteredClaimIds.length; i += SAFE_IN_BATCH_SIZE) {
      batches.push(filteredClaimIds.slice(i, i + SAFE_IN_BATCH_SIZE))
    }
    const results = await Promise.all(
      batches.map((b) => buildQueuePageQuery(b))
    )
    for (const { error } of results) {
      if (error) throw new Error(error.message)
    }
    const merged = results.flatMap(
      (r) => (r.data ?? []) as Array<ExpenseClaimWithOwnerRow>
    )
    merged.sort((a, b) => {
      const ca = a.created_at as string
      const cb = b.created_at as string
      if (ca !== cb) return cb > ca ? 1 : -1
      return (b.id as string) > (a.id as string) ? 1 : -1
    })
    rows = merged.slice(0, limit + 1)
  } else {
    const { data, error } = await buildQueuePageQuery(
      Array.isArray(filteredClaimIds) ? filteredClaimIds : null
    )
    if (error) throw new Error(error.message)
    rows = (data ?? []) as Array<ExpenseClaimWithOwnerRow>
  }
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

  if (Array.isArray(filteredClaimIds)) {
    return filteredClaimIds.length
  }

  const { count, error } = await supabase
    .from('expense_claims')
    .select('id', { count: 'exact', head: true })
    .eq('status_id', financeStatusRow.id)

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}
