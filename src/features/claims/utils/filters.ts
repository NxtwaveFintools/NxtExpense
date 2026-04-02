import { formatDate, formatDatetime } from '@/lib/utils/date'
import type { Claim, MyClaimsFilters } from '@/features/claims/types'
import { myClaimsFiltersSchema } from '@/features/claims/validations'

type ClaimsFilterInput = Partial<
  Record<keyof MyClaimsFilters, string | undefined>
>

function normalizeText(value: string | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized ? normalized : null
}

function normalizeCsvCell(value: string): string {
  const escaped = value.replaceAll('"', '""')
  return `"${escaped}"`
}

export function normalizeMyClaimsFilters(
  rawFilters: ClaimsFilterInput
): MyClaimsFilters {
  const parsed = myClaimsFiltersSchema.safeParse(rawFilters)

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? 'Invalid claim filters provided.'
    )
  }

  const value = parsed.data

  return {
    claimStatus: normalizeText(value.claimStatus),
    workLocation: value.workLocation ?? null,
    claimDateFrom: value.claimDateFrom ?? null,
    claimDateTo: value.claimDateTo ?? null,
  }
}

export function addMyClaimsFiltersToParams(
  params: URLSearchParams,
  filters: MyClaimsFilters
): URLSearchParams {
  if (filters.claimStatus) {
    params.set('claimStatus', filters.claimStatus)
  }

  if (filters.workLocation) {
    params.set('workLocation', filters.workLocation)
  }

  if (filters.claimDateFrom) {
    params.set('claimDateFrom', filters.claimDateFrom)
  }

  if (filters.claimDateTo) {
    params.set('claimDateTo', filters.claimDateTo)
  }

  return params
}

export function buildMyClaimsCsv(rows: Claim[]): string {
  const headers = [
    'Claim ID',
    'Travel Date',
    'Work Location',
    'Amount',
    'Status',
    'Submitted At',
  ]

  const bodyRows = rows.map((row) => [
    row.claim_number,
    formatDate(row.claim_date),
    row.work_location,
    `Rs. ${row.total_amount.toFixed(2)}`,
    row.statusName,
    row.submitted_at ? formatDatetime(row.submitted_at) : '-',
  ])

  return [headers, ...bodyRows]
    .map((cells) =>
      cells.map((cell) => normalizeCsvCell(String(cell))).join(',')
    )
    .join('\n')
}
