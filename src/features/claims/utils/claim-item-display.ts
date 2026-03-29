import type { Claim, ClaimItem } from '@/features/claims/types'

type ClaimItemPresentation = {
  label: string
  detail: string | null
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  food: 'Food allowance',
  fuel: 'Fixed fuel allowance',
  intercity_travel: 'Inter-city travel reimbursement',
  intracity_allowance: 'Rented/Own Fuel Allowance',
  taxi_bill: 'Taxi bill reimbursement',
  accommodation: 'Accommodation allowance',
  food_with_principals: 'Food with principals allowance',
}

function titleCaseWords(value: string): string {
  return value
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`)
    .join(' ')
}

function resolveDefaultLabel(itemType: string): string {
  const configured = ITEM_TYPE_LABELS[itemType]
  if (configured) {
    return configured
  }

  return titleCaseWords(itemType.replaceAll('_', ' '))
}

function resolveIntracityModeQualifier(claim: Claim): string {
  const ownVehicleMode =
    claim.has_intercity_travel === true ||
    claim.intracity_vehicle_mode === 'OWN_VEHICLE' ||
    claim.intracity_own_vehicle_used === true

  return ownVehicleMode ? 'own vehicle travel' : 'rented vehicle travel'
}

function resolveIntracityAllowanceDetail(
  claim: Claim,
  description: string | null
): string {
  const qualifier = resolveIntracityModeQualifier(claim)
  const normalizedDescription = description?.trim() ?? ''

  if (!normalizedDescription) {
    const vehicleName = claim.vehicle_type ?? 'Selected vehicle'
    return `${vehicleName} fixed intra-city fuel allowance (${qualifier})`
  }

  const lowerDescription = normalizedDescription.toLowerCase()
  if (
    lowerDescription.includes('own vehicle travel') ||
    lowerDescription.includes('rented vehicle travel')
  ) {
    return normalizedDescription
  }

  return `${normalizedDescription} (${qualifier})`
}

export function getClaimItemPresentation(
  claim: Claim,
  item: ClaimItem
): ClaimItemPresentation {
  if (item.item_type === 'intracity_allowance') {
    return {
      label: ITEM_TYPE_LABELS.intracity_allowance,
      detail: resolveIntracityAllowanceDetail(claim, item.description),
    }
  }

  return {
    label: resolveDefaultLabel(item.item_type),
    detail: item.description?.trim() || null,
  }
}
