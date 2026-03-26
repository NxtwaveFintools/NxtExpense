import type { SupabaseClient } from '@supabase/supabase-js'

import type { PendingApprovalsFilters } from '@/features/approvals/types'
import { getLocationIdsByApprovalLocationType } from '@/features/approvals/queries/location-type'

type PendingApprovalsSummary = {
  count: number
  amount: number
}

type PendingSummaryRow = {
  id: string
  created_at: string
  total_amount: number | string
}

const DEFAULT_PENDING_FILTERS: PendingApprovalsFilters = {
  employeeName: null,
  claimStatus: null,
  claimDateFrom: null,
  claimDateTo: null,
  amountOperator: 'lte',
  amountValue: null,
  locationType: null,
  claimDateSort: 'desc',
}

function toInList(ids: string[]) {
  return ids.map((id) => `"${id.replaceAll('"', '\\"')}"`).join(',')
}

function buildCursorFilter(createdAt: string, id: string): string {
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`
}

export async function getPendingApprovalsSummary(
  supabase: SupabaseClient,
  approverEmail: string,
  filters: PendingApprovalsFilters = DEFAULT_PENDING_FILTERS
): Promise<PendingApprovalsSummary> {
  const lowerEmail = approverEmail.toLowerCase()

  const [actorResult, pendingStatusesResult] = await Promise.all([
    supabase
      .from('employees')
      .select('id')
      .eq('employee_email', lowerEmail)
      .maybeSingle(),
    supabase
      .from('claim_statuses')
      .select('id')
      .not('approval_level', 'is', null)
      .eq('is_rejection', false)
      .eq('is_terminal', false)
      .eq('is_active', true)
      .in('approval_level', [1, 2]),
  ])

  if (actorResult.error) {
    throw new Error(actorResult.error.message)
  }

  if (pendingStatusesResult.error) {
    throw new Error(pendingStatusesResult.error.message)
  }

  if (!actorResult.data) {
    return { count: 0, amount: 0 }
  }

  const pendingStatuses = pendingStatusesResult.data ?? []
  const normalizedStatusFilter = filters.claimStatus?.trim()

  const pendingStatusIds = (
    normalizedStatusFilter
      ? pendingStatuses.filter((status) => status.id === normalizedStatusFilter)
      : pendingStatuses
  ).map((status) => status.id)

  if (pendingStatusIds.length === 0) {
    return { count: 0, amount: 0 }
  }

  const actorEmployeeId = actorResult.data.id

  const [level1Employees, level2Employees] = await Promise.all([
    supabase
      .from('employees')
      .select('id')
      .eq('approval_employee_id_level_1', actorEmployeeId),
    supabase
      .from('employees')
      .select('id')
      .eq('approval_employee_id_level_3', actorEmployeeId),
  ])

  if (level1Employees.error) {
    throw new Error(level1Employees.error.message)
  }

  if (level2Employees.error) {
    throw new Error(level2Employees.error.message)
  }

  const level1Ids = (level1Employees.data ?? []).map((row) => row.id)
  const level2Ids = (level2Employees.data ?? []).map((row) => row.id)

  const approvalFilters: string[] = []

  if (level1Ids.length > 0) {
    approvalFilters.push(
      `and(current_approval_level.eq.1,employee_id.in.(${toInList(level1Ids)}))`
    )
  }

  if (level2Ids.length > 0) {
    approvalFilters.push(
      `and(current_approval_level.eq.2,employee_id.in.(${toInList(level2Ids)}))`
    )
  }

  if (approvalFilters.length === 0) {
    return { count: 0, amount: 0 }
  }

  const normalizedName = filters.employeeName?.trim() ?? ''

  let scopedLocationIds: string[] | null = null
  if (filters.locationType) {
    scopedLocationIds = await getLocationIdsByApprovalLocationType(
      supabase,
      filters.locationType
    )

    if (!scopedLocationIds || scopedLocationIds.length === 0) {
      return { count: 0, amount: 0 }
    }
  }

  const pageSize = 500

  let nextCursor: { created_at: string; id: string } | null = null
  let totalCount = 0
  let totalAmount = 0

  for (;;) {
    let query = supabase
      .from('expense_claims')
      .select(
        'id, created_at, total_amount, employees!employee_id!inner(employee_name, designation_id, approval_employee_id_level_3)'
      )
      .in('status_id', pendingStatusIds)
      .or(approvalFilters.join(','))
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize)

    if (nextCursor) {
      query = query.or(buildCursorFilter(nextCursor.created_at, nextCursor.id))
    }

    if (normalizedName) {
      const escapedName = normalizedName
        .replaceAll('%', '\\%')
        .replaceAll('_', '\\_')
      query = query.ilike('employees.employee_name', `%${escapedName}%`)
    }

    if (filters.claimDateFrom) {
      query = query.gte('claim_date', filters.claimDateFrom)
    }

    if (filters.claimDateTo) {
      query = query.lte('claim_date', filters.claimDateTo)
    }

    if (filters.amountValue !== null) {
      if (filters.amountOperator === 'gte') {
        query = query.gte('total_amount', filters.amountValue)
      } else if (filters.amountOperator === 'eq') {
        query = query.eq('total_amount', filters.amountValue)
      } else {
        query = query.lte('total_amount', filters.amountValue)
      }
    }

    if (scopedLocationIds) {
      query = query.in('work_location_id', scopedLocationIds)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data ?? []) as PendingSummaryRow[]

    if (rows.length === 0) {
      break
    }

    totalCount += rows.length
    totalAmount += rows.reduce(
      (sum, row) => sum + Number(row.total_amount ?? 0),
      0
    )

    if (rows.length < pageSize) {
      break
    }

    const lastRow = rows[rows.length - 1]
    nextCursor = {
      created_at: lastRow.created_at,
      id: lastRow.id,
    }
  }

  return {
    count: totalCount,
    amount: totalAmount,
  }
}
