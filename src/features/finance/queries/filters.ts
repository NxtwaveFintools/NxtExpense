import type { SupabaseClient } from '@supabase/supabase-js'

import type { FinanceFilters } from '@/features/finance/types'
import {
  hasFinanceClaimFilters,
  toIstDayEnd,
  toIstDayStart,
} from '@/features/finance/utils/filters'
import { parseClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'
import { resolveClaimAllowResubmitFilterValue } from '@/lib/services/claim-status-filter-service'
import {
  isFinanceActionDateFilterField,
  getDateFilterTargetStatusIds,
  getFinanceActionCodesForDateFilter,
} from './filter-date-resolvers'

// Re-export submodules for consumers that import from this path
export { isFinanceActionDateFilterField } from './filter-date-resolvers'

type ClaimFilterScope = {
  /** Pre-fetched UUID of the status that results must be constrained to. */
  requiredStatusId?: string
}

type CursorRow = {
  id: string
  created_at: string
}

type ActionCursorRow = {
  id: string
  acted_at: string
  claim_id: string
}

const FILTER_BATCH_SIZE = 500
const MAX_FILTERED_CLAIM_IDS = 10_000

function toLikePattern(value: string): string {
  const escaped = value.replaceAll('%', '\\%').replaceAll('_', '\\_')
  return `%${escaped}%`
}

function assertClaimIdLimit(size: number) {
  if (size > MAX_FILTERED_CLAIM_IDS) {
    throw new Error(
      `Filter result too large (${size}). Please narrow filters to under ${MAX_FILTERED_CLAIM_IDS} claims.`
    )
  }
}

async function collectActionClaimIds(
  supabase: SupabaseClient,
  actions: string[],
  dateFrom: string | null,
  dateTo: string | null
): Promise<string[]> {
  const claimIds = new Set<string>()
  let cursor: { acted_at: string; id: string } | null = null

  for (;;) {
    let query = supabase
      .from('finance_actions')
      .select('id, acted_at, claim_id')
      .in('action', actions)
      .order('acted_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(FILTER_BATCH_SIZE)

    if (dateFrom) {
      query = query.gte('acted_at', dateFrom)
    }

    if (dateTo) {
      query = query.lte('acted_at', dateTo)
    }

    if (cursor) {
      query = query.or(
        `acted_at.lt.${cursor.acted_at},and(acted_at.eq.${cursor.acted_at},id.lt.${cursor.id})`
      )
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data ?? []) as ActionCursorRow[]

    for (const row of rows) {
      if (row.claim_id) {
        claimIds.add(row.claim_id)
      }
    }

    assertClaimIdLimit(claimIds.size)

    if (rows.length < FILTER_BATCH_SIZE) {
      break
    }

    const last = rows[rows.length - 1]
    cursor = { acted_at: last.acted_at, id: last.id }
  }

  return [...claimIds]
}

async function collectHodClaimIds(
  supabase: SupabaseClient,
  approverEmployeeId: string,
  financeReviewStatusId: string
): Promise<string[]> {
  const claimIds = new Set<string>()
  let cursor: { acted_at: string; id: string } | null = null

  for (;;) {
    let query = supabase
      .from('approval_history')
      .select('id, acted_at, claim_id')
      .eq('approver_employee_id', approverEmployeeId)
      .eq('new_status_id', financeReviewStatusId)
      .order('acted_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(FILTER_BATCH_SIZE)

    if (cursor) {
      query = query.or(
        `acted_at.lt.${cursor.acted_at},and(acted_at.eq.${cursor.acted_at},id.lt.${cursor.id})`
      )
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data ?? []) as ActionCursorRow[]

    for (const row of rows) {
      if (row.claim_id) {
        claimIds.add(row.claim_id)
      }
    }

    assertClaimIdLimit(claimIds.size)

    if (rows.length < FILTER_BATCH_SIZE) {
      break
    }

    const last = rows[rows.length - 1]
    cursor = { acted_at: last.acted_at, id: last.id }
  }

  return [...claimIds]
}

export async function getFilteredClaimIdsForFinance(
  supabase: SupabaseClient,
  filters: FinanceFilters,
  scope: ClaimFilterScope = {}
): Promise<string[] | null> {
  if (!hasFinanceClaimFilters(filters)) {
    return null
  }

  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)
  const allowResubmitFilter = await resolveClaimAllowResubmitFilterValue(
    supabase,
    parsedStatusFilter
  )
  const allowResubmitOnlyStatusFilter = allowResubmitFilter === true

  if (scope.requiredStatusId && filters.claimStatus) {
    if (
      !parsedStatusFilter ||
      allowResubmitOnlyStatusFilter ||
      parsedStatusFilter.statusId !== scope.requiredStatusId
    ) {
      return []
    }
  }

  const statusId =
    scope.requiredStatusId ?? parsedStatusFilter?.statusId ?? null

  let dateScopedStatusIds: string[] | null = null
  let financeDateClaimIds: string[] | null = null
  let hodClaimIds: string[] | null = null

  if (
    isFinanceActionDateFilterField(filters.dateFilterField) &&
    (filters.dateFrom || filters.dateTo)
  ) {
    const dateFilterField = filters.dateFilterField

    const dateFilterStatusIds = await getDateFilterTargetStatusIds(
      supabase,
      dateFilterField
    )

    if (dateFilterStatusIds.size === 0) {
      return []
    }

    dateScopedStatusIds = [...dateFilterStatusIds]

    const dateFilterActions = await getFinanceActionCodesForDateFilter(
      supabase,
      dateFilterField,
      dateFilterStatusIds
    )

    if (dateFilterActions.length === 0) {
      return []
    }

    const dateFrom = toIstDayStart(filters.dateFrom)
    const dateTo = toIstDayEnd(filters.dateTo)

    financeDateClaimIds = await collectActionClaimIds(
      supabase,
      dateFilterActions,
      dateFrom,
      dateTo
    )

    if (financeDateClaimIds.length === 0) {
      return []
    }
  }

  if (filters.hodApproverEmployeeId) {
    const { data: financeReviewStatus } = await supabase
      .from('claim_statuses')
      .select('id')
      .eq('approval_level', 3)
      .eq('is_approval', false)
      .eq('is_rejection', false)
      .eq('is_terminal', false)
      .maybeSingle()

    if (!financeReviewStatus) {
      return []
    }

    hodClaimIds = await collectHodClaimIds(
      supabase,
      filters.hodApproverEmployeeId,
      financeReviewStatus.id
    )

    if (hodClaimIds.length === 0) {
      return []
    }
  }

  const claimIds = new Set<string>()
  let cursor: { created_at: string; id: string } | null = null

  for (;;) {
    let query = supabase
      .from('expense_claims')
      .select(
        'id, created_at, employees!employee_id!inner(employee_name, designation_id)'
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(FILTER_BATCH_SIZE)

    if (statusId) {
      query = query.eq('status_id', statusId)
    }

    if (dateScopedStatusIds) {
      query = query.in('status_id', dateScopedStatusIds)
    }

    if (allowResubmitFilter !== null) {
      query = query.eq('allow_resubmit', allowResubmitFilter)
    }

    if (filters.employeeName) {
      query = query.ilike(
        'employees.employee_name',
        toLikePattern(filters.employeeName)
      )
    }

    if (filters.claimNumber) {
      query = query.eq('claim_number', filters.claimNumber)
    }

    if (filters.ownerDesignation) {
      query = query.eq('employees.designation_id', filters.ownerDesignation)
    }

    if (filters.dateFilterField === 'claim_date') {
      if (filters.dateFrom) {
        query = query.gte('claim_date', filters.dateFrom)
      }

      if (filters.dateTo) {
        query = query.lte('claim_date', filters.dateTo)
      }
    }

    if (filters.dateFilterField === 'submitted_at') {
      const submittedDateFrom = toIstDayStart(filters.dateFrom)
      const submittedDateTo = toIstDayEnd(filters.dateTo)

      if (submittedDateFrom) {
        query = query.gte('submitted_at', submittedDateFrom)
      }

      if (submittedDateTo) {
        query = query.lte('submitted_at', submittedDateTo)
      }
    }

    if (filters.workLocation) {
      query = query.eq('work_location_id', filters.workLocation)
    }

    if (financeDateClaimIds) {
      query = query.in('id', financeDateClaimIds)
    }

    if (hodClaimIds) {
      query = query.in('id', hodClaimIds)
    }

    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
      )
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data ?? []) as CursorRow[]

    for (const row of rows) {
      if (row.id) {
        claimIds.add(row.id)
      }
    }

    assertClaimIdLimit(claimIds.size)

    if (rows.length < FILTER_BATCH_SIZE) {
      break
    }

    const last = rows[rows.length - 1]
    cursor = { created_at: last.created_at, id: last.id }
  }

  return [...claimIds]
}
