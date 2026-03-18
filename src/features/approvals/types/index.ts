import type {
  Claim,
  ClaimAvailableAction,
  ClaimItem,
} from '@/features/claims/types'
import type { EmployeeRow } from '@/lib/services/employee-service'
import type { PaginatedResult } from '@/lib/utils/pagination'

export type ApprovalAction = {
  id: string
  claim_id: string
  approver_email: string
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

export type PendingApproval = {
  claim: Claim
  owner: EmployeeRow
  items: ClaimItem[]
  availableActions: ClaimAvailableAction[]
}

export type PaginatedPendingApprovals = PaginatedResult<PendingApproval>

export type ApprovalHistoryFilters = {
  employeeName: string | null
  claimStatus: string | null
  claimDate: string | null
  hodApprovedFrom: string | null
  hodApprovedTo: string | null
  financeApprovedFrom: string | null
  financeApprovedTo: string | null
}

export type PendingApprovalsFilters = {
  employeeName: string | null
  claimStatus: string | null
}

export type ApprovalHistoryRecord = {
  actionId: string
  claimId: string
  claimNumber: string
  claimDate: string
  workLocation: string
  totalAmount: number
  claimStatusName: string
  claimStatusDisplayColor: string
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
