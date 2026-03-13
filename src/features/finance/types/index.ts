import type { Claim, ClaimAvailableAction } from '@/features/claims/types'
import type { EmployeeRow } from '@/lib/services/employee-service'
import type { PaginatedResult } from '@/lib/utils/pagination'

// These type aliases mirror the `finance_action_type` PostgreSQL enum.
// Single source of truth for all finance action string comparisons.
export type FinanceActionType = 'issued' | 'finance_rejected'

export type FinanceActionFilter = 'all' | FinanceActionType

export type FinanceDateFilterField = 'claim_date' | 'finance_approved_date'

export type FinanceAction = {
  id: string
  claim_id: string
  actor_email: string
  actor_name: string | null
  action: FinanceActionType
  notes: string | null
  acted_at: string
}

export type FinanceQueueItem = {
  claim: Claim
  owner: EmployeeRow
  availableActions: ClaimAvailableAction[]
}

export type PaginatedFinanceQueue = PaginatedResult<FinanceQueueItem>

export type FinanceHistoryItem = {
  claim: Claim
  owner: EmployeeRow
  action: FinanceAction
}

export type PaginatedFinanceHistory = PaginatedResult<FinanceHistoryItem>

export type FinanceFilters = {
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
}
