import { toast } from 'sonner'

import { submitClaimAction } from '@/features/claims/actions'
import { formatDate } from '@/lib/utils/date'

import type {
  ClaimFormValues,
  IntracityVehicleMode,
  VehicleType,
  WorkLocation,
  WorkLocationOption,
} from '@/features/claims/types'

type CreateClaimSubmitHandlerParams = {
  claimDate: string
  kmValidationMessage: string | null
  selectedLocation: WorkLocationOption | null
  workLocation: WorkLocation
  baseLocationDayTypeCode: string
  vehicleType: VehicleType
  intercityOwnVehicleUsed: boolean | null
  intracityTravelUsed: boolean | null
  intracityVehicleMode: IntracityVehicleMode | null
  outstationStateId: string
  outstationCityId: string
  fromCityId: string
  toCityId: string
  kmTravelled: string
  setError: (value: string | null) => void
  setIsSubmitting: (value: boolean) => void
  onSuccessNavigate: () => void
}

export function createClaimSubmitHandler({
  claimDate,
  kmValidationMessage,
  selectedLocation,
  workLocation,
  baseLocationDayTypeCode,
  vehicleType,
  intercityOwnVehicleUsed,
  intracityTravelUsed,
  intracityVehicleMode,
  outstationStateId,
  outstationCityId,
  fromCityId,
  toCityId,
  kmTravelled,
  setError,
  setIsSubmitting,
  onSuccessNavigate,
}: CreateClaimSubmitHandlerParams) {
  return async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!claimDate) {
      const message = 'Claim date is required.'
      setError(message)
      toast.error(message)
      return
    }

    if (kmValidationMessage) {
      setError(kmValidationMessage)
      toast.error(kmValidationMessage)
      return
    }

    const kmTravelledValue = Number.parseFloat(kmTravelled)
    const requiresOutstationDetails =
      selectedLocation?.requires_outstation_details ?? false
    const requiresVehicleSelection =
      selectedLocation?.requires_vehicle_selection ?? false

    if (requiresOutstationDetails && intercityOwnVehicleUsed === null) {
      const message =
        'Please select whether you travelled between cities using your own vehicle.'
      setError(message)
      toast.error(message)
      return
    }

    if (
      requiresOutstationDetails &&
      intercityOwnVehicleUsed === false &&
      intracityTravelUsed === null
    ) {
      const message =
        'Please select whether you travelled within the city using your own vehicle/rental vehicle.'
      setError(message)
      toast.error(message)
      return
    }

    setIsSubmitting(true)
    setError(null)

    const intercitySelection = requiresOutstationDetails
      ? intercityOwnVehicleUsed
      : null
    const intracitySelection =
      requiresOutstationDetails && intercityOwnVehicleUsed === true
        ? true
        : requiresOutstationDetails
          ? intracityTravelUsed
          : null

    if (
      requiresOutstationDetails &&
      intercitySelection === false &&
      intracitySelection === true &&
      intracityVehicleMode === null
    ) {
      const message =
        'Please select the vehicle type used within the city (Own Vehicle or Rent Vehicle).'
      setError(message)
      toast.error(message)
      setIsSubmitting(false)
      return
    }

    const effectiveIntracityVehicleMode =
      requiresOutstationDetails && intracitySelection === true
        ? intercitySelection === true
          ? 'OWN_VEHICLE'
          : intracityVehicleMode
        : null

    const isIntercityOwnVehicle = intercitySelection === true
    const isIntracityOwnVehicle =
      intracitySelection === true &&
      effectiveIntracityVehicleMode === 'OWN_VEHICLE'
    const hasOutstationOwnVehicle =
      isIntercityOwnVehicle || isIntracityOwnVehicle

    const isOutstationIntercity = intercitySelection === true
    const isOutstationIntracity = intracitySelection === true
    const isOutstationOwnVehicle = hasOutstationOwnVehicle

    const derivedOutstationCityId = isOutstationIntracity
      ? isOutstationIntercity
        ? toCityId
        : outstationCityId
      : ''
    const outstationState =
      isOutstationIntercity || isOutstationIntracity ? outstationStateId : ''

    const payload: ClaimFormValues = {
      claimDate: formatDate(claimDate),
      workLocation,
      baseLocationDayTypeCode: requiresVehicleSelection
        ? baseLocationDayTypeCode
        : undefined,
      ownVehicleUsed: requiresOutstationDetails
        ? isOutstationOwnVehicle
        : undefined,
      hasIntercityTravel:
        requiresOutstationDetails && intercitySelection !== null
          ? isOutstationIntercity
          : undefined,
      hasIntracityTravel:
        requiresOutstationDetails && intracitySelection !== null
          ? isOutstationIntracity
          : undefined,
      intracityTravelUsed:
        requiresOutstationDetails && intracitySelection !== null
          ? intracitySelection
          : undefined,
      intercityOwnVehicleUsed:
        requiresOutstationDetails && intercitySelection !== null
          ? intercitySelection
          : undefined,
      intracityOwnVehicleUsed:
        requiresOutstationDetails && intracitySelection !== null
          ? isIntracityOwnVehicle
          : undefined,
      intracityVehicleMode:
        requiresOutstationDetails && intracitySelection === true
          ? (effectiveIntracityVehicleMode ?? undefined)
          : undefined,
      vehicleType:
        requiresVehicleSelection ||
        isOutstationIntercity ||
        isOutstationIntracity
          ? vehicleType || undefined
          : undefined,
      outstationStateId: requiresOutstationDetails
        ? outstationState || undefined
        : undefined,
      outstationCityId: isOutstationIntracity
        ? derivedOutstationCityId || undefined
        : undefined,
      fromCityId: isOutstationIntercity ? fromCityId || undefined : undefined,
      toCityId: isOutstationIntercity ? toCityId || undefined : undefined,
      kmTravelled:
        isIntercityOwnVehicle && Number.isFinite(kmTravelledValue)
          ? kmTravelledValue
          : undefined,
    }

    try {
      const result = await submitClaimAction(payload)

      if (!result.ok) {
        setError(result.error)
        toast.error(result.error ?? 'Unable to submit claim.')
        return
      }

      toast.success(
        result.claimNumber
          ? `Claim submitted successfully (${result.claimNumber}).`
          : 'Claim submitted successfully.'
      )
      onSuccessNavigate()
    } catch {
      const message = 'Unexpected error while submitting claim.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }
}
