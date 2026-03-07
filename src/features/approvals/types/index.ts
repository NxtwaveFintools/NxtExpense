import type {
  Claim,
  ClaimAvailableAction,
  ClaimItem,
  ClaimStatus,
} from '@/features/claims/types'
import type { Employee } from '@/features/employees/types'
import type { PaginatedResult } from '@/lib/utils/pagination'

export type ApprovalAction = {
  id: string
  claim_id: string
  approver_email: string
  approval_level: number | null
  action:
    | 'approved'
    | 'rejected'
    | 'resubmitted'
    | 'bypass_logged'
    | 'admin_override'
    | 'finance_issued'
    | 'finance_rejected'
    | 'reopened'
  notes: string | null
  rejection_notes: string | null
  allow_resubmit: boolean | null
  bypass_reason: string | null
  skipped_levels: number[] | null
  reason: string | null
  acted_at: string
}

export type PendingApproval = {
  claim: Claim
  owner: Employee
  items: ClaimItem[]
  availableActions: ClaimAvailableAction[]
}

export type PaginatedPendingApprovals = PaginatedResult<PendingApproval>

export type ApprovalHistoryItem = {
  claim: Claim
  owner: Employee
  action: ApprovalAction
}

export type PaginatedApprovalHistory = PaginatedResult<ApprovalHistoryItem>

export type ApprovalActorFilter = 'all' | 'sbh' | 'hod' | 'finance'

export type ApprovalHistoryFilters = {
  employeeName: string | null
  actorFilter: ApprovalActorFilter
  claimDateFrom: string | null
  claimDateTo: string | null
  hodApprovedFrom: string | null
  hodApprovedTo: string | null
  financeApprovedFrom: string | null
  financeApprovedTo: string | null
}

export type PendingApprovalsFilters = {
  employeeName: string | null
  actorFilter: ApprovalActorFilter
}

export type ApprovalHistoryRecord = {
  actionId: string
  claimId: string
  claimNumber: string
  claimDate: string
  workLocation: string
  totalAmount: number
  claimStatus: ClaimStatus
  ownerName: string
  ownerDesignation: string
  actorEmail: string
  actorDesignation: string | null
  action: string
  approvalLevel: number | null
  notes: string | null
  actedAt: string
  hodApprovedAt: string | null
  financeApprovedAt: string | null
}

export type PaginatedApprovalHistoryRecords =
  PaginatedResult<ApprovalHistoryRecord>

export type BulkApprovalActionResult = {
  ok: boolean
  error: string | null
  succeeded: number
  failed: number
  errors: Array<{
    claimId: string
    message: string
  }>
}
