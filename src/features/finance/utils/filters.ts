import { formatDate, formatDatetime } from '@/lib/utils/date'
import type {
  FinanceFilters,
  FinanceHistoryItem,
  FinanceQueueItem,
} from '@/features/finance/types'
import { financeFiltersSchema } from '@/features/finance/validations'

type FinanceFilterInput = Partial<
  Record<keyof FinanceFilters, string | undefined>
>

const IST_DAY_START = 'T00:00:00+05:30'
const IST_DAY_END = 'T23:59:59.999+05:30'

function normalizeText(value: string | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized ? normalized : null
}

export function normalizeFinanceFilters(
  rawFilters: FinanceFilterInput
): FinanceFilters {
  const parsed = financeFiltersSchema.safeParse(rawFilters)

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? 'Invalid finance filters.'
    )
  }

  const value = parsed.data

  return {
    employeeName: normalizeText(value.employeeName),
    claimNumber: normalizeText(value.claimNumber),
    ownerDesignation: normalizeText(value.ownerDesignation),
    hodApproverEmployeeId: normalizeText(value.hodApproverEmployeeId),
    claimStatus: normalizeText(value.claimStatus),
    workLocation: normalizeText(value.workLocation),
    actionFilter: normalizeText(value.actionFilter),
    dateFilterField: value.dateFilterField,
    dateFrom: value.dateFrom ?? null,
    dateTo: value.dateTo ?? null,
  }
}

export function hasFinanceClaimFilters(filters: FinanceFilters): boolean {
  return Boolean(
    filters.employeeName ||
    filters.claimNumber ||
    filters.ownerDesignation ||
    filters.hodApproverEmployeeId ||
    filters.claimStatus ||
    filters.workLocation ||
    filters.dateFrom ||
    filters.dateTo
  )
}

export function addFinanceFiltersToParams(
  params: URLSearchParams,
  filters: FinanceFilters
): URLSearchParams {
  if (filters.employeeName) {
    params.set('employeeName', filters.employeeName)
  }

  if (filters.claimNumber) {
    params.set('claimNumber', filters.claimNumber)
  }

  if (filters.ownerDesignation) {
    params.set('ownerDesignation', filters.ownerDesignation)
  }

  if (filters.hodApproverEmployeeId) {
    params.set('hodApproverEmployeeId', filters.hodApproverEmployeeId)
  }

  if (filters.claimStatus) {
    params.set('claimStatus', filters.claimStatus)
  }

  if (filters.workLocation) {
    params.set('workLocation', filters.workLocation)
  }

  if (filters.actionFilter) {
    params.set('actionFilter', filters.actionFilter)
  }

  if (filters.dateFilterField !== 'claim_date') {
    params.set('dateFilterField', filters.dateFilterField)
  }

  if (filters.dateFrom) {
    params.set('dateFrom', filters.dateFrom)
  }

  if (filters.dateTo) {
    params.set('dateTo', filters.dateTo)
  }

  return params
}

export function toIstDayStart(date: string | null): string | null {
  return date ? `${date}${IST_DAY_START}` : null
}

export function toIstDayEnd(date: string | null): string | null {
  return date ? `${date}${IST_DAY_END}` : null
}

function normalizeCsvCell(value: string): string {
  const escaped = value.replaceAll('"', '""')
  return `"${escaped}"`
}

function toFriendlyAction(value: string): string {
  return value.replaceAll('_', ' ')
}

export function buildFinanceHistoryCsv(rows: FinanceHistoryItem[]): string {
  const headers = [
    'Claim ID',
    'Employee ID',
    'Employee',
    'Employee Email',
    'Employee Designation',
    'Travel Date',
    'Work Location',
    'Total Amount',
    'Action',
    'Action By',
    'Action Date',
    'Current Status',
  ]

  const bodyRows = rows.map((row) => [
    row.claim.claim_number,
    row.owner.employee_id,
    row.owner.employee_name,
    row.owner.employee_email,
    row.owner.designations?.designation_name ?? '-',
    formatDate(row.claim.claim_date),
    row.claim.work_location,
    `Rs. ${row.claim.total_amount.toFixed(2)}`,
    toFriendlyAction(row.action.action),
    row.action.actor_email,
    formatDatetime(row.action.acted_at),
    row.claim.statusName,
  ])

  return [headers, ...bodyRows]
    .map((cells) =>
      cells.map((cell) => normalizeCsvCell(String(cell))).join(',')
    )
    .join('\n')
}

export function buildFinancePendingClaimsCsv(rows: FinanceQueueItem[]): string {
  const headers = [
    'Claim ID',
    'Employee ID',
    'Employee',
    'Employee Email',
    'Employee Designation',
    'Travel Date',
    'Submitted At',
    'Work Location',
    'Total Amount',
    'Current Status',
  ]

  const bodyRows = rows.map((row) => [
    row.claim.claim_number,
    row.owner.employee_id,
    row.owner.employee_name,
    row.owner.employee_email,
    row.owner.designations?.designation_name ?? '-',
    formatDate(row.claim.claim_date),
    row.claim.submitted_at ? formatDatetime(row.claim.submitted_at) : '-',
    row.claim.work_location,
    `Rs. ${Number(row.claim.total_amount).toFixed(2)}`,
    row.claim.statusName,
  ])

  return [headers, ...bodyRows]
    .map((cells) =>
      cells.map((cell) => normalizeCsvCell(String(cell))).join(',')
    )
    .join('\n')
}
