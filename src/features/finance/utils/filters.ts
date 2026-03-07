import type { FinanceFilters } from '@/features/finance/types'
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
    hodApproverEmail: normalizeText(value.hodApproverEmail),
    actionFilter: value.actionFilter,
    claimDateFrom: normalizeText(value.claimDateFrom),
    claimDateTo: normalizeText(value.claimDateTo),
    actionDateFrom: normalizeText(value.actionDateFrom),
    actionDateTo: normalizeText(value.actionDateTo),
  }
}

export function hasFinanceClaimFilters(filters: FinanceFilters): boolean {
  return Boolean(
    filters.employeeName ||
    filters.claimNumber ||
    filters.ownerDesignation ||
    filters.hodApproverEmail ||
    filters.claimDateFrom ||
    filters.claimDateTo
  )
}

export function toIstDayStart(date: string | null): string | null {
  return date ? `${date}${IST_DAY_START}` : null
}

export function toIstDayEnd(date: string | null): string | null {
  return date ? `${date}${IST_DAY_END}` : null
}
