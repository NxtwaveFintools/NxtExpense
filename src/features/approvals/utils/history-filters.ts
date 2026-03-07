import { formatDate, formatDatetime } from '@/lib/utils/date'
import type {
  ApprovalHistoryFilters,
  ApprovalHistoryRecord,
} from '@/features/approvals/types'
import { approvalHistoryFiltersSchema } from '@/features/approvals/validations'

type ApprovalHistoryFilterInput = Partial<
  Record<keyof ApprovalHistoryFilters, string | undefined>
>

function normalizeText(value: string | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized ? normalized : null
}

function normalizeCsvCell(value: string): string {
  const escaped = value.replaceAll('"', '""')
  return `"${escaped}"`
}

function toFriendlyStatus(value: string): string {
  return value.replaceAll('_', ' ')
}

export function normalizeApprovalHistoryFilters(
  rawFilters: ApprovalHistoryFilterInput
): ApprovalHistoryFilters {
  const parsed = approvalHistoryFiltersSchema.safeParse(rawFilters)

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? 'Invalid filters provided.'
    )
  }

  const value = parsed.data

  return {
    employeeName: normalizeText(value.employeeName),
    actorFilter: value.actorFilter,
    claimDateFrom: normalizeText(value.claimDateFrom),
    claimDateTo: normalizeText(value.claimDateTo),
    hodApprovedFrom: normalizeText(value.hodApprovedFrom),
    hodApprovedTo: normalizeText(value.hodApprovedTo),
    financeApprovedFrom: normalizeText(value.financeApprovedFrom),
    financeApprovedTo: normalizeText(value.financeApprovedTo),
  }
}

export function addApprovalFiltersToParams(
  params: URLSearchParams,
  filters: ApprovalHistoryFilters
): URLSearchParams {
  if (filters.employeeName) {
    params.set('employeeName', filters.employeeName)
  }

  if (filters.actorFilter !== 'all') {
    params.set('actorFilter', filters.actorFilter)
  }

  if (filters.claimDateFrom) {
    params.set('claimDateFrom', filters.claimDateFrom)
  }

  if (filters.claimDateTo) {
    params.set('claimDateTo', filters.claimDateTo)
  }

  if (filters.hodApprovedFrom) {
    params.set('hodApprovedFrom', filters.hodApprovedFrom)
  }

  if (filters.hodApprovedTo) {
    params.set('hodApprovedTo', filters.hodApprovedTo)
  }

  if (filters.financeApprovedFrom) {
    params.set('financeApprovedFrom', filters.financeApprovedFrom)
  }

  if (filters.financeApprovedTo) {
    params.set('financeApprovedTo', filters.financeApprovedTo)
  }

  return params
}

export function buildApprovalHistoryCsv(rows: ApprovalHistoryRecord[]): string {
  const headers = [
    'Claim ID',
    'Employee',
    'Employee Designation',
    'Claim Date',
    'Work Location',
    'Total Amount',
    'Action',
    'Action Date',
    'Actor Email',
    'Actor Designation',
    'HOD Approved Date',
    'Finance Approved Date',
    'Current Status',
  ]

  const bodyRows = rows.map((row) => [
    row.claimNumber,
    row.ownerName,
    row.ownerDesignation,
    formatDate(row.claimDate),
    row.workLocation,
    `Rs. ${row.totalAmount.toFixed(2)}`,
    toFriendlyStatus(row.action),
    formatDatetime(row.actedAt),
    row.actorEmail,
    row.actorDesignation ?? '-',
    row.hodApprovedAt ? formatDatetime(row.hodApprovedAt) : '-',
    row.financeApprovedAt ? formatDatetime(row.financeApprovedAt) : '-',
    toFriendlyStatus(row.claimStatus),
  ])

  return [headers, ...bodyRows]
    .map((cells) =>
      cells.map((cell) => normalizeCsvCell(String(cell))).join(',')
    )
    .join('\n')
}
