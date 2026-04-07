import type {
  BaseLocationDayTypeOption,
  CityOption,
} from '@/features/claims/types'

type CityApiRow = { id: string; city_name: string; state_id: string }

export async function fetchCitiesByState(
  stateId: string
): Promise<CityOption[]> {
  const response = await fetch(
    `/api/config/cities?state_id=${encodeURIComponent(stateId)}`
  )

  if (!response.ok) {
    throw new Error('Failed to fetch cities')
  }

  const rows: CityApiRow[] = await response.json()

  return rows.map((row) => ({
    id: row.id,
    name: row.city_name,
    stateId: row.state_id,
  }))
}

export function getFallbackKmLimit(
  maxKmRoundTripByVehicle: Record<string, number>
): number | null {
  const limits = Object.values(maxKmRoundTripByVehicle).filter(
    (value) => Number.isFinite(value) && value > 0
  )

  if (limits.length === 0) {
    return null
  }

  return Math.max(...limits)
}

export function resolveDefaultBaseLocationDayTypeCode(
  baseLocationDayTypeOptions: readonly BaseLocationDayTypeOption[]
): string {
  return (
    baseLocationDayTypeOptions.find((option) => option.isDefault)?.code ??
    baseLocationDayTypeOptions[0]?.code ??
    'FULL_DAY'
  )
}
