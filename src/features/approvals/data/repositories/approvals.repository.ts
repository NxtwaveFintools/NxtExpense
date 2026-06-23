import type { SupabaseClient } from '@supabase/supabase-js'

import type { Claim, ClaimItem } from '@/features/claims/types'
import {
  CLAIM_COLUMNS,
  getClaimAvailableActionsByClaimIds,
  mapClaimRow,
  resolveClaimAllowResubmitFilterValue,
} from '@/features/claims/data/queries'
import { INTERMEDIATE_APPROVAL_LEVELS } from '@/lib/constants/approval-levels'
import type { EmployeeRow } from '@/lib/services/employee-service'
import { getEmployeeById } from '@/lib/services/employee-service'
import { parseClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'

import type {
  ApprovalAction,
  PendingApproval,
  PendingApprovalsFilters,
} from '@/features/approvals/types'

export async function getApproverActorByEmail(
  supabase: SupabaseClient,
  approverEmail: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('id')
    .eq('employee_email', approverEmail.toLowerCase())
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getPendingApprovalStatuses(
  supabase: SupabaseClient
): Promise<Array<{ id: string }>> {
  const { data, error } = await supabase
    .from('claim_statuses')
    .select('id')
    .not('approval_level', 'is', null)
    .eq('is_rejection', false)
    .eq('is_terminal', false)
    .eq('is_active', true)
    .in('approval_level', [...INTERMEDIATE_APPROVAL_LEVELS])

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function getPendingApprovalsPaginated(
  supabase: SupabaseClient,
  approverEmail: string,
  cursor: string | null,
  limit = 10,
  filters: PendingApprovalsFilters = {
    employeeName: null,
    claimStatus: null,
    claimDateFrom: null,
    claimDateTo: null,
    amountOperator: 'lte',
    amountValue: null,
    locationType: null,
    claimDateSort: 'desc',
  }
) {
  if (!approverEmail) {
    return { data: [], hasNextPage: false, nextCursor: null, limit }
  }

  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)
  const allowResubmitFilter = await resolveClaimAllowResubmitFilterValue(
    supabase,
    parsedStatusFilter
  )

  // Keyset ID-page resolved entirely in Postgres (get_pending_approvals): the
  // approver's subordinate scope is computed from the caller's JWT inside the
  // function and never leaves the DB, so the request URL stays tiny regardless
  // of HOD/SBH/ZBH size. At most limit + 1 ids ever return to Node. Mirrors the
  // Approval History / Finance keyset design.
  const decoded = cursor ? decodeCursor(cursor) : null
  const normalizedName = filters.employeeName?.trim() ?? ''

  const { data: pageRows, error: pageError } = await supabase.rpc(
    'get_pending_approvals',
    {
      p_limit: limit,
      p_cursor_claim_date: decoded?.created_at ?? null,
      p_cursor_id: decoded?.id ?? null,
      p_sort: filters.claimDateSort === 'asc' ? 'asc' : 'desc',
      p_claim_status_id: parsedStatusFilter?.statusId ?? null,
      p_allow_resubmit: allowResubmitFilter,
      p_employee_name: normalizedName || null,
      p_amount_operator: filters.amountOperator,
      p_amount_value: filters.amountValue,
      p_location_type: filters.locationType,
      p_claim_date_from: filters.claimDateFrom,
      p_claim_date_to: filters.claimDateTo,
    }
  )

  if (pageError) {
    throw new Error(pageError.message)
  }

  const idRows = (pageRows ?? []) as Array<{ id: string; claim_date: string }>
  const hasNextPage = idRows.length > limit
  const pageIdRows = hasNextPage ? idRows.slice(0, limit) : idRows
  const pageIds = pageIdRows.map((row) => row.id)

  if (pageIds.length === 0) {
    return { data: [], hasNextPage: false, nextCursor: null, limit }
  }

  // Bounded enrichment (<= limit ids). .in('id', pageIds) does not guarantee
  // order, so we re-apply the RPC's keyset order when mapping below.
  const [claimResult, itemsResult, actionsByClaimId] = await Promise.all([
    supabase
      .from('expense_claims')
      .select(`${CLAIM_COLUMNS}, employees!employee_id!inner(*)`)
      .in('id', pageIds),
    supabase
      .from('expense_claim_items')
      .select('id, claim_id, item_type, description, amount, created_at')
      .in('claim_id', pageIds),
    getClaimAvailableActionsByClaimIds(supabase, pageIds),
  ])

  if (claimResult.error) {
    throw new Error(claimResult.error.message)
  }

  if (itemsResult.error) {
    throw new Error(itemsResult.error.message)
  }

  const claimRowById = new Map(
    (
      (claimResult.data ?? []) as Array<
        Record<string, unknown> & { employees: EmployeeRow | EmployeeRow[] }
      >
    ).map((row) => [row.id as string, row])
  )

  const itemsByClaimId = new Map<string, ClaimItem[]>()
  for (const item of (itemsResult.data ?? []) as (ClaimItem & {
    claim_id: string
  })[]) {
    const list = itemsByClaimId.get(item.claim_id)
    if (list) {
      list.push(item)
    } else {
      itemsByClaimId.set(item.claim_id, [item])
    }
  }

  const pending: PendingApproval[] = pageIds
    .map((claimId) => {
      const row = claimRowById.get(claimId)
      if (!row) {
        return null
      }

      const owner = Array.isArray(row.employees)
        ? row.employees[0]
        : row.employees

      if (!owner) {
        throw new Error('Claim owner mapping not found.')
      }

      return {
        claim: mapClaimRow(row as Record<string, unknown>) as Claim,
        owner,
        items: itemsByClaimId.get(claimId) ?? [],
        availableActions: actionsByClaimId.get(claimId) ?? [],
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (pending.length !== pageIds.length) {
    throw new Error('Pending approvals changed during pagination enrichment')
  }

  const lastRecord = pageIdRows.at(-1)
  const nextCursor =
    hasNextPage && lastRecord
      ? encodeCursor({
          created_at: lastRecord.claim_date,
          id: lastRecord.id,
        })
      : null

  return {
    data: pending,
    hasNextPage,
    nextCursor,
    limit,
  }
}

export async function getClaimApprovalHistory(
  supabase: SupabaseClient,
  claimId: string
): Promise<ApprovalAction[]> {
  const { data, error } = await supabase
    .from('approval_history')
    .select(
      'id, claim_id, approver_employee_id, approval_level, action, notes, rejection_notes, allow_resubmit, bypass_reason, skipped_levels, reason, acted_at, approver:employees!approver_employee_id(employee_email)'
    )
    .eq('claim_id', claimId)
    .order('acted_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((r) => {
    const approverRaw = r.approver as unknown
    const approver = Array.isArray(approverRaw) ? approverRaw[0] : approverRaw
    return {
      ...r,
      approver_email:
        (approver as { employee_email: string } | null)?.employee_email ?? '',
    } as ApprovalAction
  })
}

export async function getClaimWithOwner(
  supabase: SupabaseClient,
  claimId: string
): Promise<{ claim: Claim; owner: EmployeeRow } | null> {
  const { data, error } = await supabase
    .from('expense_claims')
    .select(`${CLAIM_COLUMNS}`)
    .eq('id', claimId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  const owner = await getEmployeeById(supabase, data.employee_id)
  if (!owner) {
    throw new Error('Claim owner record not found.')
  }

  return { claim: mapClaimRow(data as Record<string, unknown>) as Claim, owner }
}
