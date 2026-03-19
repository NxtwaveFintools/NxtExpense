'use client'

import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { submitClaimAction } from '@/features/claims/actions'
import { getClaimSummaryPreview } from '@/features/claims/components/claim-summary-preview'
import { formatDate } from '@/lib/utils/date'

import type { ClaimRateSnapshot } from '@/features/claims/components/claim-summary-preview'
import type {
  CityOption,
  ClaimFormInitialValues,
  ClaimFormValues,
  SelectOption,
  VehicleType,
  WorkLocation,
  WorkLocationOption,
} from '@/features/claims/types'

type UseClaimSubmissionFormArgs = {
  allowedVehicleTypes: readonly SelectOption[]
  workLocationOptions: readonly WorkLocationOption[]
  cityOptions: readonly CityOption[]
  claimRateSnapshot: ClaimRateSnapshot
  initialValues?: ClaimFormInitialValues | null
}

function getFallbackKmLimit(
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

export function useClaimSubmissionForm({
  allowedVehicleTypes,
  workLocationOptions,
  cityOptions,
  claimRateSnapshot,
  initialValues,
}: UseClaimSubmissionFormArgs) {
  const router = useRouter()

  const isEditingReturnedClaim = Boolean(initialValues)
  const initialWorkLocation =
    initialValues?.workLocation ?? workLocationOptions[0]?.id ?? ''
  const initialVehicleType =
    initialValues?.vehicleType &&
    allowedVehicleTypes.some(
      (vehicle) => vehicle.id === initialValues.vehicleType
    )
      ? initialValues.vehicleType
      : (allowedVehicleTypes[0]?.id ?? '')

  const [workLocation, setWorkLocation] =
    useState<WorkLocation>(initialWorkLocation)
  const [claimDate, setClaimDate] = useState(
    initialValues?.claimDateIso ?? dayjs().format('YYYY-MM-DD')
  )
  const [vehicleType, setVehicleType] =
    useState<VehicleType>(initialVehicleType)
  const initialIntercityOwnVehicleUsed: boolean | null = isEditingReturnedClaim
    ? (initialValues?.intercityOwnVehicleUsed ??
      initialValues?.ownVehicleUsed ??
      null)
    : null
  const initialIntracityOwnVehicleUsed: boolean | null = isEditingReturnedClaim
    ? (initialValues?.intracityOwnVehicleUsed ??
      (initialIntercityOwnVehicleUsed
        ? true
        : (initialValues?.ownVehicleUsed ?? null)))
    : null
  const [intercityOwnVehicleUsed, setIntercityOwnVehicleUsed] = useState<
    boolean | null
  >(initialIntercityOwnVehicleUsed)
  const [intracityOwnVehicleUsed, setIntracityOwnVehicleUsed] = useState<
    boolean | null
  >(initialIntracityOwnVehicleUsed)
  const [outstationStateId, setOutstationStateId] = useState(
    initialValues?.outstationStateId ?? ''
  )
  const [outstationCityId, setOutstationCityId] = useState(
    initialValues?.outstationCityId ?? ''
  )
  const [fromCityId, setFromCityId] = useState(initialValues?.fromCityId ?? '')
  const [toCityId, setToCityId] = useState(initialValues?.toCityId ?? '')
  const [kmTravelled, setKmTravelled] = useState(
    initialValues?.kmTravelled ? String(initialValues.kmTravelled) : ''
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const todayIso = dayjs().format('YYYY-MM-DD')

  const selectedLocation = useMemo(
    () =>
      workLocationOptions.find((location) => location.id === workLocation) ??
      null,
    [workLocation, workLocationOptions]
  )

  const filteredCityOptions = useMemo(() => {
    if (!outstationStateId) {
      return []
    }

    return cityOptions.filter((city) => city.stateId === outstationStateId)
  }, [cityOptions, outstationStateId])

  const kmLimit = useMemo(() => {
    const configuredLimit =
      claimRateSnapshot.maxKmRoundTripByVehicle[vehicleType]

    if (Number.isFinite(configuredLimit) && configuredLimit > 0) {
      return configuredLimit
    }

    return getFallbackKmLimit(claimRateSnapshot.maxKmRoundTripByVehicle) ?? 0
  }, [claimRateSnapshot.maxKmRoundTripByVehicle, vehicleType])

  const hasIntercityTravel = intercityOwnVehicleUsed === true
  const hasIntracityTravel =
    intercityOwnVehicleUsed === true || intracityOwnVehicleUsed === true
  const effectiveIntracityOwnVehicleUsed = hasIntracityTravel

  const kmValidationMessage = useMemo(() => {
    const kmValue = Number.parseFloat(kmTravelled)
    const requiresOutstationDetails =
      selectedLocation?.requires_outstation_details ?? false

    if (
      !requiresOutstationDetails ||
      intercityOwnVehicleUsed !== true ||
      !Number.isFinite(kmValue)
    ) {
      return null
    }

    if (kmLimit > 0 && kmValue > kmLimit) {
      return `KM travelled cannot exceed ${kmLimit}.`
    }

    return null
  }, [intercityOwnVehicleUsed, kmLimit, kmTravelled, selectedLocation])

  const summary = useMemo(() => {
    return getClaimSummaryPreview({
      workLocation,
      requiresVehicleSelection:
        selectedLocation?.requires_vehicle_selection ?? false,
      requiresOutstationDetails:
        selectedLocation?.requires_outstation_details ?? false,
      hasIntercityTravel,
      hasIntracityTravel,
      intercityOwnVehicleUsed: hasIntercityTravel,
      intracityOwnVehicleUsed: effectiveIntracityOwnVehicleUsed,
      vehicleType,
      vehicleTypeName:
        allowedVehicleTypes.find((vehicle) => vehicle.id === vehicleType)
          ?.name ?? '',
      kmTravelled,
      foodWithPrincipalsAmount: '',
      claimRateSnapshot,
    })
  }, [
    workLocation,
    selectedLocation,
    hasIntercityTravel,
    hasIntracityTravel,
    effectiveIntracityOwnVehicleUsed,
    kmTravelled,
    vehicleType,
    allowedVehicleTypes,
    claimRateSnapshot,
  ])

  function handleIntercityOwnVehicleUsedChange(value: boolean) {
    setIntercityOwnVehicleUsed(value)

    if (value) {
      setIntracityOwnVehicleUsed(null)
      setOutstationCityId('')
      return
    }

    setFromCityId('')
    setToCityId('')
    setKmTravelled('')
    setIntracityOwnVehicleUsed(null)
    setOutstationStateId('')
    setOutstationCityId('')
  }

  function handleIntracityOwnVehicleUsedChange(value: boolean) {
    setIntracityOwnVehicleUsed(value)

    if (!value) {
      setOutstationCityId('')

      if (intercityOwnVehicleUsed !== true) {
        setOutstationStateId('')
      }

      return
    }

    if (intercityOwnVehicleUsed === true) {
      setIntercityOwnVehicleUsed(false)
      setKmTravelled('')
      setFromCityId('')
      setToCityId('')
    }
  }

  function handleOutstationStateChange(value: string) {
    setOutstationStateId(value)
    setOutstationCityId('')
    setFromCityId('')
    setToCityId('')
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
      intracityOwnVehicleUsed === null
    ) {
      const message =
        'Please select whether you travelled within the city using your own vehicle.'
      setError(message)
      toast.error(message)
      return
    }

    setIsSubmitting(true)
    setError(null)

    const intercitySelection = requiresOutstationDetails
      ? intercityOwnVehicleUsed
      : null
    const intracitySelection = requiresOutstationDetails
      ? intercityOwnVehicleUsed === true
        ? true
        : intracityOwnVehicleUsed
      : null

    const isIntercityOwnVehicle = intercitySelection === true
    const isIntracityOwnVehicle = intracitySelection === true
    const hasOutstationOwnVehicle =
      isIntercityOwnVehicle || isIntracityOwnVehicle

    const isOutstationIntercity = isIntercityOwnVehicle
    const isOutstationIntracity = isIntracityOwnVehicle
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
      intercityOwnVehicleUsed:
        requiresOutstationDetails && intercitySelection !== null
          ? intercitySelection
          : undefined,
      intracityOwnVehicleUsed:
        requiresOutstationDetails && intracitySelection !== null
          ? intracitySelection
          : undefined,
      vehicleType:
        requiresVehicleSelection || isOutstationOwnVehicle
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
      router.replace('/claims')
    } catch {
      const message = 'Unexpected error while submitting claim.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    isEditingReturnedClaim,
    workLocation,
    claimDate,
    vehicleType,
    hasIntercityTravel,
    hasIntracityTravel,
    intercityOwnVehicleUsed,
    intracityOwnVehicleUsed,
    outstationStateId,
    outstationCityId,
    fromCityId,
    toCityId,
    kmTravelled,
    kmLimit,
    error,
    isSubmitting,
    todayIso,
    selectedLocation,
    filteredCityOptions,
    kmValidationMessage,
    summary,
    setWorkLocation,
    setClaimDate,
    setVehicleType,
    setOutstationCityId,
    setFromCityId,
    setToCityId,
    setKmTravelled,
    handleIntercityOwnVehicleUsedChange,
    handleIntracityOwnVehicleUsedChange,
    handleOutstationStateChange,
    handleSubmit,
  }
}
