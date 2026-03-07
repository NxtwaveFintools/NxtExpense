import type { Claim, ClaimAvailableAction } from '@/features/claims/types'
import type { Employee } from '@/features/employees/types'
import type { PaginatedResult } from '@/lib/utils/pagination'

export type FinanceActionType = 'issued' | 'finance_rejected'

export type FinanceActionFilter = 'all' | 'issued' | 'finance_rejected'

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
  owner: Employee
  availableActions: ClaimAvailableAction[]
}

export type PaginatedFinanceQueue = PaginatedResult<FinanceQueueItem>

export type FinanceHistoryItem = {
  claim: Claim
  owner: Employee
  action: FinanceAction
}

export type PaginatedFinanceHistory = PaginatedResult<FinanceHistoryItem>

export type FinanceFilters = {
  employeeName: string | null
  claimNumber: string | null
  ownerDesignation: string | null
  hodApproverEmail: string | null
  claimStatus: string | null
  workLocation: string | null
  resubmittedOnly: boolean
  actionFilter: FinanceActionFilter
  claimDateFrom: string | null
  claimDateTo: string | null
  actionDateFrom: string | null
  actionDateTo: string | null
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
