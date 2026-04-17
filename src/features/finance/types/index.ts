import type { Claim, ClaimAvailableAction } from '@/features/claims/types'
import type { PaginatedResult } from '@/lib/utils/pagination'

export type FinanceActionFilter = string | null

export type FinanceDateFilterField =
  | 'claim_date'
  | 'submitted_at'
  | 'hod_approved_date'
  | 'finance_approved_date'
  | 'payment_released_date'

export type FinanceAction = {
  id: string
  claim_id: string
  actor_email: string
  actor_name: string | null
  action: string
  notes: string | null
  acted_at: string
}

export type FinanceOwner = {
  id: string
  employee_id: string
  employee_name: string
  employee_email: string
  designation_id: string | null
  designations: { designation_name: string } | null
}

export type FinanceQueueItem = {
  claim: Claim
  owner: FinanceOwner
  availableActions: ClaimAvailableAction[]
}

export type PaginatedFinanceQueue = PaginatedResult<FinanceQueueItem>

export type FinanceHistoryItem = {
  claim: Claim
  owner: FinanceOwner
  action: FinanceAction
  availableActions: ClaimAvailableAction[]
}

export type PaginatedFinanceHistory = PaginatedResult<FinanceHistoryItem>

export type FinanceFilters = {
  employeeId?: string | null
  employeeName: string | null
  claimNumber: string | null
  ownerDesignation: string | null
  hodApproverEmployeeId: string | null
  claimStatus: string | null
  workLocation: string | null
  actionFilter: FinanceActionFilter
  dateFilterField: FinanceDateFilterField
  dateFrom: string | null
  dateTo: string | null
}

export type FinanceFilterOption = {
  value: string
  label: string
}

export type FinanceFilterOptions = {
  ownerDesignations: FinanceFilterOption[]
  hodApprovers: FinanceFilterOption[]
  claimStatuses: FinanceFilterOption[]
  workLocations: FinanceFilterOption[]
  financeActions: FinanceFilterOption[]
}
