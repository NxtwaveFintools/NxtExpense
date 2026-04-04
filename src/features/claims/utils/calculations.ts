import type { ExpenseItemType } from '@/features/claims/types'

type ClaimItemDraft = {
  itemType: ExpenseItemType
  amount: number
  description: string | null
}

type ClaimInput = {
  workLocation: string
  requiresVehicleSelection?: boolean
  requiresOutstationDetails?: boolean
  includeFoodAllowance?: boolean
  vehicleType?: string
  ownVehicleUsed?: boolean
  kmTravelled?: number
}

type ClaimRates = {
  foodBase?: number
  foodOutstation?: number
  fuelBase?: number
  intercityRate?: number
}

export function buildClaimItemsAndTotal(
  input: ClaimInput,
  rates: ClaimRates
): { items: ClaimItemDraft[]; total: number } {
  const items: ClaimItemDraft[] = []

  if (input.requiresVehicleSelection) {
    if (input.includeFoodAllowance !== false) {
      items.push({
        itemType: 'food',
        amount: rates.foodBase ?? 0,
        description: 'Base location food allowance',
      })
    }

    items.push({
      itemType: 'fuel',
      amount: rates.fuelBase ?? 0,
      description: `${input.vehicleType} base location fuel allowance`,
    })
  }

  if (input.requiresOutstationDetails) {
    items.push({
      itemType: 'food',
      amount: rates.foodOutstation ?? 0,
      description: 'Outstation food allowance',
    })

    if (input.ownVehicleUsed && input.kmTravelled) {
      const intercityAmount = (rates.intercityRate ?? 0) * input.kmTravelled
      items.push({
        itemType: 'intercity_travel',
        amount: intercityAmount,
        description: `${input.kmTravelled} KM @ ${rates.intercityRate}/KM`,
      })
    }
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0)
  return { items, total }
}
