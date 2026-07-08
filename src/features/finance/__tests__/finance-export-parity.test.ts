import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { http, passthrough } from 'msw'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  getFinanceHistoryPaginated,
  getFinancePaymentJournalTotals,
} from '@/features/finance/data/queries'
import { accumulatePaymentJournalsEmployeeTotals } from '@/features/finance/utils/payment-journals-export'
import type { FinanceFilters } from '@/features/finance/types'
import { mswServer } from '@/test/msw/server'

// Live golden-master parity gate for the Phase 4 payment-journals export aggregation.
// Opt-in: requires a service-role connection. Run with:
//   PARITY=1 NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run \
//     src/features/finance/__tests__/finance-export-parity.test.ts
// SUPABASE_URL is accepted as a fallback alias for NEXT_PUBLIC_SUPABASE_URL.
//
// What this proves: the new single GROUP BY RPC (get_finance_payment_journal_totals,
// surfaced via getFinancePaymentJournalTotals) produces the SAME per-employee totals as
// the LEGACY path — paging the Approved History feed and accumulating in Node with the
// seenClaimIds Set (accumulatePaymentJournalsEmployeeTotals). Both consume the identical
// feed scope, so equality demonstrates the SQL aggregate reproduces the TS accumulation,
// including its distinct-claim deduplication. Totals are compared at the 2-decimal
// precision the CSV actually emits (toFixed(2)) — JS float summation vs SQL numeric sum
// only ever differ in float noise below that, which the export rounds away.
const ENABLED = process.env.PARITY === '1'
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''

// Smaller than the route's 800 so the legacy baseline exercises MANY keyset pages
// (the dataset has ~2.6k history actions), and so the per-page .in('id', ...) enrichment
// URL stays comfortably short.
const PAGE_SIZE = 200

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

// Legacy baseline: page the (now SQL-keyset) history feed and accumulate per-employee
// totals in Node exactly as the pre-Phase-4 export route did.
async function legacyTotals(
  supabase: SupabaseClient,
  filters: FinanceFilters
): Promise<Map<string, number>> {
  const seenClaimIds = new Set<string>()
  const totalsByEmployeeId = new Map<string, number>()
  let cursor: string | null = null

  for (;;) {
    const page = await getFinanceHistoryPaginated(
      supabase,
      cursor,
      PAGE_SIZE,
      filters
    )

    accumulatePaymentJournalsEmployeeTotals({
      historyRows: page.data,
      seenClaimIds,
      totalsByEmployeeId,
    })

    if (!page.hasNextPage || !page.nextCursor) {
      break
    }

    cursor = page.nextCursor
  }

  return totalsByEmployeeId
}

function round2(value: number): string {
  return value.toFixed(2)
}

function grandTotal(totals: Map<string, number>): number {
  let sum = 0
  for (const value of totals.values()) {
    sum += value
  }
  return sum
}

function assertTotalsEqual(
  actual: Map<string, number>,
  expected: Map<string, number>,
  label: string
) {
  // employee count identical
  expect(actual.size, `employee count mismatch: ${label}`).toBe(expected.size)

  // employees present identical (same set of employee_ids)
  expect([...actual.keys()].sort(), `employee set mismatch: ${label}`).toEqual(
    [...expected.keys()].sort()
  )

  // per-employee totals identical (at exported 2-decimal precision)
  for (const [employeeId, expectedTotal] of expected) {
    expect(
      round2(actual.get(employeeId) ?? Number.NaN),
      `total mismatch for ${employeeId}: ${label}`
    ).toBe(round2(expectedTotal))
  }

  // grand total identical — catches dedup bugs a per-employee spot check would miss
  expect(round2(grandTotal(actual)), `grand total mismatch: ${label}`).toBe(
    round2(grandTotal(expected))
  )
}

// Map a claim id to its OWNER employee business code (employees.employee_id), via the
// employee_id FK. Avoids a PostgREST embed: expense_claims has several FKs to employees
// (owner + approver levels), so an unqualified employees embed is ambiguous.
async function ownerEmployeeIdForClaim(
  supabase: SupabaseClient,
  claimId: string
): Promise<string | undefined> {
  const { data: claim, error: claimError } = await supabase
    .from('expense_claims')
    .select('employee_id')
    .eq('id', claimId)
    .maybeSingle()
  if (claimError) throw new Error(claimError.message)
  const ownerUuid = (claim as { employee_id?: string } | null)?.employee_id
  if (!ownerUuid) return undefined

  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('employee_id')
    .eq('id', ownerUuid)
    .maybeSingle()
  if (empError) throw new Error(empError.message)
  return (employee as { employee_id?: string } | null)?.employee_id ?? undefined
}

async function fetchSampleEmployeeId(
  supabase: SupabaseClient
): Promise<string | undefined> {
  // An employee (business code) that owns a claim with a finance_action, so the
  // employee-filtered case actually scopes to a non-empty set.
  const { data, error } = await supabase
    .from('finance_actions')
    .select('claim_id')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const claimId = (data as { claim_id?: string } | null)?.claim_id
  return claimId ? ownerEmployeeIdForClaim(supabase, claimId) : undefined
}

async function findMultiActionClaim(
  supabase: SupabaseClient
): Promise<{ claimId: string; employeeId: string } | null> {
  // A claim that owns more than one finance_action — its presence proves the
  // distinct-claim dedup path is genuinely exercised. Scan a claim_id-ordered window;
  // adjacent equal claim_ids are a multi-action claim.
  const { data, error } = await supabase
    .from('finance_actions')
    .select('claim_id')
    .order('claim_id', { ascending: true })
    .range(0, 999)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{ claim_id: string }>

  let duplicateClaimId: string | null = null
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].claim_id === rows[i - 1].claim_id) {
      duplicateClaimId = rows[i].claim_id
      break
    }
  }
  if (!duplicateClaimId) return null

  const employeeId = await ownerEmployeeIdForClaim(supabase, duplicateClaimId)
  return employeeId ? { claimId: duplicateClaimId, employeeId } : null
}

describe.skipIf(!ENABLED)('finance payment-journals export parity', () => {
  let supabase: SupabaseClient
  let sampleEmployeeId: string | undefined

  // The global vitest.setup.ts resets MSW handlers in afterEach, so re-register the
  // Supabase passthrough before EVERY test (beforeAll alone only survives a single test).
  beforeEach(() => {
    mswServer.use(http.all(`${SUPABASE_URL}/*`, () => passthrough()))
  })

  beforeAll(async () => {
    mswServer.use(http.all(`${SUPABASE_URL}/*`, () => passthrough()))
    supabase = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false } }
    )
    sampleEmployeeId = await fetchSampleEmployeeId(supabase)
  })

  it('matches legacy per-employee totals across the export filter matrix', async () => {
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
        filters: { ...BASE, dateFilterField: 'payment_released_date', ...WIDE },
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
        name: 'payment_released action filter',
        filters: { ...BASE, actionFilter: 'payment_released' },
      },
      {
        name: 'finance_rejected action filter',
        filters: { ...BASE, actionFilter: 'finance_rejected' },
      },
      {
        name: 'rejected_allow_reclaim action filter',
        filters: { ...BASE, actionFilter: 'rejected_allow_reclaim' },
      },
    ]

    if (sampleEmployeeId) {
      cases.push({
        name: 'employee filter',
        filters: { ...BASE, employeeId: sampleEmployeeId },
      })
    }

    let compared = 0
    for (const { name, filters } of cases) {
      const [legacy, next] = await Promise.all([
        legacyTotals(supabase, filters),
        getFinancePaymentJournalTotals(supabase, filters),
      ])
      assertTotalsEqual(next, legacy, name)
      compared += 1
    }

    // Guard: a misconfigured run that compared nothing must not look green.
    expect(compared, 'no parity cases were compared').toBeGreaterThan(0)
  }, 180_000)

  it('deduplicates claims with multiple finance actions (no double counting)', async () => {
    const multi = await findMultiActionClaim(supabase)
    expect(
      multi,
      'dataset must contain a multi-action claim to exercise dedup'
    ).not.toBeNull()
    if (!multi) return

    // Scope to the owner of a claim that has multiple finance_actions. The legacy path
    // dedups that claim via its seenClaimIds Set; the RPC dedups via select distinct.
    // Equality proves the claim contributes to the employee total exactly once.
    const filters: FinanceFilters = { ...BASE, employeeId: multi.employeeId }
    const [legacy, next] = await Promise.all([
      legacyTotals(supabase, filters),
      getFinancePaymentJournalTotals(supabase, filters),
    ])

    assertTotalsEqual(
      next,
      legacy,
      `employee ${multi.employeeId} (multi-action claim ${multi.claimId})`
    )
  }, 120_000)
})
