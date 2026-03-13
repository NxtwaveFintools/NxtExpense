'use client'

import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Calendar, Loader2, MapPin } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { submitClaimAction } from '@/features/claims/actions'
import { BaseLocationFields } from '@/features/claims/components/base-location-fields'
import { OutstationFields } from '@/features/claims/components/outstation-fields'
import { ClaimSummaryCard } from '@/features/claims/components/claim-summary-card'
import {
  getClaimSummaryPreview,
  type ClaimRateSnapshot,
} from '@/features/claims/components/claim-summary-preview'
import { formatDate } from '@/lib/utils/date'
import type {
  ClaimFormInitialValues,
  ClaimFormValues,
  SelectOption,
  TransportType,
  VehicleType,
  WorkLocation,
  WorkLocationOption,
} from '@/features/claims/types'

type ClaimSubmissionFormProps = {
  allowedVehicleTypes: readonly SelectOption[]
  workLocationOptions: readonly WorkLocationOption[]
  transportTypeOptions: readonly SelectOption[]
  cityOptions: readonly SelectOption[]
  claimRateSnapshot: ClaimRateSnapshot
  initialValues?: ClaimFormInitialValues | null
}

export function ClaimSubmissionForm({
  allowedVehicleTypes,
  workLocationOptions,
  transportTypeOptions,
  cityOptions,
  claimRateSnapshot,
  initialValues,
}: ClaimSubmissionFormProps) {
  const isEditingReturnedClaim = Boolean(initialValues)
  const initialWorkLocation =
    initialValues?.workLocation ?? workLocationOptions[0]?.id ?? ''
  const initialVehicleType =
    initialValues?.vehicleType &&
    allowedVehicleTypes.some((vt) => vt.id === initialValues.vehicleType)
      ? initialValues.vehicleType
      : (allowedVehicleTypes[0]?.id ?? '')

  const router = useRouter()
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
  const [transportType, setTransportType] = useState<TransportType>(
    initialValues?.transportType ?? transportTypeOptions[0]?.id ?? ''
  )
  const [outstationCityId, setOutstationCityId] = useState(
    initialValues?.outstationCityId ?? ''
  )
  const [fromCityId, setFromCityId] = useState(initialValues?.fromCityId ?? '')
  const [toCityId, setToCityId] = useState(initialValues?.toCityId ?? '')
  const [kmTravelled, setKmTravelled] = useState(
    initialValues?.kmTravelled ? String(initialValues.kmTravelled) : ''
  )
  const [taxiAmount, setTaxiAmount] = useState(
    initialValues?.taxiAmount ? String(initialValues.taxiAmount) : ''
  )
  const [accommodationNights, setAccommodationNights] = useState(
    initialValues?.accommodationNights
      ? String(initialValues.accommodationNights)
      : ''
  )
  const [foodWithPrincipalsAmount, setFoodWithPrincipalsAmount] = useState(
    initialValues?.foodWithPrincipalsAmount
      ? String(initialValues.foodWithPrincipalsAmount)
      : ''
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const todayIso = dayjs().format('YYYY-MM-DD')

  const selectedLocation = useMemo(
    () => workLocationOptions.find((wl) => wl.id === workLocation) ?? null,
    [workLocation, workLocationOptions]
  )

  const summary = useMemo(() => {
    return getClaimSummaryPreview({
      workLocation,
      requiresVehicleSelection:
        selectedLocation?.requires_vehicle_selection ?? false,
      requiresOutstationDetails:
        selectedLocation?.requires_outstation_details ?? false,
      ownVehicleUsed,
      transportType,
      transportTypeName:
        transportTypeOptions.find((t) => t.id === transportType)?.name ?? '',
      vehicleType,
      vehicleTypeName:
        allowedVehicleTypes.find((v) => v.id === vehicleType)?.name ?? '',
      kmTravelled,
      taxiAmount,
      accommodationNights,
      foodWithPrincipalsAmount,
      claimRateSnapshot,
    })
  }, [
    workLocation,
    selectedLocation,
    ownVehicleUsed,
    transportType,
    kmTravelled,
    taxiAmount,
    vehicleType,
    accommodationNights,
    foodWithPrincipalsAmount,
    claimRateSnapshot,
  ])

  function handleOwnVehicleUsedChange(value: boolean) {
    setOwnVehicleUsed(value)

    if (value) {
      setTaxiAmount('')
      return
    }

    setFromCityId('')
    setToCityId('')
    setKmTravelled('')
  }

  const showFoodWithPrincipals =
    claimRateSnapshot.foodWithPrincipalsMax !== null &&
    claimRateSnapshot.foodWithPrincipalsMax > 0

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!claimDate) {
      const message = 'Claim date is required.'
      setError(message)
      toast.error(message)
      return
    }

    setIsSubmitting(true)
    setError(null)

    const kmTravelledValue = Number.parseFloat(kmTravelled)
    const taxiAmountValue = Number.parseFloat(taxiAmount)
    const accommodationNightsValue = Number.parseInt(accommodationNights, 10)
    const fwpAmountValue = Number.parseFloat(foodWithPrincipalsAmount)
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
      transportType:
        requiresOutstationDetails && !ownVehicleUsed
          ? transportType || undefined
          : undefined,
      outstationCityId: requiresOutstationDetails
        ? outstationCityId || undefined
        : undefined,
      fromCityId: isOutstationOwnVehicle ? fromCityId || undefined : undefined,
      toCityId: isOutstationOwnVehicle ? toCityId || undefined : undefined,
      kmTravelled:
        isOutstationOwnVehicle && Number.isFinite(kmTravelledValue)
          ? kmTravelledValue
          : undefined,
      taxiAmount:
        requiresOutstationDetails &&
        !ownVehicleUsed &&
        Number.isFinite(taxiAmountValue)
          ? taxiAmountValue
          : undefined,
      accommodationNights:
        requiresOutstationDetails &&
        Number.isFinite(accommodationNightsValue) &&
        accommodationNightsValue > 0
          ? accommodationNightsValue
          : undefined,
      foodWithPrincipalsAmount:
        requiresOutstationDetails &&
        showFoodWithPrincipals &&
        Number.isFinite(fwpAmountValue) &&
        fwpAmountValue > 0
          ? fwpAmountValue
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
      router.push('/claims')
      router.refresh()
    } catch {
      const message = 'Unexpected error while submitting claim.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"
    >
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">
            {isEditingReturnedClaim
              ? 'Modify And Resubmit Claim'
              : 'Submit Daily Expense Claim'}
          </h1>
          <p className="text-sm text-foreground/70">
            {isEditingReturnedClaim
              ? 'Update this returned claim and submit it again for approval.'
              : 'One claim must be submitted per calendar date.'}
          </p>
        </header>

        {error ? (
          <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <label className="space-y-2 text-sm font-medium text-foreground/80">
          <span className="inline-flex items-center gap-2">
            <Calendar className="size-4" aria-hidden="true" />
            Claim Date
          </span>
          <input
            name="claimDate"
            type="date"
            value={claimDate}
            onChange={(event) => setClaimDate(event.target.value)}
            max={todayIso}
            disabled={isEditingReturnedClaim}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="space-y-2 text-sm font-medium text-foreground/80">
          <span className="inline-flex items-center gap-2">
            <MapPin className="size-4" aria-hidden="true" />
            Work Location
          </span>
          <select
            name="workLocation"
            value={workLocation}
            onChange={(event) =>
              setWorkLocation(event.target.value as WorkLocation)
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {workLocationOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.location_name}
              </option>
            ))}
          </select>
        </label>

        {selectedLocation?.requires_vehicle_selection ? (
          <BaseLocationFields
            vehicleType={vehicleType}
            allowedVehicleTypes={allowedVehicleTypes}
            onVehicleTypeChange={setVehicleType}
          />
        ) : null}

        {selectedLocation?.requires_outstation_details ? (
          <OutstationFields
            ownVehicleUsed={ownVehicleUsed}
            vehicleType={vehicleType}
            transportType={transportType}
            outstationCityId={outstationCityId}
            fromCityId={fromCityId}
            toCityId={toCityId}
            kmTravelled={kmTravelled}
            taxiAmount={taxiAmount}
            accommodationNights={accommodationNights}
            foodWithPrincipalsAmount={foodWithPrincipalsAmount}
            allowedVehicleTypes={allowedVehicleTypes}
            transportTypeOptions={transportTypeOptions}
            cityOptions={cityOptions}
            showFoodWithPrincipals={showFoodWithPrincipals}
            onOwnVehicleUsedChange={handleOwnVehicleUsedChange}
            onVehicleTypeChange={setVehicleType}
            onTransportTypeChange={setTransportType}
            onOutstationCityIdChange={setOutstationCityId}
            onFromCityIdChange={setFromCityId}
            onToCityIdChange={setToCityId}
            onKmTravelledChange={setKmTravelled}
            onTaxiAmountChange={setTaxiAmount}
            onAccommodationNightsChange={setAccommodationNights}
            onFoodWithPrincipalsAmountChange={setFoodWithPrincipalsAmount}
          />
        ) : null}

        <div className="border-t border-border pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Submitting...
              </>
            ) : isEditingReturnedClaim ? (
              'Resubmit Claim'
            ) : (
              'Submit Claim'
            )}
          </button>
        </div>
      </section>

      <ClaimSummaryCard totalAmount={summary.total} lineItems={summary.items} />
    </form>
  )
}
