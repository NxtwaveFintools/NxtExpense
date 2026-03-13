import { Car } from 'lucide-react'

import type { SelectOption, VehicleType } from '@/features/claims/types'

type BaseLocationFieldsProps = {
  vehicleType: VehicleType
  allowedVehicleTypes: readonly SelectOption[]
  onVehicleTypeChange: (vehicleType: VehicleType) => void
}

export function BaseLocationFields({
  vehicleType,
  allowedVehicleTypes,
  onVehicleTypeChange,
}: BaseLocationFieldsProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor="vehicleType"
        className="text-sm font-medium text-foreground/80"
      >
        <span className="inline-flex items-center gap-2">
          <Car className="size-4" aria-hidden="true" />
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
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      >
        {allowedVehicleTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.name}
          </option>
        ))}
      </select>
    </div>
  )
}
