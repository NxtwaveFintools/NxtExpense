import type { SupabaseClient } from '@supabase/supabase-js'

import type { Claim } from '@/features/claims/types'
import {
  getClaimAvailableActionsByClaimIds,
  CLAIM_COLUMNS,
  mapClaimRow,
} from '@/features/claims/queries'
import type {
  FinanceFilters,
  FinanceHistoryItem,
  FinanceOwner,
  PaginatedFinanceHistory,
  PaginatedFinanceQueue,
} from '@/features/finance/types'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'
import {
  getFinanceActionCodesForDateFilter,
  getFilteredClaimIdsForFinance,
  getFinanceFilterOptions,
  isFinanceActionDateFilterField,
} from '@/features/finance/queries/filters'
import { toIstDayEnd, toIstDayStart } from '@/features/finance/utils/filters'

const DEFAULT_FINANCE_FILTERS: FinanceFilters = {
  employeeName: null,
  claimNumber: null,
  ownerDesignation: null,
  hodApproverEmployeeId: null,
  claimStatus: null,
  workLocation: null,
  actionFilter: null,
  dateFilterField: 'claim_date',
  dateFrom: null,
  dateTo: null,
}

const FINANCE_OWNER_COLUMNS =
  'id, employee_id, employee_name, employee_email, designation_id, designations!designation_id(designation_name)'

type FinanceOwnerRelationRow = Omit<FinanceOwner, 'designations'> & {
  designations:
    | FinanceOwner['designations']
    | Array<NonNullable<FinanceOwner['designations']>>
}

type ExpenseClaimWithOwnerRow = Record<string, unknown> & {
  employees: FinanceOwnerRelationRow | FinanceOwnerRelationRow[]
}

function normalizeFinanceOwner(owner: FinanceOwnerRelationRow): FinanceOwner {
  const designation = Array.isArray(owner.designations)
    ? (owner.designations[0] ?? null)
    : (owner.designations ?? null)

  return {
    ...owner,
    designations: designation,
  }
}

export { getFinanceFilterOptions }

export async function getFinanceQueuePaginated(
  supabase: SupabaseClient,
  cursor: string | null,
  limit = 10,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<PaginatedFinanceQueue> {
  // Resolve finance-review status UUID from DB by semantic properties—
  // no hardcoded status code strings anywhere in this function.
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

export async function getFinanceHistoryPaginated(
  supabase: SupabaseClient,
  cursor: string | null,
  limit = 10,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<PaginatedFinanceHistory> {
  const filteredClaimIds = await getFilteredClaimIdsForFinance(
    supabase,
    filters
  )

  if (Array.isArray(filteredClaimIds) && filteredClaimIds.length === 0) {
    return {
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit,
    }
  }

  // All Finance team members have equal access — no filter by actor email.
  // The finance_actions RLS policy already restricts rows to Finance designation.
  let query = supabase
    .from('finance_actions')
    .select(
      'id, claim_id, actor_employee_id, action, notes, acted_at, actor:employees!actor_employee_id(employee_email, employee_name)'
    )
    .order('acted_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  const actionDateFilterField = isFinanceActionDateFilterField(
    filters.dateFilterField
  )
    ? filters.dateFilterField
    : null

  const filterByFinanceActionDate =
    actionDateFilterField !== null && (filters.dateFrom || filters.dateTo)

  if (filterByFinanceActionDate) {
    const dateFilterActions = await getFinanceActionCodesForDateFilter(
      supabase,
      actionDateFilterField
    )

    if (dateFilterActions.length === 0) {
      return {
        data: [],
        hasNextPage: false,
        nextCursor: null,
        limit,
      }
    }

    query = query.in('action', dateFilterActions)
  } else if (filters.actionFilter) {
    query = query.eq('action', filters.actionFilter)
  }

  if (filterByFinanceActionDate) {
    const dateFrom = toIstDayStart(filters.dateFrom)
    const dateTo = toIstDayEnd(filters.dateTo)

    if (dateFrom) {
      query = query.gte('acted_at', dateFrom)
    }

    if (dateTo) {
      query = query.lte('acted_at', dateTo)
    }
  }

  if (Array.isArray(filteredClaimIds)) {
    query = query.in('claim_id', filteredClaimIds)
  }

  if (cursor) {
    const decoded = decodeCursor(cursor)
    query = query.or(
      `acted_at.lt.${decoded.created_at},and(acted_at.eq.${decoded.created_at},id.lt.${decoded.id})`
    )
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  const actionRows = (data ?? []) as unknown as Array<{
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

  if (Array.isArray(filteredClaimIds) && filteredClaimIds.length === 0) {
    return 0
  }

  const actionDateFilterField = isFinanceActionDateFilterField(
    filters.dateFilterField
  )
    ? filters.dateFilterField
    : null

  const filterByFinanceActionDate =
    actionDateFilterField !== null && (filters.dateFrom || filters.dateTo)

  let query = supabase
    .from('finance_actions')
    .select('id', { count: 'exact', head: true })

  if (filterByFinanceActionDate) {
    const dateFilterActions = await getFinanceActionCodesForDateFilter(
      supabase,
      actionDateFilterField
    )

    if (dateFilterActions.length === 0) {
      return 0
    }

    query = query.in('action', dateFilterActions)

    const dateFrom = toIstDayStart(filters.dateFrom)
    const dateTo = toIstDayEnd(filters.dateTo)

    if (dateFrom) {
      query = query.gte('acted_at', dateFrom)
    }

    if (dateTo) {
      query = query.lte('acted_at', dateTo)
    }
  } else if (filters.actionFilter) {
    query = query.eq('action', filters.actionFilter)
  }

  if (Array.isArray(filteredClaimIds)) {
    query = query.in('claim_id', filteredClaimIds)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

export async function getAllFilteredFinanceHistory(
  supabase: SupabaseClient,
  filters: FinanceFilters,
  batchSize = 200
): Promise<FinanceHistoryItem[]> {
  const allRows: FinanceHistoryItem[] = []
  let cursor: string | null = null

  for (;;) {
    const page = await getFinanceHistoryPaginated(
      supabase,
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
