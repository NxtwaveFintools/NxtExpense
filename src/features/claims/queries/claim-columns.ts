import type { Claim } from '@/features/claims/types'
import { getClaimStatusDisplay } from '@/lib/utils/claim-status'

const LEGACY_CLAIM_COLUMNS =
  'id, claim_number, employee_id, claim_date, work_location_id, work_locations(location_name), expense_location_id, expense_locations(location_name, region_code), own_vehicle_used, vehicle_type_id, vehicle_types(vehicle_name), outstation_state_id, outstation_city_id, from_city_id, to_city_id, outstation_state:states!outstation_state_id(state_name), outstation_city:cities!outstation_city_id(city_name), from_city_data:cities!from_city_id(city_name), to_city_data:cities!to_city_id(city_name), km_travelled, total_amount, status_id, claim_statuses!status_id(status_code, status_name, display_color, allow_resubmit_status_name, allow_resubmit_display_color, is_terminal, is_rejection), allow_resubmit, is_superseded, current_approval_level, submitted_at, created_at, updated_at, resubmission_count, last_rejection_notes, last_rejected_at, accommodation_nights, food_with_principals_amount'

const SEGMENT_CLAIM_COLUMNS =
  'has_intercity_travel, has_intracity_travel, intercity_own_vehicle_used, intracity_own_vehicle_used, intracity_vehicle_mode'
const BASE_DAY_TYPE_CLAIM_COLUMNS = 'base_location_day_type_code'

export const CLAIM_COLUMNS = `${LEGACY_CLAIM_COLUMNS}, ${SEGMENT_CLAIM_COLUMNS}, ${BASE_DAY_TYPE_CLAIM_COLUMNS}`

// Maps raw Supabase FK join row to flat Claim type
export function mapClaimRow(raw: Record<string, unknown>): Claim {
  const r = raw as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const statusInfo = Array.isArray(r.claim_statuses)
    ? r.claim_statuses[0]
    : r.claim_statuses
  const statusCode = statusInfo?.status_code
  const statusDisplay = getClaimStatusDisplay({
    statusCode,
    statusName: statusInfo?.status_name,
    statusDisplayColor: statusInfo?.display_color,
    allowResubmit: Boolean(r.allow_resubmit),
    allowResubmitStatusName: statusInfo?.allow_resubmit_status_name,
    allowResubmitDisplayColor: statusInfo?.allow_resubmit_display_color,
  })
  const outstationCity = Array.isArray(r.outstation_city)
    ? r.outstation_city[0]
    : r.outstation_city
  const expenseLocation = Array.isArray(r.expense_locations)
    ? r.expense_locations[0]
    : r.expense_locations
  const outstationState = Array.isArray(r.outstation_state)
    ? r.outstation_state[0]
    : r.outstation_state
  const fromCityObj = Array.isArray(r.from_city_data)
    ? r.from_city_data[0]
    : r.from_city_data
  const toCityObj = Array.isArray(r.to_city_data)
    ? r.to_city_data[0]
    : r.to_city_data
  return {
    ...r,
    has_intercity_travel: r.has_intercity_travel ?? false,
    has_intracity_travel: r.has_intracity_travel ?? false,
    intercity_own_vehicle_used: r.intercity_own_vehicle_used ?? null,
    intracity_own_vehicle_used: r.intracity_own_vehicle_used ?? null,
    intracity_vehicle_mode: r.intracity_vehicle_mode ?? null,
    base_location_day_type_code: r.base_location_day_type_code ?? null,
    allow_resubmit: r.allow_resubmit ?? false,
    is_superseded: r.is_superseded ?? false,
    statusName: statusDisplay.label,
    statusDisplayColor: statusDisplay.colorToken,
    is_terminal: statusInfo?.is_terminal ?? false,
    is_rejection: statusInfo?.is_rejection ?? false,
    outstation_state_name: outstationState?.state_name ?? null,
    work_location: r.work_locations?.location_name ?? '',
    expense_location_name: expenseLocation?.location_name ?? null,
    expense_region_code: expenseLocation?.region_code ?? null,
    vehicle_type: r.vehicle_types?.vehicle_name ?? null,
    outstation_city_name: outstationCity?.city_name ?? null,
    from_city_name: fromCityObj?.city_name ?? null,
    to_city_name: toCityObj?.city_name ?? null,
  } as Claim
}
