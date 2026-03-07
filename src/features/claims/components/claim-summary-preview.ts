import type {
  TransportType,
  VehicleType,
  WorkLocation,
} from '@/features/claims/types'

export type ClaimRateSnapshot = {
  foodBaseDaily: number | null
  foodOutstationDaily: number | null
  fuelBaseDailyByVehicle: Record<string, number>
  intercityPerKmByVehicle: Record<string, number>
}

type ClaimSummaryPreviewInput = {
  workLocation: WorkLocation
  ownVehicleUsed: boolean
  transportType: TransportType
  vehicleType: VehicleType
  kmTravelled: string
  taxiAmount: string
  claimRateSnapshot: ClaimRateSnapshot
}

export function getClaimSummaryPreview({
  workLocation,
  ownVehicleUsed,
  transportType,
  vehicleType,
  kmTravelled,
  taxiAmount,
  claimRateSnapshot,
}: ClaimSummaryPreviewInput) {
  const kmValue = Number.parseFloat(kmTravelled)
  const taxiValue = Number.parseFloat(taxiAmount)
  const parsedKm = Number.isFinite(kmValue) ? kmValue : 0
  const parsedTaxiAmount = Number.isFinite(taxiValue) ? taxiValue : 0

  if (workLocation === 'Field - Outstation') {
    if (!ownVehicleUsed) {
      const foodAllowance = claimRateSnapshot.foodOutstationDaily ?? 0
      return {
        items: [
          { label: 'Food allowance', amount: foodAllowance },
          { label: `${transportType} bills`, amount: parsedTaxiAmount },
        ],
        total: foodAllowance + parsedTaxiAmount,
      }
    }

    const foodAllowance = claimRateSnapshot.foodOutstationDaily ?? 0
    const intercityRate =
      claimRateSnapshot.intercityPerKmByVehicle[vehicleType] ?? 0
    const intercityAmount = parsedKm * intercityRate

    return {
      items: [
        { label: 'Food allowance', amount: foodAllowance },
        {
          label: `Intercity travel (${parsedKm.toFixed(2)} KM @ ${intercityRate.toFixed(2)}/KM)`,
          amount: intercityAmount,
        },
      ],
      total: foodAllowance + intercityAmount,
    }
  }

  if (workLocation === 'Field - Base Location') {
    const foodAllowance = claimRateSnapshot.foodBaseDaily ?? 0
    const fuelAllowance =
      claimRateSnapshot.fuelBaseDailyByVehicle[vehicleType] ?? 0

    return {
      items: [
        { label: 'Food allowance', amount: foodAllowance },
        {
          label: `${vehicleType} fuel allowance`,
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
