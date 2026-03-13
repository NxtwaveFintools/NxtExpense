import type { TransportType, VehicleType } from '@/features/claims/types'

export type ClaimRateSnapshot = {
  foodBaseDaily: number | null
  foodOutstationDaily: number | null
  fuelBaseDailyByVehicle: Record<string, number>
  intercityPerKmByVehicle: Record<string, number>
  accommodationPerNight: number | null
  foodWithPrincipalsMax: number | null
}

type ClaimSummaryPreviewInput = {
  workLocation: string
  requiresVehicleSelection: boolean
  requiresOutstationDetails: boolean
  ownVehicleUsed: boolean
  transportType: TransportType
  transportTypeName: string
  vehicleType: VehicleType
  vehicleTypeName: string
  kmTravelled: string
  taxiAmount: string
  accommodationNights: string
  foodWithPrincipalsAmount: string
  claimRateSnapshot: ClaimRateSnapshot
}

export function getClaimSummaryPreview({
  requiresVehicleSelection,
  requiresOutstationDetails,
  ownVehicleUsed,
  transportTypeName,
  vehicleType,
  vehicleTypeName,
  kmTravelled,
  taxiAmount,
  accommodationNights,
  foodWithPrincipalsAmount,
  claimRateSnapshot,
}: ClaimSummaryPreviewInput) {
  const kmValue = Number.parseFloat(kmTravelled)
  const taxiValue = Number.parseFloat(taxiAmount)
  const parsedKm = Number.isFinite(kmValue) ? kmValue : 0
  const parsedTaxiAmount = Number.isFinite(taxiValue) ? taxiValue : 0
  const parsedAccommodationNights = Number.parseInt(accommodationNights, 10)
  const nights =
    Number.isFinite(parsedAccommodationNights) && parsedAccommodationNights > 0
      ? parsedAccommodationNights
      : 0
  const parsedFwpAmount = Number.parseFloat(foodWithPrincipalsAmount)
  const fwpAmount =
    Number.isFinite(parsedFwpAmount) && parsedFwpAmount > 0
      ? parsedFwpAmount
      : 0

  if (requiresOutstationDetails) {
    const items: { label: string; amount: number }[] = []
    const foodAllowance = claimRateSnapshot.foodOutstationDaily ?? 0
    items.push({ label: 'Food allowance', amount: foodAllowance })

    if (!ownVehicleUsed) {
      items.push({
        label: `${transportTypeName} bills`,
        amount: parsedTaxiAmount,
      })
    } else {
      const intercityRate =
        claimRateSnapshot.intercityPerKmByVehicle[vehicleType] ?? 0
      const intercityAmount = parsedKm * intercityRate
      items.push({
        label: `Intercity travel (${parsedKm.toFixed(2)} KM @ ${intercityRate.toFixed(2)}/KM)`,
        amount: intercityAmount,
      })
    }

    // Accommodation
    if (nights > 0 && claimRateSnapshot.accommodationPerNight) {
      const accommodationAmount =
        nights * claimRateSnapshot.accommodationPerNight
      items.push({
        label: `Accommodation (${nights} night${nights > 1 ? 's' : ''} @ ₹${claimRateSnapshot.accommodationPerNight})`,
        amount: accommodationAmount,
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
    const foodAllowance = claimRateSnapshot.foodBaseDaily ?? 0
    const fuelAllowance =
      claimRateSnapshot.fuelBaseDailyByVehicle[vehicleType] ?? 0

    return {
      items: [
        { label: 'Food allowance', amount: foodAllowance },
        {
          label: `${vehicleTypeName} fuel allowance`,
          amount: fuelAllowance,
        },
      ],
      total: foodAllowance + fuelAllowance,
    }
  }

  return {
    items: [
      { label: 'No reimbursable items for selected work location.', amount: 0 },
    ],
    total: 0,
  }
}
