import type { Claim, ClaimHistoryEntry } from '@/features/claims/types'

type ClaimHistoryLocationContext = Pick<
  Claim,
  | 'work_location'
  | 'outstation_state_name'
  | 'outstation_city_name'
  | 'from_city_name'
  | 'to_city_name'
>

const INTERNAL_RECLAIM_PHRASES = [
  'superseded claim regression coverage',
  'rejecting with reclaim allowed',
]

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

export function formatClaimHistoryLocation(
  claim: ClaimHistoryLocationContext
): string {
  const workLocation = normalizeText(claim.work_location)
  const fromCity = normalizeText(claim.from_city_name)
  const toCity = normalizeText(claim.to_city_name)
  const outstationCity = normalizeText(claim.outstation_city_name)
  const outstationState = normalizeText(claim.outstation_state_name)

  const locationParts: string[] = []

  if (fromCity && toCity) {
    locationParts.push(`${fromCity} -> ${toCity}`)
  } else if (outstationCity && outstationState) {
    locationParts.push(`${outstationCity}, ${outstationState}`)
  } else if (outstationCity) {
    locationParts.push(outstationCity)
  } else if (outstationState) {
    locationParts.push(outstationState)
  }

  if (locationParts.length === 0) {
    return workLocation
  }

  return `${workLocation} (${locationParts.join(' | ')})`
}

export function getClaimHistoryRejectionDisplayText(
  entry: ClaimHistoryEntry
): string | null {
  if (!entry.rejection_notes) {
    return null
  }

  if (entry.allow_resubmit) {
    return null
  }

  const normalizedNotes = normalizeText(entry.rejection_notes)
  const lowerNotes = normalizedNotes.toLowerCase()

  if (INTERNAL_RECLAIM_PHRASES.some((phrase) => lowerNotes.includes(phrase))) {
    return 'Reclaim Allowed'
  }

  return `Reason: ${normalizedNotes}`
}
