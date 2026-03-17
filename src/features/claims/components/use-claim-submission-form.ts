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

export const KM_UI_LIMIT = 150

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
  const [ownVehicleUsed, setOwnVehicleUsed] = useState(
    initialValues?.ownVehicleUsed ?? true
  )
  const [outstationStateId, setOutstationStateId] = useState(
    initialValues?.outstationStateId ?? ''
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

  const kmValidationMessage = useMemo(() => {
    const kmValue = Number.parseFloat(kmTravelled)
    const requiresOutstationDetails =
      selectedLocation?.requires_outstation_details ?? false

    if (
      !requiresOutstationDetails ||
      !ownVehicleUsed ||
      !Number.isFinite(kmValue)
    ) {
      return null
    }

    if (kmValue > KM_UI_LIMIT) {
      return `KM travelled cannot exceed ${KM_UI_LIMIT}.`
    }

    return null
  }, [kmTravelled, ownVehicleUsed, selectedLocation])

  const summary = useMemo(() => {
    return getClaimSummaryPreview({
      workLocation,
      requiresVehicleSelection:
        selectedLocation?.requires_vehicle_selection ?? false,
      requiresOutstationDetails:
        selectedLocation?.requires_outstation_details ?? false,
      ownVehicleUsed,
      transportType: '',
      transportTypeName: 'Taxi',
      vehicleType,
      vehicleTypeName:
        allowedVehicleTypes.find((vehicle) => vehicle.id === vehicleType)
          ?.name ?? '',
      kmTravelled,
      taxiAmount: '',
      foodWithPrincipalsAmount: '',
      claimRateSnapshot,
    })
  }, [
    workLocation,
    selectedLocation,
    ownVehicleUsed,
    kmTravelled,
    vehicleType,
    allowedVehicleTypes,
    claimRateSnapshot,
  ])

  function handleOwnVehicleUsedChange(value: boolean) {
    setOwnVehicleUsed(value)

    if (!value) {
      setFromCityId('')
      setToCityId('')
      setKmTravelled('')
    }
  }

  function handleOutstationStateChange(value: string) {
    setOutstationStateId(value)
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

    setIsSubmitting(true)
    setError(null)

    const kmTravelledValue = Number.parseFloat(kmTravelled)
    const requiresOutstationDetails =
      selectedLocation?.requires_outstation_details ?? false
    const requiresVehicleSelection =
      selectedLocation?.requires_vehicle_selection ?? false
    const isOutstationOwnVehicle = requiresOutstationDetails && ownVehicleUsed

    const payload: ClaimFormValues = {
      claimDate: formatDate(claimDate),
      workLocation,
      ownVehicleUsed: requiresOutstationDetails ? ownVehicleUsed : undefined,
      vehicleType:
        requiresVehicleSelection || isOutstationOwnVehicle
          ? vehicleType || undefined
          : undefined,
      outstationStateId: requiresOutstationDetails
        ? outstationStateId || undefined
        : undefined,
      fromCityId: requiresOutstationDetails
        ? fromCityId || undefined
        : undefined,
      toCityId: requiresOutstationDetails ? toCityId || undefined : undefined,
      kmTravelled:
        isOutstationOwnVehicle && Number.isFinite(kmTravelledValue)
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
    ownVehicleUsed,
    outstationStateId,
    fromCityId,
    toCityId,
    kmTravelled,
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
    setFromCityId,
    setToCityId,
    setKmTravelled,
    handleOwnVehicleUsedChange,
    handleOutstationStateChange,
    handleSubmit,
  }
}
