import type { SupabaseClient } from '@supabase/supabase-js'

import type { PendingApprovalsFilters } from '@/features/approvals/types'
import { getLocationIdsByApprovalLocationType } from '@/features/approvals/queries/location-type'
import { parseClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'
import { resolveClaimAllowResubmitFilterValue } from '@/lib/services/claim-status-filter-service'
import { getPendingApprovalScopeByActor } from '@/features/approvals/queries/pending-scope'

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

type PendingApprovalScopeSummaryRow = {
  claim_count: number | string | null
  total_amount: number | string | null
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

export async function getPendingApprovalsSummary(
  supabase: SupabaseClient,
  approverEmail: string,
  filters: PendingApprovalsFilters = DEFAULT_PENDING_FILTERS
): Promise<PendingApprovalsSummary> {
  const lowerEmail = approverEmail.toLowerCase()

  const [actorResult, pendingStatusesResult] = await Promise.all([
    supabase
      .from('employees')
      .select('id')
      .eq('employee_email', lowerEmail)
      .maybeSingle(),
    supabase
      .from('claim_statuses')
      .select('id')
      .not('approval_level', 'is', null)
      .eq('is_rejection', false)
      .eq('is_terminal', false)
      .eq('is_active', true)
      .in('approval_level', [1, 2]),
  ])

  if (actorResult.error) {
    throw new Error(actorResult.error.message)
  }

  if (pendingStatusesResult.error) {
    throw new Error(pendingStatusesResult.error.message)
  }

  if (!actorResult.data) {
    return { count: 0, amount: 0 }
  }

  const pendingStatuses = pendingStatusesResult.data ?? []
  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)
  const allowResubmitFilter = await resolveClaimAllowResubmitFilterValue(
    supabase,
    parsedStatusFilter
  )

  const pendingStatusIds = (
    parsedStatusFilter
      ? pendingStatuses.filter(
          (status) => status.id === parsedStatusFilter.statusId
        )
      : pendingStatuses
  ).map((status) => status.id)

  if (pendingStatusIds.length === 0) {
    return { count: 0, amount: 0 }
  }

  const actorEmployeeId = actorResult.data.id

  const pendingScope = await getPendingApprovalScopeByActor(
    supabase,
    actorEmployeeId
  )

  const level1Ids = [
    ...new Set([
      ...pendingScope.level1ActionEmployeeIds,
      ...pendingScope.level1ViewOnlyEmployeeIds,
    ]),
  ]
  const level2Ids = pendingScope.level2ActionEmployeeIds

  if (level1Ids.length === 0 && level2Ids.length === 0) {
    return { count: 0, amount: 0 }
  }

  const normalizedName = filters.employeeName?.trim() ?? ''

  let scopedLocationIds: string[] | null = null
  if (filters.locationType) {
    scopedLocationIds = await getLocationIdsByApprovalLocationType(
      supabase,
      filters.locationType
    )

    if (!scopedLocationIds || scopedLocationIds.length === 0) {
      return { count: 0, amount: 0 }
    }
  }

  const { data, error } = await supabase.rpc(
    'get_pending_approval_scope_summary',
    {
      p_level1_employee_ids: level1Ids.length > 0 ? level1Ids : null,
      p_level2_employee_ids: level2Ids.length > 0 ? level2Ids : null,
      p_pending_status_ids: pendingStatusIds,
      p_allow_resubmit: allowResubmitFilter,
      p_employee_name: normalizedName || null,
      p_claim_date_from: filters.claimDateFrom,
      p_claim_date_to: filters.claimDateTo,
      p_amount_operator:
        filters.amountValue !== null ? filters.amountOperator : null,
      p_amount_value: filters.amountValue,
      p_location_ids: scopedLocationIds,
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  const summary = (
    Array.isArray(data) ? data[0] : data
  ) as PendingApprovalScopeSummaryRow | null

  return {
    count: toNumber(summary?.claim_count),
    amount: toNumber(summary?.total_amount),
  }
}
