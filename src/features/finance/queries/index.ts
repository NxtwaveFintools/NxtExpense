import type { SupabaseClient } from '@supabase/supabase-js'

import type { Claim } from '@/features/claims/types'
import {
  getClaimAvailableActionsByClaimIds,
  CLAIM_COLUMNS,
  mapClaimRow,
} from '@/features/claims/queries'
import type { EmployeeRow } from '@/lib/services/employee-service'
import type {
  FinanceFilters,
  FinanceHistoryItem,
  PaginatedFinanceHistory,
  PaginatedFinanceQueue,
} from '@/features/finance/types'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'
import {
  getFilteredClaimIdsForFinance,
  getFinanceFilterOptions,
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

type FinanceActionTransitionRow = {
  action_code: string
  to_status_id: string
}

function normalizeFinanceHistoryActionCode(
  actionCode: string,
  toStatusId: string,
  paymentIssuedStatusIds: Set<string>
): string {
  if (
    paymentIssuedStatusIds.has(toStatusId) &&
    actionCode.startsWith('finance_')
  ) {
    return actionCode.slice('finance_'.length)
  }

  return actionCode
}

async function getPaymentIssuedHistoryActions(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data: paymentIssuedStatuses, error: paymentIssuedStatusError } =
    await supabase
      .from('claim_statuses')
      .select('id')
      .eq('is_payment_issued', true)
      .eq('is_active', true)

  if (paymentIssuedStatusError) {
    throw new Error(paymentIssuedStatusError.message)
  }

  const paymentIssuedStatusIds = new Set(
    (paymentIssuedStatuses ?? []).map((row) => row.id)
  )

  if (paymentIssuedStatusIds.size === 0) {
    return []
  }

  const { data: transitionRows, error: transitionError } = await supabase
    .from('claim_status_transitions')
    .select('action_code, to_status_id')
    .eq('is_active', true)

  if (transitionError) {
    throw new Error(transitionError.message)
  }

  return [
    ...new Set(
      ((transitionRows ?? []) as FinanceActionTransitionRow[])
        .filter((row) => paymentIssuedStatusIds.has(row.to_status_id))
        .map((row) =>
          normalizeFinanceHistoryActionCode(
            row.action_code,
            row.to_status_id,
            paymentIssuedStatusIds
          )
        )
    ),
  ]
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
    .select(`${CLAIM_COLUMNS}, employees!employee_id!inner(*)`)
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

  const rows = (data ?? []) as Array<
    Record<string, unknown> & { employees: EmployeeRow | EmployeeRow[] }
  >
  const hasNextPage = rows.length > limit
  const pageData = hasNextPage ? rows.slice(0, limit) : rows
  const availableActionsByClaimId = await getClaimAvailableActionsByClaimIds(
    supabase,
    pageData.map((row) => row.id as string)
  )

  const mappedData = pageData.map((row) => {
    const owner = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees

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

  const filterByApprovedDate =
    filters.dateFilterField === 'finance_approved_date' &&
    (filters.dateFrom || filters.dateTo)

  if (filterByApprovedDate) {
    const paymentIssuedActions = await getPaymentIssuedHistoryActions(supabase)

    if (paymentIssuedActions.length === 0) {
      return {
        data: [],
        hasNextPage: false,
        nextCursor: null,
        limit,
      }
    }

    query = query.in('action', paymentIssuedActions)
  } else if (filters.actionFilter) {
    query = query.eq('action', filters.actionFilter)
  }

  if (filterByApprovedDate) {
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

  const { data: claimData, error: claimError } = await supabase
    .from('expense_claims')
    .select(`${CLAIM_COLUMNS}, employees!employee_id!inner(*)`)
    .in('id', claimIds)

  if (claimError) {
    throw new Error(claimError.message)
  }

  const claimMap = new Map<string, { claim: Claim; owner: EmployeeRow }>()
  for (const row of (claimData ?? []) as Array<
    Record<string, unknown> & { employees: EmployeeRow | EmployeeRow[] }
  >) {
    const owner = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees
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
