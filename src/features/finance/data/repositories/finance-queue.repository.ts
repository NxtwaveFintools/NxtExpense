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
import {
  hasFinanceClaimFilters,
  toIstDayEnd,
  toIstDayStart,
} from '@/features/finance/utils/filters'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'

import {
  DEFAULT_FINANCE_FILTERS,
  FINANCE_OWNER_COLUMNS,
  type ExpenseClaimWithOwnerRow,
  normalizeFinanceOwner,
} from '@/features/finance/data/repositories/finance-shared.repository'

// The queue applies date filters server-side via the resolver, which expects IST
// day boundaries (timestamptz) for every date field except claim_date. claim_date
// is a plain date column compared as-is. Mirrors finance-resolver-parity's
// usesIstBoundary so the page RPC sees exactly the bounds the resolver was tested
// against.
function usesIstBoundary(field: FinanceFilters['dateFilterField']): boolean {
  return (
    field === 'payment_released_date' ||
    field === 'finance_approved_date' ||
    field === 'submitted_at' ||
    field === 'hod_approved_date'
  )
}

function buildQueueRpcArgs(
  financeStatusId: string,
  filters: FinanceFilters
): Record<string, unknown> {
  const useIst = usesIstBoundary(filters.dateFilterField)
  return {
    p_required_status_id: financeStatusId,
    p_has_filters: hasFinanceClaimFilters(filters),
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

async function getFinanceReviewStatusId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase
    .from('claim_statuses')
    .select('id')
    .eq('approval_level', 3)
    .eq('is_rejection', false)
    .eq('is_terminal', false)
    .eq('is_approval', false)
    .eq('is_active', true)
    .maybeSingle()

  return data?.id ?? null
}

export async function getFinanceQueuePaginated(
  supabase: SupabaseClient,
  cursor: string | null,
  limit = 10,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<PaginatedFinanceQueue> {
  const financeStatusId = await getFinanceReviewStatusId(supabase)

  if (!financeStatusId) {
    return { data: [], hasNextPage: false, nextCursor: null, limit }
  }

  // SQL keyset ID-page: filtering + pagination happen in Postgres. At most
  // limit + 1 ids ever return to Node.
  const decoded = cursor ? decodeCursor(cursor) : null
  const { data: pageRows, error: pageError } = await supabase.rpc(
    'get_finance_queue_page',
    {
      ...buildQueueRpcArgs(financeStatusId, filters),
      p_cursor_created_at: decoded?.created_at ?? null,
      p_cursor_id: decoded?.id ?? null,
      p_limit: limit,
    }
  )

  if (pageError) {
    throw new Error(pageError.message)
  }

  const idRows = (pageRows ?? []) as Array<{ id: string; created_at: string }>
  const hasNextPage = idRows.length > limit
  const pageIdRows = hasNextPage ? idRows.slice(0, limit) : idRows
  const pageIds = pageIdRows.map((row) => row.id)

  if (pageIds.length === 0) {
    return { data: [], hasNextPage: false, nextCursor: null, limit }
  }

  // Bounded enrichment (<= limit ids): the rich nested projection stays in
  // PostgREST. .in('id', pageIds) does not guarantee order, so we re-apply the
  // keyset order from the RPC below.
  const { data: claimData, error: claimError } = await supabase
    .from('expense_claims')
    .select(
      `${CLAIM_COLUMNS}, employees!employee_id!inner(${FINANCE_OWNER_COLUMNS})`
    )
    .in('id', pageIds)

  if (claimError) {
    throw new Error(claimError.message)
  }

  const claimRowById = new Map(
    ((claimData ?? []) as Array<ExpenseClaimWithOwnerRow>).map((row) => [
      row.id as string,
      row,
    ])
  )

  const availableActionsByClaimId = await getClaimAvailableActionsByClaimIds(
    supabase,
    pageIds
  )

  const mappedData = pageIds
    .map((claimId) => {
      const row = claimRowById.get(claimId)
      if (!row) {
        return null
      }

      const ownerRelation = Array.isArray(row.employees)
        ? row.employees[0]
        : row.employees

      const owner = ownerRelation ? normalizeFinanceOwner(ownerRelation) : null

      if (!owner) {
        throw new Error('Claim owner mapping not found.')
      }

      return {
        claim: mapClaimRow(row) as Claim,
        owner,
        availableActions: availableActionsByClaimId.get(claimId) ?? [],
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  const lastRecord = pageIdRows.at(-1)
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

export async function getFinanceQueueTotalCount(
  supabase: SupabaseClient,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<number> {
  const financeStatusId = await getFinanceReviewStatusId(supabase)

  if (!financeStatusId) {
    return 0
  }

  const { data, error } = await supabase.rpc(
    'get_finance_queue_count',
    buildQueueRpcArgs(financeStatusId, filters)
  )

  if (error) {
    throw new Error(error.message)
  }

  return Number(data ?? 0)
}
