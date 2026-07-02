import type { Claim } from '@/features/claims/types'
import { getClaimStatusDisplay } from '@/lib/utils/claim-status'

const LEGACY_CLAIM_COLUMNS =
  'id, claim_number, employee_id, claim_date, work_location_id, work_locations(location_name), expense_location_id, expense_locations(location_name, region_code), own_vehicle_used, vehicle_type_id, vehicle_types(vehicle_name), outstation_state_id, outstation_city_id, from_city_id, to_city_id, outstation_state_name_snapshot, outstation_city_name_snapshot, from_city_name_snapshot, to_city_name_snapshot, km_travelled, total_amount, status_id, claim_statuses!status_id(status_code, status_name, display_color, allow_resubmit_status_name, allow_resubmit_display_color, is_terminal, is_rejection), allow_resubmit, is_superseded, current_approval_level, submitted_at, created_at, updated_at, resubmission_count, last_rejection_notes, last_rejected_at, accommodation_nights, food_with_principals_amount'

const SEGMENT_CLAIM_COLUMNS =
  'has_intercity_travel, has_intracity_travel, intercity_own_vehicle_used, intracity_own_vehicle_used, intracity_vehicle_mode'
const BASE_DAY_TYPE_CLAIM_COLUMNS = 'base_location_day_type_code'

export const CLAIM_COLUMNS = `${LEGACY_CLAIM_COLUMNS}, ${SEGMENT_CLAIM_COLUMNS}, ${BASE_DAY_TYPE_CLAIM_COLUMNS}`

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
  const expenseLocation = Array.isArray(r.expense_locations)
    ? r.expense_locations[0]
    : r.expense_locations

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
    outstation_state_name: r.outstation_state_name_snapshot as string | null,
    work_location: r.work_locations?.location_name ?? '',
    expense_location_name: expenseLocation?.location_name ?? null,
    expense_region_code: expenseLocation?.region_code ?? null,
    vehicle_type: r.vehicle_types?.vehicle_name ?? null,
    outstation_city_name: r.outstation_city_name_snapshot as string | null,
    from_city_name: r.from_city_name_snapshot as string | null,
    to_city_name: r.to_city_name_snapshot as string | null,
  } as Claim
}

// Maps one flat row from get_my_claims_page directly to a Claim — no
// PostgREST embed unwrapping needed, unlike mapClaimRow (used only by
// getClaimById/getRecentClaimsForEmployee, which still query via PostgREST
// embeds for their own single-claim/recent-list use cases).
export function mapHydratedClaimRow(raw: Record<string, unknown>): Claim {
  const r = raw as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const statusDisplay = getClaimStatusDisplay({
    statusCode: r.status_code,
    statusName: r.status_name,
    statusDisplayColor: r.status_display_color,
    allowResubmit: Boolean(r.allow_resubmit),
    allowResubmitStatusName: r.allow_resubmit_status_name,
    allowResubmitDisplayColor: r.allow_resubmit_display_color,
  })

  return {
    id: r.id,
    claim_number: r.claim_number,
    employee_id: r.employee_id,
    claim_date: r.claim_date,
    work_location: r.work_location_name ?? '',
    expense_location_id: r.expense_location_id,
    expense_location_name: r.expense_location_name,
    expense_region_code: r.expense_region_code,
    base_location_day_type_code: r.base_location_day_type_code,
    own_vehicle_used: r.own_vehicle_used,
    vehicle_type: r.vehicle_type_name,
    outstation_state_id: r.outstation_state_id,
    outstation_city_id: r.outstation_city_id,
    from_city_id: r.from_city_id,
    to_city_id: r.to_city_id,
    has_intercity_travel: r.has_intercity_travel ?? false,
    has_intracity_travel: r.has_intracity_travel ?? false,
    intercity_own_vehicle_used: r.intercity_own_vehicle_used ?? null,
    intracity_own_vehicle_used: r.intracity_own_vehicle_used ?? null,
    intracity_vehicle_mode: r.intracity_vehicle_mode,
    outstation_state_name: r.outstation_state_name_snapshot,
    outstation_city_name: r.outstation_city_name_snapshot,
    from_city_name: r.from_city_name_snapshot,
    to_city_name: r.to_city_name_snapshot,
    km_travelled: r.km_travelled,
    total_amount: r.total_amount,
    statusName: statusDisplay.label,
    statusDisplayColor: statusDisplay.colorToken,
    status_id: r.status_id,
    is_terminal: r.status_is_terminal ?? false,
    is_rejection: r.status_is_rejection ?? false,
    allow_resubmit: r.allow_resubmit ?? false,
    is_superseded: r.is_superseded ?? false,
    current_approval_level: r.current_approval_level,
    submitted_at: r.submitted_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    resubmission_count: r.resubmission_count,
    last_rejection_notes: r.last_rejection_notes,
    last_rejected_at: r.last_rejected_at,
    accommodation_nights: r.accommodation_nights,
    food_with_principals_amount: r.food_with_principals_amount,
  } as Claim
}
