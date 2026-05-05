import type { Metadata } from 'next'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { VehicleTypeTable } from '@/features/admin/components/vehicle-type-table'

export const metadata: Metadata = { title: 'Admin Vehicle Types' }

export default async function AdminVehicleTypesPage() {
  const supabase = await createSupabaseServerClient()

  const { data: vehicleTypes, error } = await supabase
    .from('vehicle_types')
    .select(
      'id, vehicle_code, vehicle_name, base_fuel_rate_per_day, intercity_rate_per_km, max_km_round_trip, display_order, is_active'
    )
    .order('display_order')

  if (error) throw new Error(error.message)

  const rows = (vehicleTypes ?? []).map((vt) => ({
    ...vt,
    base_fuel_rate_per_day: Number(vt.base_fuel_rate_per_day ?? 0),
    intercity_rate_per_km: Number(vt.intercity_rate_per_km ?? 0),
    max_km_round_trip: Number(vt.max_km_round_trip ?? 0),
  }))

  const activeCount = rows.filter((vt) => vt.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Vehicle Types</h2>
        <span className="text-sm text-foreground/50">
          {activeCount} active / {rows.length} total
        </span>
      </div>

      <VehicleTypeTable vehicleTypes={rows} />
    </div>
  )
}
