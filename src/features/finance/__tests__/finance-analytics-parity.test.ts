import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { http, passthrough } from 'msw'
import { beforeAll, describe, expect, it } from 'vitest'

import { getFinanceActionCodesForFilter } from '@/features/finance/utils/action-filter'
import { toIstDayEnd, toIstDayStart } from '@/features/finance/utils/filters'
import {
  getClaimBucketMetricsRpc,
  getFinanceHistoryActionMetricsRpc,
  getFinanceHistoryMetricsFilteredRpc,
  getFinanceQueueMetricsFilteredRpc,
} from '@/features/finance/data/rpc/finance-metrics.rpc'
import type { FinanceFilters } from '@/features/finance/types'
import { mswServer } from '@/test/msw/server'

// Live golden-master parity gate for the Phase 2 analytics RPCs. Opt-in: requires a
// service-role connection. Run with:
//   PARITY=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run \
//     src/features/finance/__tests__/finance-analytics-parity.test.ts
//
// Baseline choice (read before editing):
//   Phase 2 deliberately routes ALL analytics through the Phase 1 resolver
//   (finance_filtered_claim_ids), which applies the finance view's allow_resubmit
//   exclusion uniformly. The legacy TS analytics paths BYPASSED that resolver for
//   no-filter / pure-action-filter cases (getFilteredClaimIdsForFinance returns null),
//   so reproducing the raw legacy runtime here would re-introduce exactly the quirks
//   Phase 2 is fixing (e.g. the Finance Queue rejected_allow_reclaim filter returned
//   all-zeros). Per the product decision, those quirks are fixed.
//
//   So this gate validates the thing Phase 2 actually changes: that the NEW combined
//   RPCs aggregate identically to the PROVEN-correct OLD aggregation RPCs
//   (get_finance_history_action_metrics / get_claim_bucket_metrics) when both are fed
//   the SAME resolver-scoped claim set. Phase 1's finance-resolver-parity gate already
//   proves the resolver itself matches the legacy id-resolution; composing the two
//   gives end-to-end confidence while the analytics quirks stay fixed.
const ENABLED = process.env.PARITY === '1'

const BASE: FinanceFilters = {
  employeeId: null,
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

const WIDE = { dateFrom: '2025-09-01', dateTo: '2026-05-31' }

function usesIstBoundary(field: FinanceFilters['dateFilterField']): boolean {
  return (
    field === 'payment_released_date' ||
    field === 'finance_approved_date' ||
    field === 'submitted_at' ||
    field === 'hod_approved_date'
  )
}

function isActionDateField(field: FinanceFilters['dateFilterField']): boolean {
  return field === 'payment_released_date' || field === 'finance_approved_date'
}

type BucketRow = {
  action: string
  is_approved: boolean
  is_rejected: boolean
  is_finance_approved: boolean
  is_payment_released: boolean
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

// Resolver claim scope — paged exactly like the Phase 1 parity gate (PostgREST caps a
// single RPC response at db-max-rows). This is the SAME scope the new RPCs resolve
// internally, so feeding it to the OLD RPCs makes the comparison apples-to-apples.
async function resolverIds(
  supabase: SupabaseClient,
  filters: FinanceFilters
): Promise<string[]> {
  const useIst = usesIstBoundary(filters.dateFilterField)
  const args = {
    p_required_status_id: null,
    p_employee_id: filters.employeeId,
    p_employee_name: filters.employeeName,
    p_claim_number: filters.claimNumber,
    p_owner_designation: filters.ownerDesignation,
    p_hod_approver_emp: filters.hodApproverEmployeeId,
    p_claim_status: filters.claimStatus,
    p_work_location: filters.workLocation,
    p_action_filter: filters.actionFilter,
    p_date_field: filters.dateFilterField,
    p_date_from: useIst ? toIstDayStart(filters.dateFrom) : filters.dateFrom,
    p_date_to: useIst ? toIstDayEnd(filters.dateTo) : filters.dateTo,
  }

  const PAGE = 1000
  const ids: string[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .rpc('finance_filtered_claim_ids', args)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{ id: string }>
    for (const r of rows) ids.push(r.id)
    if (rows.length < PAGE) break
  }
  return ids
}

async function fetchBuckets(supabase: SupabaseClient): Promise<BucketRow[]> {
  const { data, error } = await supabase.rpc('finance_action_buckets')
  if (error) throw new Error(error.message)
  return (data ?? []) as BucketRow[]
}

// Claims that have a finance_action matching `action` inside the IST window. Mirrors
// the EXISTS subquery the new queue RPC runs (and the legacy getActionFilteredClaimIds).
async function actionScopedIds(
  supabase: SupabaseClient,
  action: string,
  from: string | null,
  to: string | null
): Promise<Set<string>> {
  const ids = new Set<string>()
  const PAGE = 1000
  for (let start = 0; ; start += PAGE) {
    let q = supabase
      .from('finance_actions')
      .select('claim_id')
      .eq('action', action)
      .order('claim_id', { ascending: true })
      .range(start, start + PAGE - 1)
    if (from) q = q.gte('acted_at', from)
    if (to) q = q.lte('acted_at', to)

    const { data, error } = await q
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{ claim_id: string | null }>
    for (const r of rows) if (r.claim_id) ids.add(r.claim_id)
    if (rows.length < PAGE) break
  }
  return ids
}

type Metrics = Record<string, number>

function toNum(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

// ── HISTORY ────────────────────────────────────────────────────────────────────
// Legacy baseline = resolver ids fed to the OLD history aggregation RPC, with the
// exact action-array inputs the pre-Phase-2 getFinanceHistoryAnalytics computed.
async function legacyHistory(
  supabase: SupabaseClient,
  filters: FinanceFilters,
  buckets: BucketRow[]
): Promise<Metrics> {
  const ids = await resolverIds(supabase, filters)

  const filterByActionDate =
    isActionDateField(filters.dateFilterField) &&
    Boolean(filters.dateFrom || filters.dateTo)

  const approvedActions = unique(
    buckets.filter((b) => b.is_approved).map((b) => b.action)
  )
  const rejectedActions = unique(
    buckets.filter((b) => b.is_rejected).map((b) => b.action)
  )
  const dateScopedActions =
    filters.dateFilterField === 'finance_approved_date'
      ? unique(
          buckets.filter((b) => b.is_finance_approved).map((b) => b.action)
        )
      : unique(
          buckets.filter((b) => b.is_payment_released).map((b) => b.action)
        )

  const actionFilterCodes = filterByActionDate
    ? dateScopedActions
    : getFinanceActionCodesForFilter(filters.actionFilter)
  const actionFilterCodesOrNull =
    actionFilterCodes.length > 0 ? actionFilterCodes : null
  const actionFilterForRpc =
    !filterByActionDate && actionFilterCodes.length === 1
      ? actionFilterCodes[0]
      : null

  const row = await getFinanceHistoryActionMetricsRpc(supabase, {
    p_claim_ids: ids,
    p_action_filter: actionFilterForRpc,
    p_date_from: filterByActionDate ? toIstDayStart(filters.dateFrom) : null,
    p_date_to: filterByActionDate ? toIstDayEnd(filters.dateTo) : null,
    p_date_scoped_actions: actionFilterCodesOrNull,
    p_approved_actions: approvedActions,
    p_rejected_actions: rejectedActions,
  })

  return historyRowToMetrics(row)
}

async function newHistory(
  supabase: SupabaseClient,
  filters: FinanceFilters
): Promise<Metrics> {
  const useIst = usesIstBoundary(filters.dateFilterField)
  const row = await getFinanceHistoryMetricsFilteredRpc(supabase, {
    p_employee_id: filters.employeeId,
    p_employee_name: filters.employeeName,
    p_claim_number: filters.claimNumber,
    p_owner_designation: filters.ownerDesignation,
    p_hod_approver_emp: filters.hodApproverEmployeeId,
    p_claim_status: filters.claimStatus,
    p_work_location: filters.workLocation,
    p_action_filter: filters.actionFilter,
    p_date_field: filters.dateFilterField,
    p_date_from: useIst ? toIstDayStart(filters.dateFrom) : filters.dateFrom,
    p_date_to: useIst ? toIstDayEnd(filters.dateTo) : filters.dateTo,
  })

  return historyRowToMetrics(row)
}

function historyRowToMetrics(
  row: Record<string, number | string | null | undefined> | null
): Metrics {
  return {
    total_count: toNum(row?.total_count),
    total_amount: toNum(row?.total_amount),
    approved_count: toNum(row?.approved_count),
    approved_amount: toNum(row?.approved_amount),
    rejected_count: toNum(row?.rejected_count),
    rejected_amount: toNum(row?.rejected_amount),
    rejected_without_reclaim_count: toNum(row?.rejected_without_reclaim_count),
    rejected_without_reclaim_amount: toNum(
      row?.rejected_without_reclaim_amount
    ),
    rejected_allow_reclaim_count: toNum(row?.rejected_allow_reclaim_count),
    rejected_allow_reclaim_amount: toNum(row?.rejected_allow_reclaim_amount),
    other_count: toNum(row?.other_count),
    other_amount: toNum(row?.other_amount),
  }
}

// ── QUEUE ──────────────────────────────────────────────────────────────────────
type StatusIds = {
  pending: string[]
  approved: string[]
  rejected: string[]
}

async function fetchStatusIds(supabase: SupabaseClient): Promise<StatusIds> {
  const { data, error } = await supabase
    .from('claim_statuses')
    .select(
      'id, approval_level, is_approval, is_rejection, is_terminal, is_payment_issued'
    )
    .eq('is_active', true)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{
    id: string
    approval_level: number | null
    is_approval: boolean
    is_rejection: boolean
    is_terminal: boolean
    is_payment_issued: boolean
  }>
  return {
    pending: rows
      .filter(
        (r) =>
          r.approval_level === 3 &&
          !r.is_approval &&
          !r.is_rejection &&
          !r.is_terminal
      )
      .map((r) => r.id),
    approved: rows.filter((r) => r.is_payment_issued).map((r) => r.id),
    rejected: rows.filter((r) => r.is_rejection).map((r) => r.id),
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

// Legacy baseline = resolver ids (+ action intersect) fed to the OLD bucket RPC.
async function legacyQueue(
  supabase: SupabaseClient,
  filters: FinanceFilters,
  statusIds: StatusIds
): Promise<Metrics> {
  const hasFilters = hasActiveAnalyticsFilters(filters)
  const filterByActionDate =
    isActionDateField(filters.dateFilterField) &&
    Boolean(filters.dateFrom || filters.dateTo)
  const useActionIntersect =
    hasFilters &&
    !!filters.actionFilter &&
    !filterByActionDate &&
    filters.actionFilter !== 'rejected_allow_reclaim'

  let claimIds: string[] | null = null
  if (hasFilters) {
    const ids = await resolverIds(supabase, filters)
    if (useActionIntersect && filters.actionFilter) {
      const scoped = await actionScopedIds(
        supabase,
        filters.actionFilter,
        toIstDayStart(filters.dateFrom),
        toIstDayEnd(filters.dateTo)
      )
      claimIds = ids.filter((id) => scoped.has(id))
    } else {
      claimIds = ids
    }
  }

  const row = await getClaimBucketMetricsRpc(supabase, {
    p_claim_ids: claimIds,
    p_pending_status_ids: statusIds.pending,
    p_approved_status_ids: statusIds.approved,
    p_rejected_status_ids: statusIds.rejected,
  })

  return queueRowToMetrics(row)
}

async function newQueue(
  supabase: SupabaseClient,
  filters: FinanceFilters,
  statusIds: StatusIds
): Promise<Metrics> {
  const hasFilters = hasActiveAnalyticsFilters(filters)
  const filterByActionDate =
    isActionDateField(filters.dateFilterField) &&
    Boolean(filters.dateFrom || filters.dateTo)
  const useActionIntersect =
    hasFilters &&
    !!filters.actionFilter &&
    !filterByActionDate &&
    filters.actionFilter !== 'rejected_allow_reclaim'
  const useIst =
    filterByActionDate ||
    filters.dateFilterField === 'submitted_at' ||
    filters.dateFilterField === 'hod_approved_date'

  const row = await getFinanceQueueMetricsFilteredRpc(supabase, {
    p_pending_status_ids: statusIds.pending,
    p_approved_status_ids: statusIds.approved,
    p_rejected_status_ids: statusIds.rejected,
    p_has_filters: hasFilters,
    p_employee_id: filters.employeeId ?? null,
    p_employee_name: filters.employeeName,
    p_claim_number: filters.claimNumber,
    p_owner_designation: filters.ownerDesignation,
    p_hod_approver_emp: filters.hodApproverEmployeeId,
    p_claim_status: filters.claimStatus,
    p_work_location: filters.workLocation,
    p_action_filter: filters.actionFilter,
    p_date_field: filters.dateFilterField,
    p_date_from: useIst ? toIstDayStart(filters.dateFrom) : filters.dateFrom,
    p_date_to: useIst ? toIstDayEnd(filters.dateTo) : filters.dateTo,
    p_action_intersect: useActionIntersect ? filters.actionFilter : null,
    p_action_from: useActionIntersect ? toIstDayStart(filters.dateFrom) : null,
    p_action_to: useActionIntersect ? toIstDayEnd(filters.dateTo) : null,
  })

  return queueRowToMetrics(row)
}

function queueRowToMetrics(
  row: Record<string, number | string | null | undefined> | null
): Metrics {
  return {
    total_count: toNum(row?.total_count),
    total_amount: toNum(row?.total_amount),
    pending_count: toNum(row?.pending_count),
    pending_amount: toNum(row?.pending_amount),
    approved_count: toNum(row?.approved_count),
    approved_amount: toNum(row?.approved_amount),
    rejected_count: toNum(row?.rejected_count),
    rejected_amount: toNum(row?.rejected_amount),
  }
}

type Samples = {
  claimStatus?: string
  workLocation?: string
  employeeName?: string
}

async function fetchSamples(supabase: SupabaseClient): Promise<Samples> {
  const [statusRes, empRes, claimRes] = await Promise.all([
    supabase
      .from('claim_statuses')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('employees')
      .select('employee_name')
      .not('employee_name', 'is', null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('expense_claims')
      .select('work_location_id')
      .not('work_location_id', 'is', null)
      .limit(1)
      .maybeSingle(),
  ])
  return {
    claimStatus: statusRes.data?.id,
    employeeName: empRes.data?.employee_name ?? undefined,
    workLocation: claimRes.data?.work_location_id ?? undefined,
  }
}

describe.skipIf(!ENABLED)(
  'finance analytics parity (new RPCs vs old aggregation)',
  () => {
    let supabase: SupabaseClient
    let buckets: BucketRow[]
    let statusIds: StatusIds
    let samples: Samples

    beforeAll(async () => {
      mswServer.use(
        http.all(`${process.env.SUPABASE_URL}/*`, () => passthrough())
      )
      supabase = createClient(
        process.env.SUPABASE_URL as string,
        process.env.SUPABASE_SERVICE_ROLE_KEY as string,
        { auth: { persistSession: false } }
      )
      buckets = await fetchBuckets(supabase)
      statusIds = await fetchStatusIds(supabase)
      samples = await fetchSamples(supabase)
    })

    it('matches the old aggregation across the analytics filter matrix (history + queue)', async () => {
      const cases: Array<{ name: string; filters: FinanceFilters }> = [
        { name: 'no filters', filters: { ...BASE } },
        {
          name: 'claim_date wide',
          filters: { ...BASE, dateFilterField: 'claim_date', ...WIDE },
        },
        {
          name: 'submitted_at wide',
          filters: { ...BASE, dateFilterField: 'submitted_at', ...WIDE },
        },
        {
          name: 'payment_released wide',
          filters: {
            ...BASE,
            dateFilterField: 'payment_released_date',
            ...WIDE,
          },
        },
        {
          name: 'finance_approved wide',
          filters: {
            ...BASE,
            dateFilterField: 'finance_approved_date',
            ...WIDE,
          },
        },
        {
          name: 'hod_approved wide',
          filters: { ...BASE, dateFilterField: 'hod_approved_date', ...WIDE },
        },
        // allow_resubmit x action-filter intersection — where regressions hide.
        {
          name: 'rejected_allow_reclaim alone',
          filters: { ...BASE, actionFilter: 'rejected_allow_reclaim' },
        },
        {
          name: 'rejected_allow_reclaim + wide date',
          filters: { ...BASE, actionFilter: 'rejected_allow_reclaim', ...WIDE },
        },
        // The non-reclaim rejected path — proves the without/allow-reclaim split matches.
        {
          name: 'finance_rejected alone',
          filters: { ...BASE, actionFilter: 'finance_rejected' },
        },
        {
          name: 'finance_rejected + wide date',
          filters: { ...BASE, actionFilter: 'finance_rejected', ...WIDE },
        },
      ]

      if (samples.claimStatus) {
        cases.push({
          name: 'rejected_allow_reclaim + claimStatus',
          filters: {
            ...BASE,
            actionFilter: 'rejected_allow_reclaim',
            claimStatus: samples.claimStatus,
          },
        })
        cases.push({
          name: 'rejected_allow_reclaim + claimStatus:allow_resubmit',
          filters: {
            ...BASE,
            actionFilter: 'rejected_allow_reclaim',
            claimStatus: `${samples.claimStatus}:allow_resubmit`,
          },
        })
      }
      if (samples.employeeName) {
        cases.push({
          name: 'rejected_allow_reclaim + employeeName',
          filters: {
            ...BASE,
            actionFilter: 'rejected_allow_reclaim',
            employeeName: samples.employeeName,
          },
        })
      }
      if (samples.workLocation) {
        cases.push({
          name: 'rejected_allow_reclaim + workLocation',
          filters: {
            ...BASE,
            actionFilter: 'rejected_allow_reclaim',
            workLocation: samples.workLocation,
          },
        })
      }

      let compared = 0
      for (const { name, filters } of cases) {
        const [legacyH, newH, legacyQ, newQ] = await Promise.all([
          legacyHistory(supabase, filters, buckets),
          newHistory(supabase, filters),
          legacyQueue(supabase, filters, statusIds),
          newQueue(supabase, filters, statusIds),
        ])

        expect(newH, `history mismatch: ${name}`).toEqual(legacyH)
        expect(newQ, `queue mismatch: ${name}`).toEqual(legacyQ)
        compared += 1
      }

      // Guard: a misconfigured run that compared nothing must not look green.
      expect(compared, 'no parity cases were compared').toBeGreaterThan(0)
    }, 180_000)
  }
)
