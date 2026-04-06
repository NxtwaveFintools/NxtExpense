// ─── RPC Response Types ───

export type FinanceDashboardKPI = {
  total_count: number
  total_amount: number
  food_amount: number
  fuel_amount: number
  intercity_travel_amount: number
  intracity_allowance_amount: number
}

export type ExpenseTypeBreakdown = {
  expense_type: string
  total_amount: number
}

export type DesignationBreakdown = {
  designation_name: string
  total_amount: number
  avg_amount: number
  claim_count: number
}

export type WorkLocationBreakdown = {
  location_name: string
  total_amount: number
  claim_count: number
}

export type StateBreakdown = {
  state_name: string
  total_amount: number
  claim_count: number
}

export type VehicleTypeBreakdown = {
  vehicle_name: string
  total_amount: number
  claim_count: number
}

export type FinanceDashboardData = {
  kpi: FinanceDashboardKPI
  by_expense_type: ExpenseTypeBreakdown[]
  by_designation: DesignationBreakdown[]
  by_work_location: WorkLocationBreakdown[]
  by_state: StateBreakdown[]
  by_vehicle_type: VehicleTypeBreakdown[]
}

// ─── Filter Types ───

export type FinanceDashboardDateField = 'travel_date' | 'submission_date'

export type FinanceDashboardFilters = {
  dateFilterField: FinanceDashboardDateField
  dateFrom: string | null
  dateTo: string | null
  designationId: string | null
  workLocationId: string | null
  stateId: string | null
  employeeId: string | null
  employeeName: string | null
  vehicleCode: string | null
}

export type FilterOption = {
  value: string
  label: string
}

export type FinanceDashboardFilterOptions = {
  designations: FilterOption[]
  vehicleTypes: FilterOption[]
  workLocations: FilterOption[]
  states: FilterOption[]
}
