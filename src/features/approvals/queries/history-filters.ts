import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  ApprovalHistoryFilters,
  ApprovalHistoryRecord,
  PaginatedApprovalHistoryRecords,
} from '@/features/approvals/types'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'

type FilteredApprovalHistoryRpcRow = {
  action_id: string
  claim_id: string
  claim_number: string
  claim_date: string
  work_location: string
  total_amount: number | string
  claim_status: string
  claim_status_name: string
  claim_status_display_color: string
  owner_name: string
  owner_designation: string
  actor_email: string
  actor_designation: string | null
  action: string
  approval_level: number | null
  notes: string | null
  acted_at: string
  hod_approved_at: string | null
  finance_approved_at: string | null
}

const IST_START_TIME = 'T00:00:00+05:30'
const IST_END_TIME = 'T23:59:59.999+05:30'

function toIstDayStart(date: string | null): string | null {
  return date ? `${date}${IST_START_TIME}` : null
}

function toIstDayEnd(date: string | null): string | null {
  return date ? `${date}${IST_END_TIME}` : null
}

function mapHistoryRecord(
  row: FilteredApprovalHistoryRpcRow
): ApprovalHistoryRecord {
  return {
    actionId: row.action_id,
    claimId: row.claim_id,
    claimNumber: row.claim_number,
    claimDate: row.claim_date,
    workLocation: row.work_location,
    totalAmount: Number(row.total_amount),
    claimStatusName: row.claim_status_name,
    claimStatusDisplayColor: row.claim_status_display_color,
    ownerName: row.owner_name,
    ownerDesignation: row.owner_designation,
    actorEmail: row.actor_email,
    actorDesignation: row.actor_designation,
    action: row.action,
    approvalLevel: row.approval_level,
    notes: row.notes,
    actedAt: row.acted_at,
    hodApprovedAt: row.hod_approved_at,
    financeApprovedAt: row.finance_approved_at,
  }
}

export async function getFilteredApprovalHistoryPaginated(
  supabase: SupabaseClient,
  cursor: string | null,
  limit: number,
  filters: ApprovalHistoryFilters
): Promise<PaginatedApprovalHistoryRecords> {
  const normalizedLimit = Math.max(1, Math.min(limit, 100))
  const decodedCursor = cursor ? decodeCursor(cursor) : null

  const { data, error } = await supabase.rpc('get_filtered_approval_history', {
    p_limit: normalizedLimit,
    p_cursor_acted_at: decodedCursor?.created_at ?? null,
    p_cursor_action_id: decodedCursor?.id ?? null,
    p_name_search: filters.employeeName,
    p_actor_filters: null,
    p_claim_status_id: filters.claimStatus?.trim() ?? null,
    p_claim_date: filters.claimDate,
    p_hod_approved_from: toIstDayStart(filters.hodApprovedFrom),
    p_hod_approved_to: toIstDayEnd(filters.hodApprovedTo),
    p_finance_approved_from: toIstDayStart(filters.financeApprovedFrom),
    p_finance_approved_to: toIstDayEnd(filters.financeApprovedTo),
  })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as FilteredApprovalHistoryRpcRow[]
  const hasNextPage = rows.length > normalizedLimit
  const pageRows = hasNextPage ? rows.slice(0, normalizedLimit) : rows
  const mappedRows = pageRows.map(mapHistoryRecord)

  const lastRecord = pageRows.at(-1)
  const nextCursor =
    hasNextPage && lastRecord
      ? encodeCursor({
          created_at: lastRecord.acted_at,
          id: lastRecord.action_id,
        })
      : null

  return {
    data: mappedRows,
    hasNextPage,
    nextCursor,
    limit: normalizedLimit,
  }
}

export async function getAllFilteredApprovalHistory(
  supabase: SupabaseClient,
  filters: ApprovalHistoryFilters,
  batchSize = 200
): Promise<ApprovalHistoryRecord[]> {
  const allRows: ApprovalHistoryRecord[] = []
  let cursor: string | null = null

  for (;;) {
    const page = await getFilteredApprovalHistoryPaginated(
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
