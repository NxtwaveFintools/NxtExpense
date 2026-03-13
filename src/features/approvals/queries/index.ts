import type { SupabaseClient } from '@supabase/supabase-js'

import type { Claim, ClaimItem } from '@/features/claims/types'
import {
  getClaimAvailableActions,
  CLAIM_COLUMNS,
  mapClaimRow,
} from '@/features/claims/queries'
import { getEmployeeById } from '@/lib/services/employee-service'
import type { EmployeeRow } from '@/lib/services/employee-service'
import { getDesignationByCode } from '@/lib/services/config-service'
import type {
  ApprovalAction,
  ApprovalHistoryItem,
  PendingApprovalsFilters,
  PaginatedApprovalHistory,
  PendingApproval,
} from '@/features/approvals/types'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'

export async function getPendingApprovalsPaginated(
  supabase: SupabaseClient,
  approverEmail: string,
  cursor: string | null,
  limit = 10,
  filters: PendingApprovalsFilters = {
    employeeName: null,
    actorFilter: 'all',
  }
) {
  const lowerEmail = approverEmail.toLowerCase()

  // Resolve actor to employee ID and fetch pending status IDs in parallel
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

  if (actorResult.error) throw new Error(actorResult.error.message)
  if (pendingStatusesResult.error)
    throw new Error(pendingStatusesResult.error.message)

  if (!actorResult.data) {
    return { data: [], hasNextPage: false, nextCursor: null, limit }
  }

  const actorEmployeeId = actorResult.data.id
  const pendingStatusIds = (pendingStatusesResult.data ?? []).map((s) => s.id)

  // L1: actor is the level-1 approver for these employees (SBH for SRO/BOA/ABH)
  // L2: actor is the level-3 approver (Mansoor's UUID is stored in approval_employee_id_level_3)
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

  if (level1Employees.error) throw new Error(level1Employees.error.message)
  if (level2Employees.error) throw new Error(level2Employees.error.message)

  const level1Ids = (level1Employees.data ?? []).map((row) => row.id)
  const level2Ids = (level2Employees.data ?? []).map((row) => row.id)

  const toInList = (ids: string[]) =>
    ids.map((id) => `"${id.replaceAll('"', '\\"')}"`).join(',')

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
    .in('status_id', pendingStatusIds)
    .or(approvalFilters.join(','))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    const decoded = decodeCursor(cursor)
    query = query.or(
      `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
    )
  }

  const normalizedName = filters.employeeName?.trim() ?? ''
  if (normalizedName) {
    const escapedName = normalizedName
      .replaceAll('%', '\\%')
      .replaceAll('_', '\\_')

    query = query.ilike('employees.employee_name', `%${escapedName}%`)
  }

  if (filters.actorFilter === 'sbh') {
    const sbhDesignation = await getDesignationByCode(supabase, 'SBH')
    if (sbhDesignation) {
      query = query.eq('employees.designation_id', sbhDesignation.id)
    }
  }

  if (filters.actorFilter === 'finance') {
    const finDesignation = await getDesignationByCode(supabase, 'FIN')
    if (finDesignation) {
      query = query.eq('employees.designation_id', finDesignation.id)
    }
  }

  if (filters.actorFilter === 'hod') {
    query = query.not('employees.approval_employee_id_level_3', 'is', null)
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

  const pending: PendingApproval[] = await Promise.all(
    pageData.map(async (row) => {
      const owner = Array.isArray(row.employees)
        ? row.employees[0]
        : row.employees

      if (!owner) {
        throw new Error('Claim owner mapping not found.')
      }

      const claim = mapClaimRow(row as Record<string, unknown>)

      const [{ data: itemsData, error: itemsError }, actions] =
        await Promise.all([
          supabase
            .from('expense_claim_items')
            .select('id, claim_id, item_type, description, amount, created_at')
            .eq('claim_id', row.id as string),
          getClaimAvailableActions(supabase, row.id as string),
        ])

      if (itemsError) {
        throw new Error(itemsError.message)
      }

      return {
        claim: claim as Claim,
        owner,
        items: (itemsData ?? []) as ClaimItem[],
        availableActions: actions,
      }
    })
  )

  const lastRecord = pageData.at(-1)
  const nextCursor =
    hasNextPage && lastRecord
      ? encodeCursor({
          created_at: lastRecord.created_at as string,
          id: lastRecord.id as string,
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

export async function getMyApprovalHistoryPaginated(
  supabase: SupabaseClient,
  approverEmail: string,
  cursor: string | null,
  limit = 10
): Promise<PaginatedApprovalHistory> {
  const lowerEmail = approverEmail.toLowerCase()

  // Resolve employee ID from email for ID-based filtering
  const { data: empData, error: empError } = await supabase
    .from('employees')
    .select('id')
    .eq('employee_email', lowerEmail)
    .maybeSingle()

  if (empError) {
    throw new Error(empError.message)
  }

  if (!empData) {
    return { data: [], hasNextPage: false, nextCursor: null, limit }
  }

  let query = supabase
    .from('approval_history')
    .select(
      'id, claim_id, approver_employee_id, approval_level, action, notes, rejection_notes, allow_resubmit, bypass_reason, skipped_levels, reason, acted_at, approver:employees!approver_employee_id(employee_email)'
    )
    .eq('approver_employee_id', empData.id)
    .order('acted_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

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

  const historyRows = (data ?? []).map((r) => {
    const approverRaw = (r as Record<string, unknown>).approver as unknown
    const approver = Array.isArray(approverRaw) ? approverRaw[0] : approverRaw
    return {
      ...r,
      approver_email:
        (approver as { employee_email: string } | null)?.employee_email ?? '',
    } as ApprovalAction
  })
  const hasNextPage = historyRows.length > limit
  const pageData = hasNextPage ? historyRows.slice(0, limit) : historyRows

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

  const history: ApprovalHistoryItem[] = pageData
    .map((action) => {
      const mapped = claimMap.get(action.claim_id)
      if (!mapped) {
        return null
      }

      return {
        claim: mapped.claim,
        owner: mapped.owner,
        action,
      }
    })
    .filter((row): row is ApprovalHistoryItem => row !== null)

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
