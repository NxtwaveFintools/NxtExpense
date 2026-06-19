import type { SupabaseClient } from '@supabase/supabase-js'

import type { FinanceFilters } from '@/features/finance/types'
import {
  hasFinanceClaimFilters,
  toIstDayEnd,
  toIstDayStart,
} from '@/features/finance/utils/filters'
import { shouldForceAllowResubmitFromActionFilter } from '@/features/finance/utils/action-filter'
import { resolveClaimAllowResubmitFilterValue } from '@/features/claims/data/queries'
import { parseClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'
import {
  getDateFilterTargetStatusIds,
  getFinanceActionCodesForDateFilter,
  isFinanceActionDateFilterField,
} from '@/features/finance/data/repositories/filter-date-resolvers.repository'

export { isFinanceActionDateFilterField } from '@/features/finance/data/repositories/filter-date-resolvers.repository'

type ClaimFilterScope = {
  requiredStatusId?: string
  maxClaimIds?: number | null
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
// Max number of UUIDs to inline into a single `.in('id', [...])` clause. PostgREST
// sends these as GET query params, so a large list makes the request URL exceed the
// gateway URI length limit and the request fails with a generic 400 "Bad Request".
// ~150 UUIDs keeps every URL comfortably under that limit. Matches the batch size
// used by the finance-queue/finance-history repositories for the same reason.
const SAFE_IN_BATCH_SIZE = 150

function toLikePattern(value: string): string {
  const escaped = value.replaceAll('%', '\\%').replaceAll('_', '\\_')
  return `%${escaped}%`
}

function assertClaimIdLimit(size: number, maxClaimIds: number | null) {
  if (maxClaimIds !== null && size > maxClaimIds) {
    throw new Error(
      `Filter result too large (${size}). Please narrow filters to under ${maxClaimIds} claims.`
    )
  }
}

type ClaimIdQueryResult = {
  data: unknown
  error: { message: string } | null
}

/**
 * Runs a claim-id filter query against a bounded set of candidate IDs, splitting
 * the candidates into chunks of {@link SAFE_IN_BATCH_SIZE} so no single request
 * URL grows large enough to be rejected by the gateway with a 400 "Bad Request".
 * Returns the union of matching claim IDs across all chunks.
 */
export async function collectClaimIdsInBatches(
  buildBatchQuery: (batchIds: string[]) => PromiseLike<ClaimIdQueryResult>,
  candidateIds: string[],
  maxClaimIds: number | null
): Promise<string[]> {
  const batches: string[][] = []
  for (let i = 0; i < candidateIds.length; i += SAFE_IN_BATCH_SIZE) {
    batches.push(candidateIds.slice(i, i + SAFE_IN_BATCH_SIZE))
  }

  const results = await Promise.all(
    batches.map((batch) => buildBatchQuery(batch))
  )

  const claimIds = new Set<string>()
  for (const { data, error } of results) {
    if (error) {
      throw new Error(error.message)
    }

    for (const row of (data ?? []) as Array<{ id: string }>) {
      if (row.id) {
        claimIds.add(row.id)
      }
    }
  }

  assertClaimIdLimit(claimIds.size, maxClaimIds)

  return [...claimIds]
}

async function collectActionClaimIds(
  supabase: SupabaseClient,
  actions: string[],
  dateFrom: string | null,
  dateTo: string | null,
  maxClaimIds: number | null
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

    assertClaimIdLimit(claimIds.size, maxClaimIds)

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
  financeReviewStatusId: string,
  maxClaimIds: number | null,
  options: {
    approverEmployeeId?: string | null
    actedAtFrom?: string | null
    actedAtTo?: string | null
  } = {}
): Promise<string[]> {
  const claimIds = new Set<string>()
  let cursor: { acted_at: string; id: string } | null = null

  for (;;) {
    let query = supabase
      .from('approval_history')
      .select('id, acted_at, claim_id')
      .eq('new_status_id', financeReviewStatusId)
      .order('acted_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(FILTER_BATCH_SIZE)

    if (options.approverEmployeeId) {
      query = query.eq('approver_employee_id', options.approverEmployeeId)
    }

    if (options.actedAtFrom) {
      query = query.gte('acted_at', options.actedAtFrom)
    }

    if (options.actedAtTo) {
      query = query.lte('acted_at', options.actedAtTo)
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

    assertClaimIdLimit(claimIds.size, maxClaimIds)

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
  const maxClaimIds =
    scope.maxClaimIds === undefined ? MAX_FILTERED_CLAIM_IDS : scope.maxClaimIds

  if (!hasFinanceClaimFilters(filters)) {
    return null
  }

  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)
  const allowResubmitFilter = await resolveClaimAllowResubmitFilterValue(
    supabase,
    parsedStatusFilter
  )
  const actionFilterAllowResubmit = shouldForceAllowResubmitFromActionFilter(
    filters.actionFilter
  )

  const effectiveAllowResubmitFilter =
    allowResubmitFilter !== null
      ? allowResubmitFilter
      : actionFilterAllowResubmit

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
  let designationEmployeeIds: string[] | null = null
  const filterByHodApprovedDate =
    filters.dateFilterField === 'hod_approved_date' &&
    (filters.dateFrom || filters.dateTo)

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
      dateTo,
      maxClaimIds
    )

    if (financeDateClaimIds.length === 0) {
      return []
    }
  }

  if (filters.hodApproverEmployeeId || filterByHodApprovedDate) {
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

    const hodApprovedDateFrom = filterByHodApprovedDate
      ? toIstDayStart(filters.dateFrom)
      : null
    const hodApprovedDateTo = filterByHodApprovedDate
      ? toIstDayEnd(filters.dateTo)
      : null

    hodClaimIds = await collectHodClaimIds(
      supabase,
      financeReviewStatus.id,
      maxClaimIds,
      {
        approverEmployeeId: filters.hodApproverEmployeeId,
        actedAtFrom: hodApprovedDateFrom,
        actedAtTo: hodApprovedDateTo,
      }
    )

    if (hodClaimIds.length === 0) {
      return []
    }
  }

  if (filters.ownerDesignation) {
    const { data: empRows, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('designation_id', filters.ownerDesignation)

    if (empError) {
      throw new Error(empError.message)
    }

    designationEmployeeIds = (empRows ?? []).map((e: { id: string }) => e.id)

    if (designationEmployeeIds.length === 0) {
      return []
    }
  }

  const buildClaimQuery = (
    batchIds: string[] | null,
    cursor: { created_at: string; id: string } | null
  ) => {
    let query = supabase
      .from('expense_claims')
      .select(
        'id, created_at, employees!employee_id!inner(employee_id, employee_name)'
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(FILTER_BATCH_SIZE)

    if (statusId) {
      query = query.eq('status_id', statusId)
    }

    if (filters.employeeId) {
      query = query.ilike(
        'employees.employee_id',
        toLikePattern(filters.employeeId)
      )
    }

    if (dateScopedStatusIds) {
      query = query.in('status_id', dateScopedStatusIds)
    }

    if (effectiveAllowResubmitFilter !== null) {
      query = query.eq('allow_resubmit', effectiveAllowResubmitFilter)
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

    if (designationEmployeeIds) {
      query = query.in('employee_id', designationEmployeeIds)
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

    if (batchIds !== null) {
      query = query.in('id', batchIds)
    }

    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
      )
    }

    return query
  }

  // The finance action-date and HOD-approver filters resolve to a bounded set of
  // candidate claim IDs, so the final result can only be a subset of that set.
  // Intersect the candidate sets in memory and fetch in chunks via
  // `collectClaimIdsInBatches`, rather than inlining hundreds of UUIDs into a
  // single `.in('id', [...])` clause (which overflows the request URL -> 400).
  let boundingIds: string[] | null = null
  if (financeDateClaimIds && hodClaimIds) {
    const hodSet = new Set(hodClaimIds)
    boundingIds = financeDateClaimIds.filter((id) => hodSet.has(id))
  } else if (financeDateClaimIds) {
    boundingIds = financeDateClaimIds
  } else if (hodClaimIds) {
    boundingIds = hodClaimIds
  }

  if (boundingIds !== null) {
    if (boundingIds.length === 0) {
      return []
    }

    return collectClaimIdsInBatches(
      async (batchIds) => {
        const { data, error } = await buildClaimQuery(batchIds, null)
        return { data, error }
      },
      boundingIds,
      maxClaimIds
    )
  }

  // No bounded candidate set (e.g. an employee-name-only filter): paginate over
  // the full table with a cursor. No large `.in('id', [...])` list is involved,
  // so the request URL stays within limits.
  const claimIds = new Set<string>()
  let cursor: { created_at: string; id: string } | null = null

  for (;;) {
    const { data, error } = await buildClaimQuery(null, cursor)

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data ?? []) as CursorRow[]

    for (const row of rows) {
      if (row.id) {
        claimIds.add(row.id)
      }
    }

    assertClaimIdLimit(claimIds.size, maxClaimIds)

    if (rows.length < FILTER_BATCH_SIZE) {
      break
    }

    const last = rows[rows.length - 1]
    cursor = { created_at: last.created_at, id: last.id }
  }

  return [...claimIds]
}
