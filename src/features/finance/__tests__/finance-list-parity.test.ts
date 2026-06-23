import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { http, passthrough } from 'msw'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { MAX_APPROVAL_LEVEL } from '@/lib/constants/approval-levels'
import type { FinanceFilters } from '@/features/finance/types'
import {
  hasFinanceClaimFilters,
  toIstDayEnd,
  toIstDayStart,
} from '@/features/finance/utils/filters'
import { getFinanceActionCodesForFilter } from '@/features/finance/utils/action-filter'
import {
  getFinanceActionCodesForDateFilter,
  isFinanceActionDateFilterField,
} from '@/features/finance/data/repositories/filter-date-resolvers.repository'
import { mswServer } from '@/test/msw/server'

// Live list-pagination parity gate (Phase 3a). Opt-in: requires a service-role
// connection AND the Phase 3 migrations applied to the target DB. Run with:
//   PARITY=1 NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run \
//     src/features/finance/__tests__/finance-list-parity.test.ts
// SUPABASE_URL is accepted as a fallback alias for NEXT_PUBLIC_SUPABASE_URL.
//
// Strategy (see plan Task 5): the new page RPCs are keyset-paginated in SQL. We
// page through ALL pages of each RPC and assert the concatenated sequence is:
//   (1) duplicate-free,
//   (2) globally sorted by (time desc, id desc) — a TOTAL order whose `id`
//       tiebreaker makes the correct ordering unique, and
//   (3) a SET equal to the Phase-1-validated membership reference.
// (1)+(2)+(3) together prove the paged sequence IS the unique correct ordered
// sequence — no separate ordered reference list needed. hasNextPage / nextCursor
// progression and duplicate-timestamp (limit=1) cases are asserted explicitly.
const ENABLED = process.env.PARITY === '1'
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''

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

const REST_PAGE = 1000

function usesIstBoundary(field: FinanceFilters['dateFilterField']): boolean {
  return (
    field === 'payment_released_date' ||
    field === 'finance_approved_date' ||
    field === 'submitted_at' ||
    field === 'hod_approved_date'
  )
}

// Resolver args exactly as the repositories build them (IST conversion for every
// date field except claim_date).
function resolverDateArgs(filters: FinanceFilters): {
  p_date_from: string | null
  p_date_to: string | null
} {
  const useIst = usesIstBoundary(filters.dateFilterField)
  return {
    p_date_from: useIst ? toIstDayStart(filters.dateFrom) : filters.dateFrom,
    p_date_to: useIst ? toIstDayEnd(filters.dateTo) : filters.dateTo,
  }
}

function resolverFilterArgs(
  filters: FinanceFilters,
  requiredStatusId: string | null
): Record<string, unknown> {
  return {
    p_required_status_id: requiredStatusId,
    p_employee_id: filters.employeeId,
    p_employee_name: filters.employeeName,
    p_claim_number: filters.claimNumber,
    p_owner_designation: filters.ownerDesignation,
    p_hod_approver_emp: filters.hodApproverEmployeeId,
    p_claim_status: filters.claimStatus,
    p_work_location: filters.workLocation,
    p_action_filter: filters.actionFilter,
    p_date_field: filters.dateFilterField,
    ...resolverDateArgs(filters),
  }
}

async function getFinanceReviewStatusId(
  supabase: SupabaseClient
): Promise<string> {
  const { data, error } = await supabase
    .from('claim_statuses')
    .select('id')
    .eq('approval_level', MAX_APPROVAL_LEVEL)
    .eq('is_rejection', false)
    .eq('is_terminal', false)
    .eq('is_approval', false)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('no finance-review status found')
  return data.id as string
}

// Page the resolver RPC (capped by db-max-rows on a direct REST call) into a full
// set of claim ids. Mirrors finance-resolver-parity's newResolverIds.
async function pageResolverClaimIds(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<Set<string>> {
  const ids = new Set<string>()
  for (let from = 0; ; from += REST_PAGE) {
    const { data, error } = await supabase
      .rpc('finance_filtered_claim_ids', args)
      .order('id', { ascending: true })
      .range(from, from + REST_PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{ id: string }>
    for (const r of rows) ids.add(r.id)
    if (rows.length < REST_PAGE) break
  }
  return ids
}

// Reference MEMBERSHIP set for the queue: resolver-scoped finance-review claims
// (filtered), or all finance-review claims (no filters).
async function referenceQueueClaimIds(
  supabase: SupabaseClient,
  filters: FinanceFilters,
  financeStatusId: string
): Promise<Set<string>> {
  if (hasFinanceClaimFilters(filters)) {
    return pageResolverClaimIds(
      supabase,
      resolverFilterArgs(filters, financeStatusId)
    )
  }
  const ids = new Set<string>()
  for (let from = 0; ; from += REST_PAGE) {
    const { data, error } = await supabase
      .from('expense_claims')
      .select('id')
      .eq('status_id', financeStatusId)
      .order('id', { ascending: true })
      .range(from, from + REST_PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{ id: string }>
    for (const r of rows) ids.add(r.id)
    if (rows.length < REST_PAGE) break
  }
  return ids
}

// Compute the bounded feed action codes exactly as the history repository does.
async function feedActionCodesFor(
  supabase: SupabaseClient,
  filters: FinanceFilters
): Promise<{ codes: string[] | null; actionDate: boolean }> {
  const actionDateField = isFinanceActionDateFilterField(
    filters.dateFilterField
  )
    ? filters.dateFilterField
    : null
  const filterByActionDate =
    actionDateField !== null && Boolean(filters.dateFrom || filters.dateTo)

  if (filterByActionDate) {
    const codes = await getFinanceActionCodesForDateFilter(
      supabase,
      actionDateField
    )
    return { codes, actionDate: true }
  }
  if (filters.actionFilter) {
    return {
      codes: getFinanceActionCodesForFilter(filters.actionFilter),
      actionDate: false,
    }
  }
  return { codes: null, actionDate: false }
}

// Reference MEMBERSHIP set for the history feed: finance_actions filtered by feed
// action codes + (action-date) window, intersected with the resolver claim set
// only when claim filters are present (mirrors the page RPC's p_has_filters gate).
async function referenceHistoryActionIds(
  supabase: SupabaseClient,
  filters: FinanceFilters
): Promise<Set<string>> {
  const { codes, actionDate } = await feedActionCodesFor(supabase, filters)
  const feedFrom = actionDate ? toIstDayStart(filters.dateFrom) : null
  const feedTo = actionDate ? toIstDayEnd(filters.dateTo) : null

  const resolverSet = hasFinanceClaimFilters(filters)
    ? await pageResolverClaimIds(supabase, resolverFilterArgs(filters, null))
    : null

  const ids = new Set<string>()
  // keyset-page finance_actions to dodge db-max-rows on a direct REST call.
  let cursor: { acted_at: string; id: string } | null = null
  for (;;) {
    let q = supabase
      .from('finance_actions')
      .select('id, claim_id, acted_at')
      .order('acted_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(REST_PAGE)
    if (codes) q = q.in('action', codes)
    if (feedFrom) q = q.gte('acted_at', feedFrom)
    if (feedTo) q = q.lte('acted_at', feedTo)
    if (cursor) {
      q = q.or(
        `acted_at.lt.${cursor.acted_at},and(acted_at.eq.${cursor.acted_at},id.lt.${cursor.id})`
      )
    }
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{
      id: string
      claim_id: string
      acted_at: string
    }>
    for (const r of rows) {
      if (resolverSet && !resolverSet.has(r.claim_id)) continue
      ids.add(r.id)
    }
    if (rows.length < REST_PAGE) break
    const last = rows[rows.length - 1]
    cursor = { acted_at: last.acted_at, id: last.id }
  }
  return ids
}

type PageRow = { id: string; time: string }

// Page a keyset RPC across ALL pages, returning the full ordered row sequence and
// the per-page hasNextPage progression.
async function pageRpcAll(
  supabase: SupabaseClient,
  rpc: 'get_finance_queue_page' | 'get_finance_history_page',
  baseArgs: Record<string, unknown>,
  timeField: 'created_at' | 'acted_at',
  cursorTimeParam: 'p_cursor_created_at' | 'p_cursor_acted_at',
  limit: number
): Promise<{ rows: PageRow[]; progression: boolean[] }> {
  const rows: PageRow[] = []
  const progression: boolean[] = []
  let cursorTime: string | null = null
  let cursorId: string | null = null

  for (;;) {
    const { data, error } = await supabase.rpc(rpc, {
      ...baseArgs,
      [cursorTimeParam]: cursorTime,
      p_cursor_id: cursorId,
      p_limit: limit,
    })
    if (error) throw new Error(error.message)
    const page = (data ?? []) as Array<Record<string, string>>
    const hasNext = page.length > limit
    const bounded = hasNext ? page.slice(0, limit) : page
    for (const r of bounded) rows.push({ id: r.id, time: r[timeField] })
    progression.push(hasNext)
    if (!hasNext) break
    const last = bounded[bounded.length - 1]
    cursorTime = last[timeField]
    cursorId = last.id
    // Safety valve against an accidental infinite loop in a broken keyset.
    if (rows.length > 1_000_000) throw new Error('runaway pagination')
  }
  return { rows, progression }
}

function assertStrictlyDescending(rows: PageRow[], label: string) {
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]
    const cur = rows[i]
    const tp = Date.parse(prev.time)
    const tc = Date.parse(cur.time)
    const ordered = tp > tc || (tp === tc && prev.id > cur.id)
    expect(ordered, `not strictly (time desc, id desc) at ${i}: ${label}`).toBe(
      true
    )
  }
}

function assertNoDuplicates(rows: PageRow[], label: string) {
  const set = new Set(rows.map((r) => r.id))
  expect(set.size, `duplicate ids in page sequence: ${label}`).toBe(rows.length)
}

function assertProgression(progression: boolean[], label: string) {
  // every page reports hasNextPage=true except the final page (false).
  for (let i = 0; i < progression.length; i++) {
    const expected = i < progression.length - 1
    expect(
      progression[i],
      `hasNextPage progression at page ${i}: ${label}`
    ).toBe(expected)
  }
}

function sortedArray(set: Set<string>): string[] {
  return [...set].sort()
}

describe.skipIf(!ENABLED)(
  'finance list pagination parity (new SQL RPCs)',
  () => {
    let supabase: SupabaseClient
    let financeStatusId: string

    // The global vitest.setup.ts resets MSW runtime handlers in afterEach, so a
    // passthrough registered once in beforeAll is dropped after the first test —
    // every later test would then hit onUnhandledRequest:'error'. Re-register the
    // passthrough before EACH test (and in beforeAll, for the status-id fetch).
    function allowSupabasePassthrough() {
      mswServer.use(http.all(`${SUPABASE_URL}/*`, () => passthrough()))
    }

    beforeAll(async () => {
      allowSupabasePassthrough()
      supabase = createClient(
        SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY as string,
        { auth: { persistSession: false } }
      )
      financeStatusId = await getFinanceReviewStatusId(supabase)
    })

    beforeEach(() => {
      allowSupabasePassthrough()
    })

    function queueArgs(filters: FinanceFilters): Record<string, unknown> {
      return {
        ...resolverFilterArgs(filters, financeStatusId),
        p_has_filters: hasFinanceClaimFilters(filters),
      }
    }

    async function historyArgs(
      filters: FinanceFilters
    ): Promise<Record<string, unknown>> {
      const { codes, actionDate } = await feedActionCodesFor(supabase, filters)
      // get_finance_history_page has no p_required_status_id param (it embeds the
      // resolver with that arg defaulting to null) — mirror buildHistoryResolverArgs
      // and drop the key the shared resolverFilterArgs adds, else PostgREST 404s.
      const resolverArgs = resolverFilterArgs(filters, null)
      delete resolverArgs.p_required_status_id
      return {
        ...resolverArgs,
        p_has_filters: hasFinanceClaimFilters(filters),
        p_feed_action_codes: codes,
        p_feed_from: actionDate ? toIstDayStart(filters.dateFrom) : null,
        p_feed_to: actionDate ? toIstDayEnd(filters.dateTo) : null,
      }
    }

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
        name: 'actionFilter finance_rejected',
        filters: { ...BASE, actionFilter: 'finance_rejected' },
      },
      {
        name: 'actionFilter rejected_allow_reclaim',
        filters: { ...BASE, actionFilter: 'rejected_allow_reclaim' },
      },
    ]

    it('queue: ordered ID sequence + set + pagination parity across the filter matrix', async () => {
      for (const { name, filters } of cases) {
        const reference = await referenceQueueClaimIds(
          supabase,
          filters,
          financeStatusId
        )
        const { rows, progression } = await pageRpcAll(
          supabase,
          'get_finance_queue_page',
          queueArgs(filters),
          'created_at',
          'p_cursor_created_at',
          10
        )
        assertNoDuplicates(rows, `queue ${name}`)
        assertStrictlyDescending(rows, `queue ${name}`)
        assertProgression(progression, `queue ${name}`)
        expect(rows.length, `queue count: ${name}`).toBe(reference.size)
        expect(
          sortedArray(new Set(rows.map((r) => r.id))),
          `queue set: ${name}`
        ).toEqual(sortedArray(reference))
      }
    }, 300_000)

    it('history: ordered ID sequence + set + pagination parity across the filter matrix', async () => {
      for (const { name, filters } of cases) {
        const reference = await referenceHistoryActionIds(supabase, filters)
        const { rows, progression } = await pageRpcAll(
          supabase,
          'get_finance_history_page',
          await historyArgs(filters),
          'acted_at',
          'p_cursor_acted_at',
          10
        )
        assertNoDuplicates(rows, `history ${name}`)
        assertStrictlyDescending(rows, `history ${name}`)
        assertProgression(progression, `history ${name}`)
        expect(rows.length, `history count: ${name}`).toBe(reference.size)
        expect(
          sortedArray(new Set(rows.map((r) => r.id))),
          `history set: ${name}`
        ).toEqual(sortedArray(reference))
      }
    }, 300_000)

    // Cursor edge cases — this is where pagination bugs hide. limit=1 forces a page
    // boundary between EVERY row, including any rows that share a timestamp (the
    // case the id tiebreaker exists for): each must appear exactly once, in
    // (time desc, id desc) order, with no skip or repeat across the boundary.
    it('queue: limit=1 paging is exhaustive, ordered, and duplicate-free', async () => {
      const reference = await referenceQueueClaimIds(
        supabase,
        BASE,
        financeStatusId
      )
      const { rows, progression } = await pageRpcAll(
        supabase,
        'get_finance_queue_page',
        queueArgs(BASE),
        'created_at',
        'p_cursor_created_at',
        1
      )
      assertNoDuplicates(rows, 'queue limit=1')
      assertStrictlyDescending(rows, 'queue limit=1')
      assertProgression(progression, 'queue limit=1')
      expect(rows.length).toBe(reference.size)
      expect(sortedArray(new Set(rows.map((r) => r.id)))).toEqual(
        sortedArray(reference)
      )
    }, 300_000)

    it('history: limit=1 paging is exhaustive, ordered, and duplicate-free', async () => {
      const reference = await referenceHistoryActionIds(supabase, BASE)
      const { rows, progression } = await pageRpcAll(
        supabase,
        'get_finance_history_page',
        await historyArgs(BASE),
        'acted_at',
        'p_cursor_acted_at',
        1
      )
      assertNoDuplicates(rows, 'history limit=1')
      assertStrictlyDescending(rows, 'history limit=1')
      assertProgression(progression, 'history limit=1')
      expect(rows.length).toBe(reference.size)
      expect(sortedArray(new Set(rows.map((r) => r.id)))).toEqual(
        sortedArray(reference)
      )
    }, 300_000)

    it('empty result: a filter matching nothing returns [] with hasNextPage=false', async () => {
      const empty: FinanceFilters = {
        ...BASE,
        claimNumber: '__NO_SUCH_CLAIM__',
      }
      const { data: qData, error: qErr } = await supabase.rpc(
        'get_finance_queue_page',
        { ...queueArgs(empty), p_limit: 10 }
      )
      expect(qErr).toBeNull()
      expect((qData ?? []).length).toBe(0)

      const { data: hData, error: hErr } = await supabase.rpc(
        'get_finance_history_page',
        { ...(await historyArgs(empty)), p_limit: 10 }
      )
      expect(hErr).toBeNull()
      expect((hData ?? []).length).toBe(0)
    }, 120_000)
  }
)
