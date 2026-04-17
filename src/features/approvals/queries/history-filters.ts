import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  ApprovalHistoryFilters,
  ApprovalHistoryRecord,
  PaginatedApprovalHistoryRecords,
} from '@/features/approvals/types'
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination'
import { getClaimStatusDisplay } from '@/lib/utils/claim-status'
import { parseClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'
import { resolveClaimAllowResubmitFilterValue } from '@/lib/services/claim-status-filter-service'

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

type ClaimStatusDisplayRow = {
  id: string
  allow_resubmit: boolean
  employees:
    | {
        employee_id: string
        employee_email: string
      }
    | Array<{
        employee_id: string
        employee_email: string
      }>
    | null
  claim_statuses:
    | {
        status_code: string
        status_name: string
        display_color: string
        allow_resubmit_status_name: string | null
        allow_resubmit_display_color: string | null
      }
    | Array<{
        status_code: string
        status_name: string
        display_color: string
        allow_resubmit_status_name: string | null
        allow_resubmit_display_color: string | null
      }>
    | null
}

type StatusDisplayOverride = {
  label: string
  colorToken: string
}

type ApprovalHistoryClaimEnrichment = {
  statusDisplay: StatusDisplayOverride
  ownerEmployeeId: string | null
  ownerEmail: string | null
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
  row: FilteredApprovalHistoryRpcRow,
  enrichment?: ApprovalHistoryClaimEnrichment
): ApprovalHistoryRecord {
  return {
    actionId: row.action_id,
    claimId: row.claim_id,
    claimNumber: row.claim_number,
    claimDate: row.claim_date,
    workLocation: row.work_location,
    totalAmount: Number(row.total_amount),
    claimStatusName: enrichment?.statusDisplay.label ?? row.claim_status_name,
    claimStatusDisplayColor:
      enrichment?.statusDisplay.colorToken ?? row.claim_status_display_color,
    ownerEmployeeId: enrichment?.ownerEmployeeId ?? null,
    ownerName: row.owner_name,
    ownerEmail: enrichment?.ownerEmail ?? null,
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

async function getApprovalHistoryClaimEnrichmentByClaimId(
  supabase: SupabaseClient,
  claimIds: string[]
): Promise<Map<string, ApprovalHistoryClaimEnrichment>> {
  if (claimIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('expense_claims')
    .select(
      'id, allow_resubmit, employees!employee_id(employee_id, employee_email), claim_statuses!status_id(status_code, status_name, display_color, allow_resubmit_status_name, allow_resubmit_display_color)'
    )
    .in('id', claimIds)

  if (error) {
    throw new Error(error.message)
  }

  const enrichmentByClaimId = new Map<string, ApprovalHistoryClaimEnrichment>()

  for (const row of (data ?? []) as ClaimStatusDisplayRow[]) {
    const statusInfo = Array.isArray(row.claim_statuses)
      ? row.claim_statuses[0]
      : row.claim_statuses
    const owner = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees

    const display = getClaimStatusDisplay({
      statusCode: statusInfo?.status_code,
      statusName: statusInfo?.status_name,
      statusDisplayColor: statusInfo?.display_color,
      allowResubmit: row.allow_resubmit,
      allowResubmitStatusName: statusInfo?.allow_resubmit_status_name,
      allowResubmitDisplayColor: statusInfo?.allow_resubmit_display_color,
    })

    enrichmentByClaimId.set(row.id, {
      statusDisplay: display,
      ownerEmployeeId: owner?.employee_id ?? null,
      ownerEmail: owner?.employee_email ?? null,
    })
  }

  return enrichmentByClaimId
}

export async function getFilteredApprovalHistoryPaginated(
  supabase: SupabaseClient,
  cursor: string | null,
  limit: number,
  filters: ApprovalHistoryFilters
): Promise<PaginatedApprovalHistoryRecords> {
  const normalizedLimit = Math.max(1, Math.min(limit, 100))
  const decodedCursor = cursor ? decodeCursor(cursor) : null
  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)
  const allowResubmitFilter = await resolveClaimAllowResubmitFilterValue(
    supabase,
    parsedStatusFilter
  )

  const baseArgs = {
    p_limit: normalizedLimit,
    p_cursor_acted_at: decodedCursor?.created_at ?? null,
    p_cursor_action_id: decodedCursor?.id ?? null,
    p_name_search: filters.employeeName,
    p_actor_filters: null,
    p_claim_status_id: parsedStatusFilter?.statusId ?? null,
    p_claim_allow_resubmit: allowResubmitFilter,
    p_amount_operator: filters.amountOperator,
    p_amount_value: filters.amountValue,
    p_location_type: filters.locationType,
    p_hod_approved_from: toIstDayStart(filters.hodApprovedFrom),
    p_hod_approved_to: toIstDayEnd(filters.hodApprovedTo),
    p_finance_approved_from: toIstDayStart(filters.financeApprovedFrom),
    p_finance_approved_to: toIstDayEnd(filters.financeApprovedTo),
  }

  const { data, error } = await supabase.rpc('get_filtered_approval_history', {
    ...baseArgs,
    p_claim_date_from: filters.claimDateFrom,
    p_claim_date_to: filters.claimDateTo,
  })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as FilteredApprovalHistoryRpcRow[]
  const hasNextPage = rows.length > normalizedLimit
  const pageRows = hasNextPage ? rows.slice(0, normalizedLimit) : rows
  const claimIds = [...new Set(pageRows.map((row) => row.claim_id))]
  const claimEnrichmentById = await getApprovalHistoryClaimEnrichmentByClaimId(
    supabase,
    claimIds
  )
  const mappedRows = pageRows.map((row) =>
    mapHistoryRecord(row, claimEnrichmentById.get(row.claim_id))
  )

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

function toNumericCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value))
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed))
    }
  }

  return 0
}

function isMissingHistoryCountRpcError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ''

  return (
    message.includes('get_filtered_approval_history_count') &&
    (message.includes('schema cache') || message.includes('does not exist'))
  )
}

export async function getFilteredApprovalHistoryCount(
  supabase: SupabaseClient,
  filters: ApprovalHistoryFilters
): Promise<number> {
  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)
  const allowResubmitFilter = await resolveClaimAllowResubmitFilterValue(
    supabase,
    parsedStatusFilter
  )

  const { data, error } = await supabase.rpc(
    'get_filtered_approval_history_count',
    {
      p_name_search: filters.employeeName,
      p_actor_filters: null,
      p_claim_status: null,
      p_claim_status_id: parsedStatusFilter?.statusId ?? null,
      p_claim_allow_resubmit: allowResubmitFilter,
      p_amount_operator: filters.amountOperator,
      p_amount_value: filters.amountValue,
      p_location_type: filters.locationType,
      p_claim_date_from: filters.claimDateFrom,
      p_claim_date_to: filters.claimDateTo,
      p_hod_approved_from: toIstDayStart(filters.hodApprovedFrom),
      p_hod_approved_to: toIstDayEnd(filters.hodApprovedTo),
      p_finance_approved_from: toIstDayStart(filters.financeApprovedFrom),
      p_finance_approved_to: toIstDayEnd(filters.financeApprovedTo),
    }
  )

  if (error) {
    if (isMissingHistoryCountRpcError(error)) {
      throw new Error(
        'Approval history count RPC is unavailable. Full-row fallback counting is disabled for performance; apply the latest DB migrations and refresh the schema cache.'
      )
    }

    throw new Error(error.message)
  }

  if (Array.isArray(data)) {
    const firstRow = data[0] as Record<string, unknown> | undefined

    return toNumericCount(
      firstRow?.count ?? firstRow?.get_filtered_approval_history_count
    )
  }

  return toNumericCount(data)
}
