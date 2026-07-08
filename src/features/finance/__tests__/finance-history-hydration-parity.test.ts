import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { http, passthrough } from 'msw'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { CLAIM_COLUMNS, mapClaimRow } from '@/features/claims/data/queries'
import type { Claim } from '@/features/claims/types'
import {
  FINANCE_OWNER_COLUMNS,
  normalizeFinanceOwner,
  type ExpenseClaimWithOwnerRow,
} from '@/features/finance/data/repositories/finance-shared.repository'
import { mapHydratedHistoryRow } from '@/features/finance/data/repositories/finance-history.repository'
import { mswServer } from '@/test/msw/server'

// Field-level parity gate for the Phase-6 single-RPC hydration rewrite
// (docs/superpowers/plans/2026-07-01-finance-history-single-rpc-hydration.md).
//
// finance-list-parity.test.ts already proves get_finance_history_page's ID
// ORDERING/pagination is unchanged. It says nothing about whether the ~50 hand-ported
// columns/joins in the new hydrated version produce IDENTICAL field VALUES to today's
// PostgREST embed path — that's what this file checks: for a live sample of rows,
// fetch via the new RPC AND independently re-fetch the SAME claim/action via the
// exact legacy embed query, map both, and deep-compare every declared field.
//
// IMPORTANT — what this test does NOT prove: this connects with
// SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely. It validates query/join
// correctness, not "does a real Finance user's `authenticated` session see the same
// data." Verified separately (this session, live): the 5 newly-joined reference
// tables (designations/work_locations/expense_locations/vehicle_types/claim_statuses)
// plus `employees` all have unconditional `SELECT ... USING (true)` policies for
// `authenticated` today — but if that ever changes, THIS test would not catch it.
// Only a live e2e run as a real logged-in test account (Task 5) covers that risk.
//
// Run with:
//   PARITY=1 NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run \
//     src/features/finance/__tests__/finance-history-hydration-parity.test.ts
const ENABLED = process.env.PARITY === '1'
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''

// Declared Claim fields to compare 1:1. Deliberately excludes fields the LEGACY
// mapClaimRow leaks as extra untyped runtime keys via its `...r` spread
// (work_locations, expense_locations, vehicle_types, claim_statuses, work_location_id,
// vehicle_type_id) — those were never part of the Claim contract and the new mapper
// correctly does not reproduce them. Comparing this explicit list is the actual
// definition of "field-level parity", not raw object equality across two
// differently-shaped legacy/new objects.
const CLAIM_FIELDS_TO_COMPARE: Array<keyof Claim> = [
  'id',
  'claim_number',
  'employee_id',
  'claim_date',
  'work_location',
  'expense_location_id',
  'expense_location_name',
  'expense_region_code',
  'base_location_day_type_code',
  'own_vehicle_used',
  'vehicle_type',
  'outstation_state_id',
  'outstation_city_id',
  'from_city_id',
  'to_city_id',
  'has_intercity_travel',
  'has_intracity_travel',
  'intercity_own_vehicle_used',
  'intracity_own_vehicle_used',
  'intracity_vehicle_mode',
  'outstation_state_name',
  'outstation_city_name',
  'from_city_name',
  'to_city_name',
  'km_travelled',
  'total_amount',
  'statusName',
  'statusDisplayColor',
  'status_id',
  'is_terminal',
  'is_rejection',
  'allow_resubmit',
  'is_superseded',
  'current_approval_level',
  'submitted_at',
  'created_at',
  'updated_at',
  'resubmission_count',
  'last_rejection_notes',
  'last_rejected_at',
  'accommodation_nights',
  'food_with_principals_amount',
]

type HydratedRow = Parameters<typeof mapHydratedHistoryRow>[0]

async function fetchLegacyClaimAndOwner(
  supabase: SupabaseClient,
  claimId: string
): Promise<{ claim: Claim; owner: ReturnType<typeof normalizeFinanceOwner> }> {
  const { data, error } = await supabase
    .from('expense_claims')
    .select(
      `${CLAIM_COLUMNS}, employees!employee_id!inner(${FINANCE_OWNER_COLUMNS})`
    )
    .eq('id', claimId)
    .single()
  if (error) throw new Error(error.message)

  const row = data as ExpenseClaimWithOwnerRow
  const ownerRelation = Array.isArray(row.employees)
    ? row.employees[0]
    : row.employees
  const owner = normalizeFinanceOwner(ownerRelation)
  const claimFields = { ...mapClaimRow(row) } as Record<string, unknown>
  delete claimFields.employees

  return { claim: claimFields as Claim, owner }
}

async function fetchLegacyAction(supabase: SupabaseClient, actionId: string) {
  const { data, error } = await supabase
    .from('finance_actions')
    .select(
      'id, claim_id, actor_employee_id, action, notes, acted_at, actor:employees!actor_employee_id(employee_email, employee_name)'
    )
    .eq('id', actionId)
    .single()
  if (error) throw new Error(error.message)

  const row = data as {
    id: string
    claim_id: string
    action: string
    notes: string | null
    acted_at: string
    actor:
      | { employee_email: string; employee_name: string }
      | { employee_email: string; employee_name: string }[]
      | null
  }
  const actorRaw = row.actor
  const actor = Array.isArray(actorRaw) ? actorRaw[0] : actorRaw

  return {
    id: row.id,
    claim_id: row.claim_id,
    actor_email: actor?.employee_email ?? '',
    actor_name: actor?.employee_name ?? null,
    action: row.action,
    notes: row.notes,
    acted_at: row.acted_at,
  }
}

describe.skipIf(!ENABLED)('finance history hydration field parity', () => {
  let supabase: SupabaseClient

  function allowSupabasePassthrough() {
    mswServer.use(http.all(`${SUPABASE_URL}/*`, () => passthrough()))
  }

  beforeAll(() => {
    allowSupabasePassthrough()
    supabase = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false } }
    )
  })

  beforeEach(() => {
    allowSupabasePassthrough()
  })

  async function sampleRows(args: Record<string, unknown>, limit: number) {
    const { data, error } = await supabase.rpc('get_finance_history_page', {
      p_has_filters: false,
      p_date_field: 'claim_date',
      ...args,
      p_limit: limit,
    })
    if (error) throw new Error(error.message)
    return ((data ?? []) as HydratedRow[]).slice(0, limit)
  }

  it('matches the legacy embed-based mapping field-by-field for a live sample', async () => {
    const rows = await sampleRows({}, 30)
    expect(rows.length, 'expected a non-empty live sample').toBeGreaterThan(0)

    // Widen coverage: also pull rows through an action filter, to exercise a
    // different action_type / status combination than the unfiltered "latest" sample.
    const rejectedRows = await sampleRows(
      { p_action_filter: 'finance_rejected' },
      10
    )

    let compared = 0
    for (const row of [...rows, ...rejectedRows]) {
      const {
        claim: newClaim,
        owner: newOwner,
        action: newAction,
      } = mapHydratedHistoryRow(row)
      const legacy = await fetchLegacyClaimAndOwner(supabase, row.claim_id)
      const legacyAction = await fetchLegacyAction(supabase, row.id)

      for (const field of CLAIM_FIELDS_TO_COMPARE) {
        expect(
          newClaim[field],
          `claim.${field} mismatch for claim ${row.claim_id}`
        ).toEqual(legacy.claim[field])
      }
      expect(newOwner, `owner mismatch for claim ${row.claim_id}`).toEqual(
        legacy.owner
      )
      expect(newAction, `action mismatch for action ${row.id}`).toEqual(
        legacyAction
      )
      compared += 1
    }

    // Guard: a misconfigured run that compared nothing must not look green.
    expect(compared, 'no rows were compared').toBeGreaterThan(0)
  }, 120_000)

  it('includes at least one row with a LEFT-joined optional relation absent (null vehicle_type / expense_location), proving the join does not drop the row', async () => {
    const rows = await sampleRows({}, 200)
    const withNullVehicle = rows.find((r) => r.vehicle_type_id === null)
    expect(
      withNullVehicle,
      'expected at least one sampled row with no vehicle_type_id to exercise the LEFT join — widen the sample if this fails'
    ).toBeDefined()
    if (!withNullVehicle) return

    const { claim } = mapHydratedHistoryRow(withNullVehicle)
    expect(claim.vehicle_type).toBeNull()

    const legacy = await fetchLegacyClaimAndOwner(
      supabase,
      withNullVehicle.claim_id
    )
    expect(legacy.claim.vehicle_type).toBeNull()
  }, 60_000)

  it('documents the untestable-with-live-data edge case: no orphaned actor/status references exist today', async () => {
    // Verified live 2026-07-01: zero finance_actions rows have a null actor_employee_id
    // or null-resolving status_id in this dataset, so the actor/claim_statuses LEFT
    // JOIN's "row preserved, field null" behavior (vs the wrong INNER JOIN the first
    // SQL draft used — see the review doc) cannot be exercised with real data right
    // now. The join type is verified correct structurally (matches the source embed's
    // lack of `!inner`), not empirically via a live null case. This test exists so
    // that fact is asserted, not silently assumed.
    const { count, error } = await supabase
      .from('finance_actions')
      .select('id', { count: 'exact', head: true })
      .is('actor_employee_id', null)
    if (error) throw new Error(error.message)
    expect(count).toBe(0)
  }, 30_000)
})

describe('CLAIM_COLUMNS vs. hydrated RPC output — drift detector', () => {
  // Splits a PostgREST select-column string on top-level commas (respecting nested
  // parens), so `claim_statuses!status_id(a, b, c)` stays one token, not three.
  function splitTopLevel(input: string): string[] {
    const tokens: string[] = []
    let depth = 0
    let current = ''
    for (const char of input) {
      if (char === '(') depth += 1
      if (char === ')') depth -= 1
      if (char === ',' && depth === 0) {
        tokens.push(current.trim())
        current = ''
        continue
      }
      current += char
    }
    if (current.trim()) tokens.push(current.trim())
    return tokens
  }

  // relation name -> Claim field(s) it's expected to derive. Any CLAIM_COLUMNS token
  // NOT in this map and NOT in FLAT_FIELDS_DROPPED_INTENTIONALLY is required to appear
  // as an identically-named key in the hydrated Claim mapping. If a future column is
  // added to CLAIM_COLUMNS and this test starts failing, that's the point: it means
  // the new RPC / mapHydratedHistoryRow needs the same field added.
  const EMBED_RELATION_TO_CLAIM_FIELDS: Record<string, Array<keyof Claim>> = {
    work_locations: ['work_location'],
    expense_locations: ['expense_location_name', 'expense_region_code'],
    vehicle_types: ['vehicle_type'],
    claim_statuses: [
      'statusName',
      'statusDisplayColor',
      'is_terminal',
      'is_rejection',
    ],
  }

  // Flat CLAIM_COLUMNS fields that are intentionally NOT part of the Claim type (the
  // legacy mapClaimRow leaks these as extra untyped runtime keys via its `...r`
  // spread; Claim only ever declared the derived name instead).
  const FLAT_FIELDS_DROPPED_INTENTIONALLY = new Set([
    'work_location_id',
    'vehicle_type_id',
  ])

  // Flat CLAIM_COLUMNS fields mapClaimRow renames (not embeds — just a different
  // Claim key than the raw column name). Caught by this detector failing on
  // "outstation_state_name_snapshot" during initial authoring — the same "_snapshot"
  // rename applies to all four snapshot fields, not just one.
  const FLAT_FIELD_RENAMES: Record<string, keyof Claim> = {
    outstation_state_name_snapshot: 'outstation_state_name',
    outstation_city_name_snapshot: 'outstation_city_name',
    from_city_name_snapshot: 'from_city_name',
    to_city_name_snapshot: 'to_city_name',
  }

  it('every CLAIM_COLUMNS field has a corresponding Claim field on the hydrated mapping', () => {
    const tokens = splitTopLevel(CLAIM_COLUMNS)
    const claimFieldNames = new Set(CLAIM_FIELDS_TO_COMPARE as string[])

    for (const token of tokens) {
      const isEmbed = token.includes('(')
      if (isEmbed) {
        const relationName = token.split(/[!(]/)[0].trim()
        const expectedFields = EMBED_RELATION_TO_CLAIM_FIELDS[relationName]
        expect(
          expectedFields,
          `CLAIM_COLUMNS embeds "${relationName}" but no expected-Claim-field mapping is registered for it in this drift detector — add one`
        ).toBeDefined()
        for (const field of expectedFields ?? []) {
          expect(
            claimFieldNames.has(field),
            `expected Claim field "${field}" (derived from CLAIM_COLUMNS relation "${relationName}") is missing from CLAIM_FIELDS_TO_COMPARE`
          ).toBe(true)
        }
        continue
      }

      const flatName = token.trim()
      if (FLAT_FIELDS_DROPPED_INTENTIONALLY.has(flatName)) {
        continue
      }
      const expectedClaimField = FLAT_FIELD_RENAMES[flatName] ?? flatName
      expect(
        claimFieldNames.has(expectedClaimField),
        `CLAIM_COLUMNS has flat field "${flatName}" with no corresponding Claim field ` +
          `("${expectedClaimField}") — either add it to CLAIM_FIELDS_TO_COMPARE (and ` +
          'mapHydratedHistoryRow / the SQL function), register a rename in ' +
          'FLAT_FIELD_RENAMES, or add it to FLAT_FIELDS_DROPPED_INTENTIONALLY with a reason'
      ).toBe(true)
    }
  })
})
