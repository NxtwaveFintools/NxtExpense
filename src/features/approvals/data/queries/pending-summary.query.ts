import type { SupabaseClient } from '@supabase/supabase-js'

import type { PendingApprovalsFilters } from '@/features/approvals/types'
import { getPendingApprovalsMetricsRpc } from '@/features/approvals/data/rpc/pending-summary.rpc'
import { resolveClaimAllowResubmitFilterValue } from '@/features/claims/data/queries'
import { parseClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'

type PendingApprovalsSummary = {
  count: number
  amount: number
}

const DEFAULT_PENDING_FILTERS: PendingApprovalsFilters = {
  employeeName: null,
  claimStatus: null,
  claimDateFrom: null,
  claimDateTo: null,
  amountOperator: 'lte',
  amountValue: null,
  locationType: null,
  claimDateSort: 'desc',
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

// pending_approvals_filtered() resolves the approver's scope, status set, and
// location-type matching entirely in SQL — this function only translates the
// UI's filter shape into RPC params. It intentionally does NOT resolve
// approverEmail into an id, subordinate-employee-id arrays, or location-id
// arrays: that was get_pending_approval_scope_summary's duplicated
// re-implementation of what get_pending_approvals already did in SQL (see
// docs/superpowers/plans/2026-07-02-approvals-canonical-filter-plan.md).
export async function getPendingApprovalsSummary(
  supabase: SupabaseClient,
  approverEmail: string,
  filters: PendingApprovalsFilters = DEFAULT_PENDING_FILTERS
): Promise<PendingApprovalsSummary> {
  if (!approverEmail) {
    return { count: 0, amount: 0 }
  }

  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)
  const allowResubmitFilter = await resolveClaimAllowResubmitFilterValue(
    supabase,
    parsedStatusFilter
  )
  const normalizedName = filters.employeeName?.trim() ?? ''

  const summary = await getPendingApprovalsMetricsRpc(supabase, {
    p_claim_status_id: parsedStatusFilter?.statusId ?? null,
    p_allow_resubmit: allowResubmitFilter,
    p_employee_name: normalizedName || null,
    p_amount_operator: filters.amountOperator,
    p_amount_value: filters.amountValue,
    p_location_type: filters.locationType,
    p_claim_date_from: filters.claimDateFrom,
    p_claim_date_to: filters.claimDateTo,
  })

  return {
    count: toNumber(summary?.claim_count),
    amount: toNumber(summary?.total_amount),
  }
}
