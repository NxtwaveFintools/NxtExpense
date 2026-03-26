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

function formatMilestoneDate(
  milestoneAt: string | null,
  actedAt: string
): string {
  if (!milestoneAt) {
    return '-'
  }

  if (new Date(milestoneAt).getTime() === new Date(actedAt).getTime()) {
    return '-'
  }

  return formatDate(milestoneAt)
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
    claimStatus: normalizeText(value.claimStatus),
    claimDateFrom: value.claimDateFrom ?? null,
    claimDateTo: value.claimDateTo ?? null,
    amountOperator: value.amountOperator,
    amountValue: value.amountValue ?? null,
    locationType: value.locationType ?? null,
    claimDateSort: value.claimDateSort,
    hodApprovedFrom: value.hodApprovedFrom ?? null,
    hodApprovedTo: value.hodApprovedTo ?? null,
    financeApprovedFrom: value.financeApprovedFrom ?? null,
    financeApprovedTo: value.financeApprovedTo ?? null,
  }
}

export function addApprovalFiltersToParams(
  params: URLSearchParams,
  filters: ApprovalHistoryFilters
): URLSearchParams {
  if (filters.employeeName) {
    params.set('employeeName', filters.employeeName)
  }

  if (filters.claimStatus) {
    params.set('claimStatus', filters.claimStatus)
  }

  if (filters.claimDateFrom) {
    params.set('claimDateFrom', filters.claimDateFrom)
  }

  if (filters.claimDateTo) {
    params.set('claimDateTo', filters.claimDateTo)
  }

  if (filters.amountOperator !== 'lte') {
    params.set('amountOperator', filters.amountOperator)
  }

  if (filters.amountValue !== null) {
    params.set('amountValue', String(filters.amountValue))
  }

  if (filters.locationType) {
    params.set('locationType', filters.locationType)
  }

  if (filters.claimDateSort !== 'desc') {
    params.set('claimDateSort', filters.claimDateSort)
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
    'Payment Issued Date',
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
    formatMilestoneDate(row.hodApprovedAt, row.actedAt),
    formatMilestoneDate(row.financeApprovedAt, row.actedAt),
    row.claimStatusName,
  ])

  return [headers, ...bodyRows]
    .map((cells) =>
      cells.map((cell) => normalizeCsvCell(String(cell))).join(',')
    )
    .join('\n')
}
