import type { VehicleType } from '@/features/claims/types'

export type ClaimRateSnapshot = {
  foodBaseDaily: number | null
  foodOutstationDaily: number | null
  fuelBaseDailyByVehicle: Record<string, number>
  baseDayTypeIncludeFoodByCode: Record<string, boolean>
  baseDayTypeLabelByCode: Record<string, string>
  defaultBaseDayTypeCode: string | null
  intercityPerKmByVehicle: Record<string, number>
  intracityDailyByVehicle: Record<string, number>
  maxKmRoundTripByVehicle: Record<string, number>
  foodWithPrincipalsMax: number | null
}

type ClaimSummaryPreviewInput = {
  workLocation: string
  requiresVehicleSelection: boolean
  requiresOutstationDetails: boolean
  baseLocationDayTypeCode?: string
  hasIntercityTravel: boolean
  hasIntracityTravel: boolean
  intercityOwnVehicleUsed: boolean
  intracityOwnVehicleUsed: boolean
  vehicleType: VehicleType
  vehicleTypeName: string
  kmTravelled: string
  foodWithPrincipalsAmount: string
  claimRateSnapshot: ClaimRateSnapshot
}

export function getClaimSummaryPreview({
  requiresVehicleSelection,
  requiresOutstationDetails,
  baseLocationDayTypeCode,
  hasIntercityTravel,
  hasIntracityTravel,
  intercityOwnVehicleUsed,
  intracityOwnVehicleUsed,
  vehicleType,
  vehicleTypeName,
  kmTravelled,
  foodWithPrincipalsAmount,
  claimRateSnapshot,
}: ClaimSummaryPreviewInput) {
  const kmValue = Number.parseFloat(kmTravelled)
  const parsedKm = Number.isFinite(kmValue) ? kmValue : 0
  const parsedFwpAmount = Number.parseFloat(foodWithPrincipalsAmount)
  const fwpAmount =
    Number.isFinite(parsedFwpAmount) && parsedFwpAmount > 0
      ? parsedFwpAmount
      : 0

  if (requiresOutstationDetails) {
    const items: { label: string; amount: number }[] = []
    const foodAllowance = claimRateSnapshot.foodOutstationDaily ?? 0
    items.push({ label: 'Food allowance', amount: foodAllowance })

    const includesIntracityAllowance = hasIntercityTravel || hasIntracityTravel
    const isRentalIntracityTravel =
      hasIntracityTravel && !hasIntercityTravel && !intracityOwnVehicleUsed

    if (hasIntercityTravel && intercityOwnVehicleUsed) {
      const intercityRate =
        claimRateSnapshot.intercityPerKmByVehicle[vehicleType] ?? 0
      const intercityAmount = parsedKm * intercityRate
      items.push({
        label: `Intercity travel (${parsedKm.toFixed(2)} KM @ ${intercityRate.toFixed(2)}/KM)`,
        amount: intercityAmount,
      })
    }

    if (includesIntracityAllowance) {
      const intracityAmount =
        claimRateSnapshot.intracityDailyByVehicle[vehicleType] ?? 0
      items.push({
        label: isRentalIntracityTravel
          ? `${vehicleTypeName} fixed intra-city fuel allowance (rented vehicle travel)`
          : `${vehicleTypeName} fixed intra-city fuel allowance`,
        amount: intracityAmount,
      })
    }

    // Food with Principals
    if (fwpAmount > 0 && claimRateSnapshot.foodWithPrincipalsMax) {
      const cappedAmount = Math.min(
        fwpAmount,
        claimRateSnapshot.foodWithPrincipalsMax
      )
      items.push({ label: 'Food with Principals', amount: cappedAmount })
    }

    const total = items.reduce((sum, item) => sum + item.amount, 0)
    return { items, total }
  }

  if (requiresVehicleSelection) {
    const selectedDayTypeCode =
      baseLocationDayTypeCode ?? claimRateSnapshot.defaultBaseDayTypeCode
    const includeFoodAllowance = selectedDayTypeCode
      ? (claimRateSnapshot.baseDayTypeIncludeFoodByCode[selectedDayTypeCode] ??
        true)
      : true
    const selectedDayTypeLabel = selectedDayTypeCode
      ? (claimRateSnapshot.baseDayTypeLabelByCode[selectedDayTypeCode] ??
        'Full Day')
      : 'Full Day'

    const foodAllowance = claimRateSnapshot.foodBaseDaily ?? 0
    const fuelAllowance =
      claimRateSnapshot.fuelBaseDailyByVehicle[vehicleType] ?? 0

    const items: { label: string; amount: number }[] = []

    if (includeFoodAllowance) {
      items.push({ label: 'Food allowance', amount: foodAllowance })
    }

    items.push({
      label: includeFoodAllowance
        ? `${vehicleTypeName} fuel allowance`
        : `${vehicleTypeName} fuel allowance (${selectedDayTypeLabel})`,
      amount: fuelAllowance,
    })

    const total = items.reduce((sum, item) => sum + item.amount, 0)

    return {
      items,
      total,
    }
  }

  return {
    items: [
      { label: 'No reimbursable items for selected work location.', amount: 0 },
    ],
    total: 0,
  }
}
