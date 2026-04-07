'use client'

import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { createClaimSubmitHandler } from '@/features/claims/components/claim-submission-submit'
import { createTravelSelectionHandlers } from '@/features/claims/components/claim-submission-travel-handlers'
import { getClaimSummaryPreview } from '@/features/claims/components/claim-summary-preview'
import {
  fetchCitiesByState,
  getFallbackKmLimit,
  resolveDefaultBaseLocationDayTypeCode,
} from '@/features/claims/components/claim-submission-form-utils'

import type { ClaimRateSnapshot } from '@/features/claims/components/claim-summary-preview'
import type {
  BaseLocationDayTypeOption,
  CityOption,
  ClaimFormInitialValues,
  IntracityVehicleMode,
  SelectOption,
  VehicleType,
  WorkLocation,
  WorkLocationOption,
} from '@/features/claims/types'

type UseClaimSubmissionFormArgs = {
  allowedVehicleTypes: readonly SelectOption[]
  baseLocationDayTypeOptions: readonly BaseLocationDayTypeOption[]
  workLocationOptions: readonly WorkLocationOption[]
  claimRateSnapshot: ClaimRateSnapshot
  initialValues?: ClaimFormInitialValues | null
}

export function useClaimSubmissionForm({
  allowedVehicleTypes,
  baseLocationDayTypeOptions,
  workLocationOptions,
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
  const defaultBaseLocationDayTypeCode = resolveDefaultBaseLocationDayTypeCode(
    baseLocationDayTypeOptions
  )
  const [baseLocationDayTypeCode, setBaseLocationDayTypeCode] = useState(
    initialValues?.baseLocationDayTypeCode ?? defaultBaseLocationDayTypeCode
  )
  const [vehicleType, setVehicleType] =
    useState<VehicleType>(initialVehicleType)
  const initialIntercityOwnVehicleUsed: boolean | null = isEditingReturnedClaim
    ? (initialValues?.intercityOwnVehicleUsed ??
      initialValues?.ownVehicleUsed ??
      null)
    : null
  const initialIntracityTravelUsed: boolean | null = isEditingReturnedClaim
    ? (initialValues?.intracityTravelUsed ??
      initialValues?.hasIntracityTravel ??
      (initialIntercityOwnVehicleUsed ? true : null))
    : null
  const initialIntracityVehicleMode: IntracityVehicleMode | null =
    isEditingReturnedClaim
      ? (initialValues?.intracityVehicleMode ??
        (initialValues?.intracityOwnVehicleUsed === true
          ? 'OWN_VEHICLE'
          : initialValues?.hasIntracityTravel
            ? 'RENTAL_VEHICLE'
            : null))
      : null
  const [intercityOwnVehicleUsed, setIntercityOwnVehicleUsed] = useState<
    boolean | null
  >(initialIntercityOwnVehicleUsed)
  const [intracityTravelUsed, setIntracityTravelUsed] = useState<
    boolean | null
  >(initialIntracityTravelUsed)
  const [intracityVehicleMode, setIntracityVehicleMode] =
    useState<IntracityVehicleMode | null>(initialIntracityVehicleMode)
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

  const citiesQuery = useQuery<CityOption[], Error>({
    queryKey: ['cities', outstationStateId],
    queryFn: () => fetchCitiesByState(outstationStateId),
    enabled: Boolean(outstationStateId),
    staleTime: 5 * 60 * 1000,
  })

  const filteredCityOptions = citiesQuery.data ?? []

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
    intercityOwnVehicleUsed === true || intracityTravelUsed === true
  const effectiveIntracityOwnVehicleUsed =
    hasIntercityTravel ||
    (hasIntracityTravel && intracityVehicleMode === 'OWN_VEHICLE')

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
      baseLocationDayTypeCode,
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
    baseLocationDayTypeCode,
    hasIntercityTravel,
    hasIntracityTravel,
    effectiveIntracityOwnVehicleUsed,
    kmTravelled,
    vehicleType,
    allowedVehicleTypes,
    claimRateSnapshot,
  ])

  const {
    handleIntercityOwnVehicleUsedChange,
    handleIntracityTravelUsedChange,
    handleIntracityVehicleModeChange,
    handleOutstationStateChange,
  } = createTravelSelectionHandlers({
    intercityOwnVehicleUsed,
    setIntercityOwnVehicleUsed,
    setIntracityTravelUsed,
    setIntracityVehicleMode,
    setOutstationCityId,
    setOutstationStateId,
    setFromCityId,
    setToCityId,
    setKmTravelled,
  })

  const handleSubmit = createClaimSubmitHandler({
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
    onSuccessNavigate: () => {
      router.replace('/claims')
    },
  })

  return {
    isEditingReturnedClaim,
    workLocation,
    claimDate,
    baseLocationDayTypeCode,
    vehicleType,
    hasIntercityTravel,
    hasIntracityTravel,
    intercityOwnVehicleUsed,
    intracityTravelUsed,
    intracityVehicleMode,
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
    setBaseLocationDayTypeCode,
    setVehicleType,
    setOutstationCityId,
    setFromCityId,
    setToCityId,
    setKmTravelled,
    handleIntercityOwnVehicleUsedChange,
    handleIntracityTravelUsedChange,
    handleIntracityVehicleModeChange,
    handleOutstationStateChange,
    handleSubmit,
  }
}
