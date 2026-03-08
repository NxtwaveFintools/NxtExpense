import type { MyClaimsFilters } from '@/features/claims/types'
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
    claimDateFrom: normalizeText(value.claimDateFrom),
    claimDateTo: normalizeText(value.claimDateTo),
    resubmittedOnly: value.resubmittedOnly,
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

  if (filters.resubmittedOnly) {
    params.set('resubmittedOnly', 'true')
  }

  return params
}
