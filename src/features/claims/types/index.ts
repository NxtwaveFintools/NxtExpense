import type { PaginatedResult } from '@/lib/utils/pagination'

export type WorkLocation = string
export type VehicleType = string
export type TransportType = string
export type ClaimStatus = string
export type ExpenseItemType = string

export const WORK_LOCATION_FILTER_VALUES = [
  'Office / WFH',
  'Field - Base Location',
  'Field - Outstation',
  'Leave',
  'Week-off',
] as const

export type WorkLocationFilter = (typeof WORK_LOCATION_FILTER_VALUES)[number]

export type Claim = {
  id: string
  claim_number: string
  employee_id: string
  claim_date: string
  work_location: WorkLocation
  own_vehicle_used: boolean | null
  vehicle_type: VehicleType | null
  outstation_location: string | null
  from_city: string | null
  to_city: string | null
  km_travelled: number | null
  total_amount: number
  status: ClaimStatus
  current_approval_level: number | null
  submitted_at: string | null
  created_at: string
  updated_at: string
  tenant_id: string
  resubmission_count: number
  last_rejection_notes: string | null
  last_rejected_by_email: string | null
  last_rejected_at: string | null
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
  outstationLocation?: string
  fromCity?: string
  toCity?: string
  kmTravelled?: number
  taxiAmount?: number
}

export type ClaimFormInitialValues = {
  claimDateIso: string
  workLocation: WorkLocation
  vehicleType?: VehicleType | null
  ownVehicleUsed?: boolean | null
  transportType?: TransportType | null
  outstationLocation?: string | null
  fromCity?: string | null
  toCity?: string | null
  kmTravelled?: number | null
  taxiAmount?: number | null
}

export type ClaimStatusCatalogItem = {
  status: ClaimStatus
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
  claimStatus: ClaimStatus | null
  workLocation: WorkLocationFilter | null
  claimDateFrom: string | null
  claimDateTo: string | null
  resubmittedOnly: boolean
}
