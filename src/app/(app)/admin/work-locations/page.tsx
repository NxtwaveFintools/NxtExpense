import { createSupabaseServerClient } from '@/lib/supabase/server'
import { WorkLocationTable } from '@/features/admin/components/work-location-table'

export default async function AdminWorkLocationsPage() {
  const supabase = await createSupabaseServerClient()

  const { data: workLocations, error } = await supabase
    .from('work_locations')
    .select(
      'id, location_code, location_name, requires_vehicle_selection, requires_outstation_details, display_order, is_active'
    )
    .order('display_order')

  if (error) throw new Error(error.message)

  const activeCount = (workLocations ?? []).filter((wl) => wl.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Work Locations
        </h2>
        <span className="text-sm text-foreground/50">
          {activeCount} active / {(workLocations ?? []).length} total
        </span>
      </div>

      <WorkLocationTable workLocations={workLocations ?? []} />
    </div>
  )
}
