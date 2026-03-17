'use client'

import { Calendar, Loader2, MapPin, Send } from 'lucide-react'

import { BaseLocationFields } from '@/features/claims/components/base-location-fields'
import { OutstationFields } from '@/features/claims/components/outstation-fields'
import { ClaimSummaryCard } from '@/features/claims/components/claim-summary-card'
import {
  KM_UI_LIMIT,
  useClaimSubmissionForm,
} from '@/features/claims/components/use-claim-submission-form'

import type { ClaimRateSnapshot } from '@/features/claims/components/claim-summary-preview'
import type {
  CityOption,
  ClaimFormInitialValues,
  SelectOption,
  WorkLocation,
  WorkLocationOption,
} from '@/features/claims/types'

type ClaimSubmissionFormProps = {
  allowedVehicleTypes: readonly SelectOption[]
  workLocationOptions: readonly WorkLocationOption[]
  stateOptions: readonly SelectOption[]
  cityOptions: readonly CityOption[]
  claimRateSnapshot: ClaimRateSnapshot
  initialValues?: ClaimFormInitialValues | null
}

export function ClaimSubmissionForm({
  allowedVehicleTypes,
  workLocationOptions,
  stateOptions,
  cityOptions,
  claimRateSnapshot,
  initialValues,
}: ClaimSubmissionFormProps) {
  const {
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
  } = useClaimSubmissionForm({
    allowedVehicleTypes,
    workLocationOptions,
    cityOptions,
    claimRateSnapshot,
    initialValues,
  })

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
    >
      <section className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <header className="space-y-1">
          <h1 className="font-display text-xl font-bold">
            {isEditingReturnedClaim
              ? 'Modify And Resubmit Claim'
              : 'Submit Daily Expense Claim'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEditingReturnedClaim
              ? 'Update this returned claim and submit it again for approval.'
              : 'One claim must be submitted per calendar date.'}
          </p>
        </header>

        {error ? (
          <p className="rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error">
            {error}
          </p>
        ) : null}

        <label className="block space-y-2 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-foreground">
            <Calendar
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            Claim Date
          </span>
          <input
            name="claimDate"
            type="date"
            value={claimDate}
            onChange={(event) => setClaimDate(event.target.value)}
            max={todayIso}
            disabled={isEditingReturnedClaim}
            className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-60"
            required
          />
        </label>

        <label className="block space-y-2 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-foreground">
            <MapPin
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            Work Location
          </span>
          <select
            name="workLocation"
            value={workLocation}
            onChange={(event) =>
              setWorkLocation(event.target.value as WorkLocation)
            }
            className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
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
            outstationStateId={outstationStateId}
            fromCityId={fromCityId}
            toCityId={toCityId}
            kmTravelled={kmTravelled}
            kmLimit={KM_UI_LIMIT}
            kmValidationMessage={kmValidationMessage}
            allowedVehicleTypes={allowedVehicleTypes}
            stateOptions={stateOptions}
            cityOptions={filteredCityOptions}
            onOwnVehicleUsedChange={handleOwnVehicleUsedChange}
            onVehicleTypeChange={setVehicleType}
            onOutstationStateIdChange={handleOutstationStateChange}
            onFromCityIdChange={setFromCityId}
            onToCityIdChange={setToCityId}
            onKmTravelledChange={setKmTravelled}
          />
        ) : null}

        <div className="border-t border-border pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="size-4" aria-hidden="true" />
                {isEditingReturnedClaim ? 'Resubmit Claim' : 'Submit Claim'}
              </>
            )}
          </button>
        </div>
      </section>

      <ClaimSummaryCard totalAmount={summary.total} lineItems={summary.items} />
    </form>
  )
}
