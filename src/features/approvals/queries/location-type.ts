import type { SupabaseClient } from '@supabase/supabase-js'

import type { ApprovalLocationType } from '@/features/approvals/types'
import { getAllWorkLocations } from '@/lib/services/config-service'

export async function getLocationIdsByApprovalLocationType(
  supabase: SupabaseClient,
  locationType: ApprovalLocationType | null
): Promise<string[] | null> {
  if (!locationType) {
    return null
  }

  const workLocations = await getAllWorkLocations(supabase)

  if (locationType === 'outstation') {
    return workLocations
      .filter((location) => location.requires_outstation_details)
      .map((location) => location.id)
  }

  return workLocations
    .filter(
      (location) =>
        !location.requires_outstation_details &&
        location.requires_vehicle_selection &&
        location.allows_expenses
    )
    .map((location) => location.id)
}
