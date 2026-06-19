import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { http, passthrough } from 'msw'
import { beforeAll, describe, expect, it } from 'vitest'

import { getFilteredClaimIdsForFinance } from '@/features/finance/data/repositories/finance-filters.repository'
import { toIstDayEnd, toIstDayStart } from '@/features/finance/utils/filters'
import type { FinanceFilters } from '@/features/finance/types'
import { mswServer } from '@/test/msw/server'

// Live golden-master parity gate. Opt-in: requires a service-role connection.
// Run with:
//   PARITY=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run \
//     src/features/finance/__tests__/finance-resolver-parity.test.ts
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

// Arbitrary bounds. We assert parity between old and new on the SAME dataset,
// never the contents of these ranges — so they stay valid as data changes.
const WIDE = { dateFrom: '2025-09-01', dateTo: '2026-05-31' }
const NARROW = { dateFrom: '2026-04-01', dateTo: '2026-05-31' }

function usesIstBoundary(field: FinanceFilters['dateFilterField']): boolean {
  return (
    field === 'payment_released_date' ||
    field === 'finance_approved_date' ||
    field === 'submitted_at' ||
    field === 'hod_approved_date'
  )
}

// Calls the new resolver exactly as the future TS wrapper will: date-only values
// are converted to IST day boundaries before being passed as timestamptz.
async function newResolverIds(
  supabase: SupabaseClient,
  filters: FinanceFilters
): Promise<string[]> {
  const useIst = usesIstBoundary(filters.dateFilterField)
  const dateFrom = useIst ? toIstDayStart(filters.dateFrom) : filters.dateFrom
  const dateTo = useIst ? toIstDayEnd(filters.dateTo) : filters.dateTo

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
    p_date_from: dateFrom,
    p_date_to: dateTo,
  }

  // PostgREST caps a single response at db-max-rows (1000 on this project), so the
  // raw RPC result set must be paged to fetch every id. Server-side consumers
  // (Phase 2+) embed this resolver inside SQL and are unaffected; only a direct
  // REST call like this test needs to page. Order by id so offset paging is stable.
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

function sortedUnique(ids: string[] | null): string[] {
  return [...new Set(ids ?? [])].sort()
}

// Real fixture values fetched from the live dataset at runtime (never hardcoded,
// so the suite survives data refreshes). Any value that isn't present is skipped.
type Samples = {
  claimStatus?: string
  designation?: string
  hodApprover?: string
  workLocation?: string
  employeeName?: string
  employeeId?: string
  claimNumber?: string
}

async function fetchSamples(supabase: SupabaseClient): Promise<Samples> {
  const [statusRes, empRes, claimRes, ahRes] = await Promise.all([
    supabase
      .from('claim_statuses')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('employees')
      .select('employee_id, employee_name, designation_id')
      .not('designation_id', 'is', null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('expense_claims')
      .select('claim_number, work_location_id')
      .not('work_location_id', 'is', null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('approval_history')
      .select('approver_employee_id')
      .not('approver_employee_id', 'is', null)
      .limit(1)
      .maybeSingle(),
  ])

  return {
    claimStatus: statusRes.data?.id,
    designation: empRes.data?.designation_id ?? undefined,
    employeeId: empRes.data?.employee_id ?? undefined,
    employeeName: empRes.data?.employee_name ?? undefined,
    workLocation: claimRes.data?.work_location_id ?? undefined,
    claimNumber: claimRes.data?.claim_number ?? undefined,
    hodApprover: ahRes.data?.approver_employee_id ?? undefined,
  }
}

describe.skipIf(!ENABLED)('finance resolver parity (old TS vs new SQL)', () => {
  let supabase: SupabaseClient
  let samples: Samples

  beforeAll(async () => {
    // This is a live-network integration suite. The global MSW server
    // (vitest.setup.ts) listens with onUnhandledRequest: 'error', which would
    // block real Supabase calls. Register a passthrough so requests to the
    // Supabase host are forwarded to the real network instead of intercepted.
    mswServer.use(
      http.all(`${process.env.SUPABASE_URL}/*`, () => passthrough())
    )

    supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false } }
    )
    samples = await fetchSamples(supabase)
  })

  it('matches the old implementation across the filter matrix (set + count + perf)', async () => {
    const cases: Array<{ name: string; filters: FinanceFilters }> = [
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
        filters: { ...BASE, dateFilterField: 'payment_released_date', ...WIDE },
      },
      {
        name: 'payment_released narrow',
        filters: {
          ...BASE,
          dateFilterField: 'payment_released_date',
          ...NARROW,
        },
      },
      {
        name: 'finance_approved wide',
        filters: { ...BASE, dateFilterField: 'finance_approved_date', ...WIDE },
      },
      {
        name: 'hod_approved wide',
        filters: { ...BASE, dateFilterField: 'hod_approved_date', ...WIDE },
      },
      {
        name: 'actionFilter rejected_allow_reclaim',
        filters: { ...BASE, actionFilter: 'rejected_allow_reclaim' },
      },
      {
        name: 'actionFilter finance_rejected',
        filters: { ...BASE, actionFilter: 'finance_rejected' },
      },
    ]

    // Data-dependent cases — added only when a real value exists in this dataset.
    if (samples.claimStatus) {
      cases.push({
        name: 'claimStatus',
        filters: { ...BASE, claimStatus: samples.claimStatus },
      })
      cases.push({
        name: 'claimStatus allow_resubmit',
        filters: {
          ...BASE,
          claimStatus: `${samples.claimStatus}:allow_resubmit`,
        },
      })
    }
    if (samples.designation)
      cases.push({
        name: 'ownerDesignation',
        filters: { ...BASE, ownerDesignation: samples.designation },
      })
    if (samples.hodApprover)
      cases.push({
        name: 'hodApprover',
        filters: { ...BASE, hodApproverEmployeeId: samples.hodApprover },
      })
    if (samples.workLocation)
      cases.push({
        name: 'workLocation',
        filters: { ...BASE, workLocation: samples.workLocation },
      })
    if (samples.employeeName)
      cases.push({
        name: 'employeeName',
        filters: { ...BASE, employeeName: samples.employeeName },
      })
    if (samples.employeeId)
      cases.push({
        name: 'employeeId',
        filters: { ...BASE, employeeId: samples.employeeId },
      })
    if (samples.claimNumber)
      cases.push({
        name: 'claimNumber',
        filters: { ...BASE, claimNumber: samples.claimNumber },
      })

    const timings: Array<{
      name: string
      oldMs: number
      newMs: number
      n: number
    }> = []
    // Cases where the old path returns its `null` "no id-restriction" sentinel
    // (e.g. a non-reclaim actionFilter). That is not a claim-id filter the
    // resolver owns, so there is no id-set to compare — record and skip.
    const skipped: string[] = []

    for (const { name, filters } of cases) {
      const t0 = performance.now()
      const oldIds = await getFilteredClaimIdsForFinance(supabase, filters)
      const t1 = performance.now()

      if (oldIds === null) {
        skipped.push(name)
        continue
      }

      const newIds = await newResolverIds(supabase, filters)
      const t2 = performance.now()

      const oldSet = sortedUnique(oldIds)
      const newSet = sortedUnique(newIds)

      // count parity first (cheap, clear failure), then exact set parity.
      expect(newSet.length, `count mismatch: ${name}`).toBe(oldSet.length)
      expect(newSet, `set mismatch: ${name}`).toEqual(oldSet)

      timings.push({ name, oldMs: t1 - t0, newMs: t2 - t1, n: oldSet.length })
    }

    // Performance is INFORMATIONAL ONLY (timings on a shared live DB are noisy, so
    // a hard threshold would flake). Print per-case + aggregate timings for human
    // judgement; never fail the suite on timing. The hard gate is parity above.
    const oldTotal = timings.reduce((acc, t) => acc + t.oldMs, 0)
    const newTotal = timings.reduce((acc, t) => acc + t.newMs, 0)
     
    console.table(
      timings.map((t) => ({
        ...t,
        oldMs: Math.round(t.oldMs),
        newMs: Math.round(t.newMs),
      }))
    )
     
    console.log(
      `PARITY perf total (informational): old=${Math.round(oldTotal)}ms new=${Math.round(newTotal)}ms`
    )
    if (skipped.length > 0) {
       
      console.log(
        `PARITY skipped (old returned null / no id-restriction): ${skipped.join(', ')}`
      )
    }

    // Guard: parity must have actually compared something, otherwise a misconfigured
    // run that skips everything would look green.
    expect(timings.length, 'no parity cases were compared').toBeGreaterThan(0)
  }, 120_000)
})
