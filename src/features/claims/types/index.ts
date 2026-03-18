import type { PaginatedResult } from '@/lib/utils/pagination'
import type { WorkLocation as ConfigWorkLocation } from '@/lib/services/config-service'

export type WorkLocation = string
export type VehicleType = string
export type TransportType = string
export type ClaimStatusId = string
export type ExpenseItemType = string

/** A simple { id, name } option for select dropdowns */
export type SelectOption = { id: string; name: string }

/** City dropdown option with parent state linkage for dynamic filtering */
export type CityOption = SelectOption & { stateId: string }

/** Full DB-backed work location object with behavioral flags */
export type WorkLocationOption = ConfigWorkLocation

export type Claim = {
  id: string
  claim_number: string
  employee_id: string
  claim_date: string
  work_location: WorkLocation
  own_vehicle_used: boolean | null
  vehicle_type: VehicleType | null
  outstation_state_id?: string | null
  outstation_city_id: string | null
  from_city_id: string | null
  to_city_id: string | null
  outstation_state_name?: string | null
  outstation_city_name: string | null
  from_city_name: string | null
  to_city_name: string | null
  km_travelled: number | null
  total_amount: number
  statusName: string
  statusDisplayColor: string
  status_id: string
  is_terminal: boolean
  is_rejection: boolean
  allow_resubmit: boolean
  is_superseded: boolean
  current_approval_level: number | null
  submitted_at: string | null
  created_at: string
  updated_at: string
  resubmission_count: number
  last_rejection_notes: string | null
  last_rejected_at: string | null
  accommodation_nights: number | null
  food_with_principals_amount: number | null
}

export type ClaimItem = {
  id: string
  claim_id: string
  item_type: ExpenseItemType
  description: string | null
  amount: number
  created_at: string
}

export type ClaimWithItems = {
  claim: Claim
  items: ClaimItem[]
}

export type ClaimFormValues = {
  claimDate: string
  workLocation: WorkLocation
  ownVehicleUsed?: boolean
  vehicleType?: VehicleType
  transportType?: TransportType
  outstationStateId?: string
  outstationCityId?: string
  fromCityId?: string
  toCityId?: string
  kmTravelled?: number
  taxiAmount?: number
  accommodationNights?: number
  foodWithPrincipalsAmount?: number
}

export type ClaimFormInitialValues = {
  claimDateIso: string
  workLocation: WorkLocation
  vehicleType?: VehicleType | null
  ownVehicleUsed?: boolean | null
  transportType?: TransportType | null
  outstationStateId?: string | null
  outstationCityId?: string | null
  fromCityId?: string | null
  toCityId?: string | null
  kmTravelled?: number | null
  taxiAmount?: number | null
  accommodationNights?: number | null
  foodWithPrincipalsAmount?: number | null
}

export type ClaimStatusCatalogItem = {
  status_id: ClaimStatusId
  display_label: string
  is_terminal: boolean
  sort_order: number
  color_token: string
  description: string | null
}

export type ClaimAvailableAction = {
  action: string
  display_label: string
  require_notes: boolean
  supports_allow_resubmit: boolean
  actor_scope: 'employee' | 'approver' | 'finance' | 'admin'
}

export type ClaimHistoryEntry = {
  id: string
  claim_id: string
  approver_email: string
  approver_name: string | null
  approval_level: number | null
  action: string
  notes: string | null
  rejection_notes: string | null
  allow_resubmit: boolean | null
  bypass_reason: string | null
  skipped_levels: number[] | null
  reason: string | null
  acted_at: string
}

export type PaginatedClaims = PaginatedResult<Claim>

export type MyClaimsFilters = {
  claimStatus: ClaimStatusId | null
  workLocation: string | null
  claimDate: string | null
}
