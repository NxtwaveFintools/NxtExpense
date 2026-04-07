import { formatDate, formatDatetime } from '@/lib/utils/date'
import { toCsvCell } from '@/lib/utils/csv'
import type { Claim, MyClaimsFilters } from '@/features/claims/types'
import { myClaimsFiltersSchema } from '@/features/claims/validations'

type ClaimsFilterInput = Partial<
  Record<keyof MyClaimsFilters, string | undefined>
>

function normalizeText(value: string | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized ? normalized : null
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

// FIX [ISSUE#2] — Extracted headers and row mapper for streaming export reuse
export const MY_CLAIMS_CSV_HEADERS = [
  'Claim ID',
  'Travel Date',
  'Work Location',
  'Amount',
  'Status',
  'Submitted At',
]

export function mapMyClaimToCsvRow(row: Claim): string[] {
  return [
    row.claim_number,
    formatDate(row.claim_date),
    row.work_location,
    `Rs. ${row.total_amount.toFixed(2)}`,
    row.statusName,
    row.submitted_at ? formatDatetime(row.submitted_at) : '-',
  ]
}

export function buildMyClaimsCsv(rows: Claim[]): string {
  const bodyRows = rows.map(mapMyClaimToCsvRow)

  return [MY_CLAIMS_CSV_HEADERS, ...bodyRows]
    .map((cells) => cells.map((cell) => toCsvCell(String(cell))).join(','))
    .join('\n')
}
