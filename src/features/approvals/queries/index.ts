import type { SupabaseClient } from '@supabase/supabase-js'

import type { Claim, ClaimItem } from '@/features/claims/types'
import { getClaimAvailableActions } from '@/features/claims/queries'
import { getEmployeeById } from '@/features/employees/queries'
import type { Employee } from '@/features/employees/types'
import type {
  ApprovalAction,
  ApprovalHistoryItem,
  PendingApprovalsFilters,
  PaginatedApprovalHistory,
  PendingApproval,
} from '@/features/approvals/types'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'

const CLAIM_COLUMNS =
  'id, claim_number, employee_id, claim_date, work_location, own_vehicle_used, vehicle_type, outstation_location, from_city, to_city, km_travelled, total_amount, status, current_approval_level, submitted_at, created_at, updated_at, tenant_id, resubmission_count, last_rejection_notes, last_rejected_by_email, last_rejected_at'

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

  // Only L1 (SBH for SRO/BOA/ABH) and L3 (Mansoor, final for all) are actual
  // approval stops. L2 is org-hierarchy only and is never a pending-approval stop.
  const [level1Employees, level3Employees] = await Promise.all([
    supabase
      .from('employees')
      .select('id')
      .eq('approval_email_level_1', lowerEmail),
    supabase
      .from('employees')
      .select('id')
      .eq('approval_email_level_3', lowerEmail),
  ])

  if (level1Employees.error) {
    throw new Error(level1Employees.error.message)
  }

  if (level3Employees.error) {
    throw new Error(level3Employees.error.message)
  }

  const level1Ids = (level1Employees.data ?? []).map((row) => row.id)
  const level3Ids = (level3Employees.data ?? []).map((row) => row.id)

  const toInList = (ids: string[]) =>
    ids.map((id) => `"${id.replaceAll('"', '\\"')}"`).join(',')

  const approvalFilters: string[] = []

  if (level1Ids.length > 0) {
    approvalFilters.push(
      `and(current_approval_level.eq.1,employee_id.in.(${toInList(level1Ids)}))`
    )
  }

  if (level3Ids.length > 0) {
    approvalFilters.push(
      `and(current_approval_level.eq.3,employee_id.in.(${toInList(level3Ids)}))`
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
    .select(`${CLAIM_COLUMNS}, employees!inner(*)`)
    .eq('status', 'pending_approval')
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
    query = query.eq('employees.designation', 'State Business Head')
  }

  if (filters.actorFilter === 'finance') {
    query = query.eq('employees.designation', 'Finance')
  }

  if (filters.actorFilter === 'hod') {
    query = query.not('employees.approval_email_level_3', 'is', null)
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

  const pending: PendingApproval[] = await Promise.all(
    pageData.map(async (row) => {
      const owner = Array.isArray(row.employees)
        ? row.employees[0]
        : row.employees

      if (!owner) {
        throw new Error('Claim owner mapping not found.')
      }

      const [{ data: itemsData, error: itemsError }, actions] =
        await Promise.all([
          supabase
            .from('expense_claim_items')
            .select('id, claim_id, item_type, description, amount, created_at')
            .eq('claim_id', row.id),
          getClaimAvailableActions(supabase, row.id),
        ])

      if (itemsError) {
        throw new Error(itemsError.message)
      }

      return {
        claim: row,
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
          created_at: lastRecord.created_at,
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
      'id, claim_id, approver_email, approval_level, action, notes, rejection_notes, allow_resubmit, bypass_reason, skipped_levels, reason, acted_at'
    )
    .eq('claim_id', claimId)
    .order('acted_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ApprovalAction[]
}

export async function getClaimWithOwner(
  supabase: SupabaseClient,
  claimId: string
): Promise<{ claim: Claim; owner: Employee } | null> {
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

  return { claim: data as Claim, owner }
}

export async function getMyApprovalHistoryPaginated(
  supabase: SupabaseClient,
  approverEmail: string,
  cursor: string | null,
  limit = 10
): Promise<PaginatedApprovalHistory> {
  const lowerEmail = approverEmail.toLowerCase()

  let query = supabase
    .from('approval_history')
    .select(
      'id, claim_id, approver_email, approval_level, action, notes, rejection_notes, allow_resubmit, bypass_reason, skipped_levels, reason, acted_at'
    )
    .eq('approver_email', lowerEmail)
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

  const historyRows = (data ?? []) as ApprovalAction[]
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
    .select(`${CLAIM_COLUMNS}, employees!inner(*)`)
    .in('id', claimIds)

  if (claimError) {
    throw new Error(claimError.message)
  }

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
