import type { SupabaseClient } from '@supabase/supabase-js'

import type { Claim } from '@/features/claims/types'
import { getClaimAvailableActions } from '@/features/claims/queries'
import type { Employee } from '@/features/employees/types'
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

const CLAIM_COLUMNS =
  'id, claim_number, employee_id, claim_date, work_location, own_vehicle_used, vehicle_type, outstation_location, from_city, to_city, km_travelled, total_amount, status, current_approval_level, submitted_at, created_at, updated_at, tenant_id, resubmission_count, last_rejection_notes, last_rejected_by_email, last_rejected_at'

const DEFAULT_FINANCE_FILTERS: FinanceFilters = {
  employeeName: null,
  claimNumber: null,
  ownerDesignation: null,
  hodApproverEmail: null,
  claimStatus: null,
  workLocation: null,
  resubmittedOnly: false,
  actionFilter: 'all',
  claimDateFrom: null,
  claimDateTo: null,
  actionDateFrom: null,
  actionDateTo: null,
}

export { getFinanceFilterOptions }

export async function getFinanceQueuePaginated(
  supabase: SupabaseClient,
  cursor: string | null,
  limit = 10,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<PaginatedFinanceQueue> {
  const filteredClaimIds = await getFilteredClaimIdsForFinance(
    supabase,
    filters,
    {
      requiredStatus: 'finance_review',
    }
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
    .select(`${CLAIM_COLUMNS}, employees!inner(*)`)
    .eq('status', 'finance_review')
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
    Claim & { employees: Employee | Employee[] }
  >
  const hasNextPage = rows.length > limit
  const pageData = hasNextPage ? rows.slice(0, limit) : rows

  const mappedData = await Promise.all(
    pageData.map(async (row) => {
      const owner = Array.isArray(row.employees)
        ? row.employees[0]
        : row.employees

      if (!owner) {
        throw new Error('Claim owner mapping not found.')
      }

      const availableActions = await getClaimAvailableActions(supabase, row.id)

      return {
        claim: row,
        owner,
        availableActions,
      }
    })
  )

  const lastRecord = pageData.at(-1)
  const nextCursor =
    hasNextPage && lastRecord
      ? encodeCursor({
          created_at: lastRecord.created_at,
          id: lastRecord.id,
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
    .select('id, claim_id, actor_email, action, notes, acted_at')
    .in('action', ['issued', 'finance_rejected'])
    .order('acted_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (filters.actionFilter !== 'all') {
    query = query.eq('action', filters.actionFilter)
  }

  const actionDateFrom = toIstDayStart(filters.actionDateFrom)
  if (actionDateFrom) {
    query = query.gte('acted_at', actionDateFrom)
  }

  const actionDateTo = toIstDayEnd(filters.actionDateTo)
  if (actionDateTo) {
    query = query.lte('acted_at', actionDateTo)
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

  const actionRows = (data ?? []) as Array<{
    id: string
    claim_id: string
    actor_email: string
    action: 'issued' | 'finance_rejected'
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
  const uniqueActorEmails = [...new Set(pageData.map((row) => row.actor_email))]

  const [claimResult, actorResult] = await Promise.all([
    supabase
      .from('expense_claims')
      .select(`${CLAIM_COLUMNS}, employees!inner(*)`)
      .in('id', claimIds),
    supabase
      .from('employees')
      .select('employee_email, employee_name')
      .in('employee_email', uniqueActorEmails),
  ])

  if (claimResult.error) {
    throw new Error(claimResult.error.message)
  }

  const claimData = claimResult.data

  const actorNameByEmail = new Map<string, string>(
    (actorResult.data ?? []).map((e) => [
      e.employee_email.toLowerCase(),
      e.employee_name,
    ])
  )

  const claimMap = new Map<string, { claim: Claim; owner: Employee }>()
  for (const row of (claimData ?? []) as Array<
    Claim & { employees: Employee | Employee[] }
  >) {
    const owner = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees
    if (!owner) {
      continue
    }

    const claimFields = { ...row } as Claim & {
      employees?: Employee | Employee[]
    }
    delete claimFields.employees

    claimMap.set(row.id, {
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

      return {
        claim: claim.claim,
        owner: claim.owner,
        action: {
          ...action,
          actor_name:
            actorNameByEmail.get(action.actor_email?.toLowerCase() ?? '') ??
            null,
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
