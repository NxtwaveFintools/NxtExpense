export type AdminAnalyticsDateField = 'travel_date' | 'submission_date'

type AdminAnalyticsKpi = {
  total_count: number
  total_amount: number
  avg_amount: number
  pending_count: number
  pending_amount: number
  payment_released_count: number
  payment_released_amount: number
  rejected_count: number
  rejected_amount: number
  rejected_without_reclaim_count?: number
  rejected_without_reclaim_amount?: number
  rejected_allow_reclaim_count?: number
  rejected_allow_reclaim_amount?: number
}

type AdminStatusBreakdown = {
  status_name: string
  claim_count: number
  total_amount: number
}

type AdminDesignationBreakdown = {
  designation_name: string
  claim_count: number
  total_amount: number
  avg_amount: number
}

type AdminWorkLocationBreakdown = {
  location_name: string
  claim_count: number
  total_amount: number
}

type AdminStateBreakdown = {
  state_name: string
  claim_count: number
  total_amount: number
}

type AdminVehicleTypeBreakdown = {
  vehicle_name: string
  claim_count: number
  total_amount: number
}

type AdminTopClaim = {
  claim_id: string
  claim_number: string | null
  employee_id: string
  employee_name: string
  claim_date: string
  submitted_at: string | null
  status_name: string
  total_amount: number
}

export type AdminDashboardAnalytics = {
  kpi: AdminAnalyticsKpi
  by_status: AdminStatusBreakdown[]
  by_designation: AdminDesignationBreakdown[]
  by_work_location: AdminWorkLocationBreakdown[]
  by_state: AdminStateBreakdown[]
  by_vehicle_type: AdminVehicleTypeBreakdown[]
  top_claims: AdminTopClaim[]
}

export type AdminAnalyticsFilters = {
  dateFilterField: AdminAnalyticsDateField
  dateFrom: string | null
  dateTo: string | null
  claimId: string | null
  designationId: string | null
  workLocationId: string | null
  stateId: string | null
  employeeId: string | null
  employeeName: string | null
  vehicleCode: string | null
  claimStatusId: string | null
  pendingOnly: boolean
}

type AdminFilterOption = {
  value: string
  label: string
}

export type AdminAnalyticsFilterOptions = {
  designations: AdminFilterOption[]
  workLocations: AdminFilterOption[]
  states: AdminFilterOption[]
  vehicleTypes: AdminFilterOption[]
  claimStatuses: AdminFilterOption[]
}

export type AdminAnalyticsClaimRow = {
  claim_id: string
  claim_number: string | null
  claim_date: string
  submitted_at: string | null
  total_amount: number
  status_name: string
  employee_id: string
  employee_name: string
}

export type AdminAnalyticsClaimsPage = {
  data: AdminAnalyticsClaimRow[]
  nextCursor: string | null
  hasNextPage: boolean
  limit: number
}
