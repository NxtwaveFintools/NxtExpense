import { Car } from 'lucide-react'

import type {
  BaseLocationDayTypeOption,
  SelectOption,
  VehicleType,
} from '@/features/claims/types'

type BaseLocationFieldsProps = {
  vehicleType: VehicleType
  baseLocationDayTypeCode: string
  baseLocationDayTypeOptions: readonly BaseLocationDayTypeOption[]
  allowedVehicleTypes: readonly SelectOption[]
  onVehicleTypeChange: (vehicleType: VehicleType) => void
  onBaseLocationDayTypeCodeChange: (dayTypeCode: string) => void
}

export function BaseLocationFields({
  vehicleType,
  baseLocationDayTypeCode,
  baseLocationDayTypeOptions,
  allowedVehicleTypes,
  onVehicleTypeChange,
  onBaseLocationDayTypeCodeChange,
}: BaseLocationFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="baseLocationDayTypeCode"
          className="text-sm font-medium text-foreground"
        >
          Day Type
        </label>
        <select
          id="baseLocationDayTypeCode"
          name="baseLocationDayTypeCode"
          value={baseLocationDayTypeCode}
          onChange={(event) =>
            onBaseLocationDayTypeCodeChange(event.target.value)
          }
          className="h-10 w-full rounded-md border border-border bg-background px-4 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        >
          {baseLocationDayTypeOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="vehicleType"
          className="text-sm font-medium text-foreground"
        >
          <span className="inline-flex items-center gap-2">
            <Car className="size-4 text-muted-foreground" aria-hidden="true" />
            Vehicle Type
          </span>
        </label>
        <select
          id="vehicleType"
          name="vehicleType"
          value={vehicleType}
          onChange={(event) =>
            onVehicleTypeChange(event.target.value as VehicleType)
          }
          className="h-10 w-full rounded-md border border-border bg-background px-4 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        >
          {allowedVehicleTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
