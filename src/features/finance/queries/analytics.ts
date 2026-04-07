import type { SupabaseClient } from '@supabase/supabase-js'

import type { FinanceFilters } from '@/features/finance/types'
import {
  getFilteredClaimIdsForFinance,
  isFinanceActionDateFilterField,
} from '@/features/finance/queries/filters'
import { toIstDayEnd, toIstDayStart } from '@/features/finance/utils/filters'

type ClaimMetricSummary = {
  count: number
  amount: number
}

const DEFAULT_FINANCE_FILTERS: FinanceFilters = {
  employeeName: null,
  claimNumber: null,
  ownerDesignation: null,
  hodApproverEmployeeId: null,
  claimStatus: null,
  workLocation: null,
  actionFilter: null,
  dateFilterField: 'claim_date',
  dateFrom: null,
  dateTo: null,
}

type FinanceQueueAnalytics = {
  total: ClaimMetricSummary
  pendingFinanceQueue: ClaimMetricSummary
  approved: ClaimMetricSummary
  rejected: ClaimMetricSummary
}

type ClaimStatusRow = {
  id: string
  approval_level: number | null
  is_approval: boolean
  is_rejection: boolean
  is_terminal: boolean
  is_payment_issued: boolean
}

type ClaimBucketMetricsRow = {
  total_count: number | string | null
  total_amount: number | string | null
  pending_count: number | string | null
  pending_amount: number | string | null
  approved_count: number | string | null
  approved_amount: number | string | null
  rejected_count: number | string | null
  rejected_amount: number | string | null
}

type FinanceActionClaimCursorRow = {
  id: string
  acted_at: string
  claim_id: string
}

const ACTION_FILTER_BATCH_SIZE = 500
const MAX_SCOPED_ACTION_CLAIMS = 10_000

function createMetricSummary(): ClaimMetricSummary {
  return { count: 0, amount: 0 }
}

function createEmptyAnalytics(): FinanceQueueAnalytics {
  return {
    total: createMetricSummary(),
    pendingFinanceQueue: createMetricSummary(),
    approved: createMetricSummary(),
    rejected: createMetricSummary(),
  }
}

function hasActiveAnalyticsFilters(filters: FinanceFilters): boolean {
  return Boolean(
    filters.employeeName ||
    filters.claimNumber ||
    filters.ownerDesignation ||
    filters.hodApproverEmployeeId ||
    filters.claimStatus ||
    filters.workLocation ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.actionFilter
  )
}

function intersectClaimIds(
  scopedClaimIds: string[] | null,
  candidateClaimIds: string[]
): string[] {
  const candidateSet = new Set(candidateClaimIds)

  if (scopedClaimIds === null) {
    return [...candidateSet]
  }

  return scopedClaimIds.filter((claimId) => candidateSet.has(claimId))
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

async function getActionFilteredClaimIds(
  supabase: SupabaseClient,
  action: string,
  dateFrom: string | null,
  dateTo: string | null
): Promise<string[]> {
  const claimIds = new Set<string>()
  let cursor: { acted_at: string; id: string } | null = null

  for (;;) {
    let query = supabase
      .from('finance_actions')
      .select('id, acted_at, claim_id')
      .eq('action', action)
      .order('acted_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(ACTION_FILTER_BATCH_SIZE)

    if (dateFrom) {
      query = query.gte('acted_at', dateFrom)
    }

    if (dateTo) {
      query = query.lte('acted_at', dateTo)
    }

    if (cursor) {
      query = query.or(
        `acted_at.lt.${cursor.acted_at},and(acted_at.eq.${cursor.acted_at},id.lt.${cursor.id})`
      )
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data ?? []) as FinanceActionClaimCursorRow[]

    for (const row of rows) {
      if (row.claim_id) {
        claimIds.add(row.claim_id)
      }
    }

    if (claimIds.size > MAX_SCOPED_ACTION_CLAIMS) {
      throw new Error(
        `Finance action scope exceeded ${MAX_SCOPED_ACTION_CLAIMS} claims. Please narrow filters.`
      )
    }

    if (rows.length < ACTION_FILTER_BATCH_SIZE) {
      break
    }

    const last = rows[rows.length - 1]
    cursor = { acted_at: last.acted_at, id: last.id }
  }

  return [...claimIds]
}

export async function getFinanceQueueAnalytics(
  supabase: SupabaseClient,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<FinanceQueueAnalytics> {
  const { data: statusRows, error: statusError } = await supabase
    .from('claim_statuses')
    .select(
      'id, approval_level, is_approval, is_rejection, is_terminal, is_payment_issued'
    )
    .eq('is_active', true)

  if (statusError) {
    throw new Error(statusError.message)
  }

  const activeStatuses = (statusRows ?? []) as ClaimStatusRow[]

  const pendingFinanceQueueStatusIds = activeStatuses
    .filter(
      (status) =>
        status.approval_level === 3 &&
        !status.is_approval &&
        !status.is_rejection &&
        !status.is_terminal
    )
    .map((status) => status.id)

  const approvedStatusIds = activeStatuses
    .filter((status) => status.is_payment_issued)
    .map((status) => status.id)

  const rejectedStatusIds = activeStatuses
    .filter((status) => status.is_rejection)
    .map((status) => status.id)

  const analytics = createEmptyAnalytics()

  let scopedClaimIds: string[] | null = null
  const filterByFinanceActionDate =
    isFinanceActionDateFilterField(filters.dateFilterField) &&
    (filters.dateFrom || filters.dateTo)

  if (hasActiveAnalyticsFilters(filters)) {
    const filteredClaimIds = await getFilteredClaimIdsForFinance(
      supabase,
      filters
    )

    if (Array.isArray(filteredClaimIds) && filteredClaimIds.length === 0) {
      return analytics
    }

    scopedClaimIds = filteredClaimIds

    if (filters.actionFilter && !filterByFinanceActionDate) {
      const dateFrom = toIstDayStart(filters.dateFrom)
      const dateTo = toIstDayEnd(filters.dateTo)

      const actionClaimIds = await getActionFilteredClaimIds(
        supabase,
        filters.actionFilter,
        dateFrom,
        dateTo
      )

      scopedClaimIds = intersectClaimIds(scopedClaimIds, actionClaimIds)

      if (scopedClaimIds.length === 0) {
        return analytics
      }
    }
  }

  const { data: metricsData, error: metricsError } = await supabase.rpc(
    'get_claim_bucket_metrics',
    {
      p_claim_ids: scopedClaimIds,
      p_pending_status_ids: pendingFinanceQueueStatusIds,
      p_approved_status_ids: approvedStatusIds,
      p_rejected_status_ids: rejectedStatusIds,
    }
  )

  if (metricsError) {
    throw new Error(metricsError.message)
  }

  const metrics = (
    Array.isArray(metricsData) ? metricsData[0] : metricsData
  ) as ClaimBucketMetricsRow | null

  if (!metrics) {
    return analytics
  }

  return {
    total: {
      count: toNumber(metrics.total_count),
      amount: toNumber(metrics.total_amount),
    },
    pendingFinanceQueue: {
      count: toNumber(metrics.pending_count),
      amount: toNumber(metrics.pending_amount),
    },
    approved: {
      count: toNumber(metrics.approved_count),
      amount: toNumber(metrics.approved_amount),
    },
    rejected: {
      count: toNumber(metrics.rejected_count),
      amount: toNumber(metrics.rejected_amount),
    },
  }
}
