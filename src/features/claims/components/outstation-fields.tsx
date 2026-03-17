import { Car, MapPin, Route } from 'lucide-react'

import type { SelectOption, VehicleType } from '@/features/claims/types'

type OutstationFieldsProps = {
  ownVehicleUsed: boolean
  vehicleType: VehicleType
  outstationStateId: string
  fromCityId: string
  toCityId: string
  kmTravelled: string
  kmLimit: number
  kmValidationMessage: string | null
  allowedVehicleTypes: readonly SelectOption[]
  stateOptions: readonly SelectOption[]
  cityOptions: readonly SelectOption[]
  onOwnVehicleUsedChange: (value: boolean) => void
  onVehicleTypeChange: (value: VehicleType) => void
  onOutstationStateIdChange: (value: string) => void
  onFromCityIdChange: (value: string) => void
  onToCityIdChange: (value: string) => void
  onKmTravelledChange: (value: string) => void
}

export function OutstationFields(props: OutstationFieldsProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="outstationStateId"
          className="text-sm font-medium text-foreground"
        >
          <span className="inline-flex items-center gap-2">
            <MapPin
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            State
          </span>
        </label>
        <select
          id="outstationStateId"
          name="outstationStateId"
          value={props.outstationStateId}
          onChange={(event) =>
            props.onOutstationStateIdChange(event.target.value)
          }
          className="h-10 w-full rounded-md border border-border bg-background px-4 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        >
          <option value="">Select state...</option>
          {props.stateOptions.map((state) => (
            <option key={state.id} value={state.id}>
              {state.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-foreground">
          <span>From City</span>
          <select
            name="fromCityId"
            value={props.fromCityId}
            onChange={(event) => props.onFromCityIdChange(event.target.value)}
            disabled={!props.outstationStateId}
            className="h-10 w-full rounded-md border border-border bg-background px-4 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-60"
          >
            <option value="">
              {props.outstationStateId
                ? 'Select city...'
                : 'Select state first...'}
            </option>
            {props.cityOptions.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium text-foreground">
          <span>To City</span>
          <select
            name="toCityId"
            value={props.toCityId}
            onChange={(event) => props.onToCityIdChange(event.target.value)}
            disabled={!props.outstationStateId}
            className="h-10 w-full rounded-md border border-border bg-background px-4 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-60"
          >
            <option value="">
              {props.outstationStateId
                ? 'Select city...'
                : 'Select state first...'}
            </option>
            {props.cityOptions.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="space-y-2.5">
        <legend className="text-sm font-medium text-foreground">
          Own vehicle used?
        </legend>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => props.onOwnVehicleUsedChange(true)}
            className={`rounded-md border px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
              props.ownVehicleUsed
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-muted'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => props.onOwnVehicleUsedChange(false)}
            className={`rounded-md border px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
              !props.ownVehicleUsed
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-muted'
            }`}
          >
            No
          </button>
        </div>
      </fieldset>

      {props.ownVehicleUsed ? (
        <>
          <div className="space-y-2">
            <label
              htmlFor="vehicleTypeOutstation"
              className="text-sm font-medium text-foreground"
            >
              <span className="inline-flex items-center gap-2">
                <Car
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Vehicle Type
              </span>
            </label>
            <select
              id="vehicleTypeOutstation"
              name="vehicleType"
              value={props.vehicleType}
              onChange={(event) =>
                props.onVehicleTypeChange(event.target.value as VehicleType)
              }
              className="h-10 w-full rounded-md border border-border bg-background px-4 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            >
              {props.allowedVehicleTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <label className="block space-y-2 text-sm font-medium text-foreground">
            <span className="inline-flex items-center gap-2">
              <Route
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              KM Travelled
            </span>
            <input
              name="kmTravelled"
              type="number"
              min={0}
              max={props.kmLimit}
              step="0.1"
              value={props.kmTravelled}
              onChange={(event) =>
                props.onKmTravelledChange(event.target.value)
              }
              className="h-10 w-full rounded-md border border-border bg-background px-4 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            />
            {props.kmValidationMessage ? (
              <p className="text-xs text-error">{props.kmValidationMessage}</p>
            ) : null}
          </label>
        </>
      ) : null}
    </div>
  )
}
