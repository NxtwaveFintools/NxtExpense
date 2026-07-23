# Remove Redundant Location Joins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove four dead PostgREST LEFT JOINs from `CLAIM_COLUMNS` that duplicate data already stored in snapshot columns, and add DB constraints that encode the trigger invariant.

**Architecture:** `CLAIM_COLUMNS` is a PostgREST select string used by four paginated read paths. It currently fetches location names via both snapshot text columns (stored on `expense_claims`) and live LEFT JOINs to `states`/`cities`. `mapClaimRow` always prefers the snapshot via `??`, so the JOIN results are fetched and immediately discarded on every query. The fix removes the JOIN clauses from the select string and simplifies `mapClaimRow` to read snapshot columns directly. A `NOT VALID` migration adds four CHECK constraints encoding the trigger invariant so the snapshot guarantee is enforced at the DB level.

**Tech Stack:** TypeScript / Vitest, Supabase PostgREST, PostgreSQL CHECK constraints.

---

## File Map

| File                                                                        | Action                                                                                                                                  |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/claims/data/queries/claim-columns.ts`                         | Modify — remove 4 JOIN clauses from `LEGACY_CLAIM_COLUMNS`; remove 4 dead `const` vars from `mapClaimRow`; simplify 4 field assignments |
| `src/features/claims/data/queries/__tests__/claim-columns.test.ts`          | Modify — add failing test; delete fallback test; clean prefers-snapshot mock; add `not.toContain` assertions                            |
| `supabase/migrations/20260622120000_add_snapshot_invariant_constraints.sql` | Create — four CHECK constraints with NOT VALID + VALIDATE                                                                               |

No other files are touched. The `Claim` type and all call sites are unchanged — the resolved display fields (`outstation_state_name`, `outstation_city_name`, `from_city_name`, `to_city_name`) keep the same names.

---

## Task 1: Write the contract-defining failing test

**Files:**

- Modify: `src/features/claims/data/queries/__tests__/claim-columns.test.ts`

- [ ] **Step 1.1: Add the failing test at the end of the describe block**

Open `src/features/claims/data/queries/__tests__/claim-columns.test.ts`. After the closing `})` of the "falls back to master location names" test (line 80) and before the closing `})` of the `describe` block (line 81), add:

```ts
it('ignores live join data when snapshot is null — snapshot is the sole source of truth', () => {
  const mapped = mapClaimRow({
    id: 'claim-3',
    allow_resubmit: false,
    is_superseded: false,
    outstation_state_name_snapshot: null,
    outstation_city_name_snapshot: null,
    from_city_name_snapshot: null,
    to_city_name_snapshot: null,
    // Join-shaped props included to prove mapClaimRow does not fall back to them
    outstation_state: { state_name: 'Should Be Ignored' },
    outstation_city: { city_name: 'Should Be Ignored' },
    from_city_data: { city_name: 'Should Be Ignored' },
    to_city_data: { city_name: 'Should Be Ignored' },
    claim_statuses: {
      status_code: 'SUBMITTED',
      status_name: 'Submitted',
      display_color: 'warning',
      is_terminal: false,
      is_rejection: false,
      allow_resubmit_status_name: null,
      allow_resubmit_display_color: null,
    },
    work_locations: { location_name: 'Field - Outstation' },
    expense_locations: { location_name: 'Urban', region_code: 'U' },
    vehicle_types: null,
  })

  expect(mapped.outstation_state_name).toBeNull()
  expect(mapped.outstation_city_name).toBeNull()
  expect(mapped.from_city_name).toBeNull()
  expect(mapped.to_city_name).toBeNull()
})
```

- [ ] **Step 1.2: Run the test to verify it fails**

```
npx vitest run src/features/claims/data/queries/__tests__/claim-columns.test.ts
```

Expected: **FAIL** on the new test. The current fallback fires (`null ?? 'Should Be Ignored'`), so the actual values will be `"Should Be Ignored"` instead of `null`. The other two tests should still pass.

---

## Task 2: Implement — simplify mapClaimRow

**Files:**

- Modify: `src/features/claims/data/queries/claim-columns.ts:27-68`

- [ ] **Step 2.1: Remove the four dead `const` declarations**

In `mapClaimRow`, find and remove these four `const` declarations (lines 27–30 and 33–41). Keep `expenseLocation` (lines 31–33) unchanged.

Remove:

```ts
const outstationCity = Array.isArray(r.outstation_city)
  ? r.outstation_city[0]
  : r.outstation_city
```

```ts
const outstationState = Array.isArray(r.outstation_state)
  ? r.outstation_state[0]
  : r.outstation_state
const fromCityObj = Array.isArray(r.from_city_data)
  ? r.from_city_data[0]
  : r.from_city_data
const toCityObj = Array.isArray(r.to_city_data)
  ? r.to_city_data[0]
  : r.to_city_data
```

After removal the only `const` block before the `return` is:

```ts
  const statusInfo = Array.isArray(r.claim_statuses)
    ? r.claim_statuses[0]
    : r.claim_statuses
  const statusCode = statusInfo?.status_code
  const statusDisplay = getClaimStatusDisplay({ ... })
  const expenseLocation = Array.isArray(r.expense_locations)
    ? r.expense_locations[0]
    : r.expense_locations
```

- [ ] **Step 2.2: Simplify the four location-name assignments in the return object**

Find and replace these four lines in the `return { ... } as Claim` block:

```ts
// BEFORE — replace all four of these:
    outstation_state_name:
      r.outstation_state_name_snapshot ?? outstationState?.state_name ?? null,
```

```ts
    outstation_city_name:
      r.outstation_city_name_snapshot ?? outstationCity?.city_name ?? null,
    from_city_name: r.from_city_name_snapshot ?? fromCityObj?.city_name ?? null,
    to_city_name: r.to_city_name_snapshot ?? toCityObj?.city_name ?? null,
```

```ts
// AFTER — snapshot columns are the sole source of truth:
    outstation_state_name: r.outstation_state_name_snapshot as string | null,
    outstation_city_name: r.outstation_city_name_snapshot as string | null,
    from_city_name: r.from_city_name_snapshot as string | null,
    to_city_name: r.to_city_name_snapshot as string | null,
```

The `as string | null` cast is needed because `r` is typed as `Record<string, unknown>`. The outer `as Claim` at the end of the return covers the full object; these casts just silence `unknown` assignment on the individual fields.

- [ ] **Step 2.3: Run the targeted tests to confirm the new test now passes**

```
npx vitest run src/features/claims/data/queries/__tests__/claim-columns.test.ts
```

Expected: **all 4 tests pass** (including the new one and the existing "falls back" test — we haven't deleted that yet).

---

## Task 3: Update CLAIM_COLUMNS and the column-projection test

**Files:**

- Modify: `src/features/claims/data/queries/claim-columns.ts:4-5`
- Modify: `src/features/claims/data/queries/__tests__/claim-columns.test.ts:9-14`

- [ ] **Step 3.1: Remove the four JOIN clauses from `LEGACY_CLAIM_COLUMNS`**

In `claim-columns.ts`, replace the `LEGACY_CLAIM_COLUMNS` string (line 5). The current value contains these four join segments that must be removed:

```
outstation_state:states!outstation_state_id(state_name), outstation_city:cities!outstation_city_id(city_name), from_city_data:cities!from_city_id(city_name), to_city_data:cities!to_city_id(city_name),
```

The new `LEGACY_CLAIM_COLUMNS` value (one string, no newlines):

```ts
const LEGACY_CLAIM_COLUMNS =
  'id, claim_number, employee_id, claim_date, work_location_id, work_locations(location_name), expense_location_id, expense_locations(location_name, region_code), own_vehicle_used, vehicle_type_id, vehicle_types(vehicle_name), outstation_state_id, outstation_city_id, from_city_id, to_city_id, outstation_state_name_snapshot, outstation_city_name_snapshot, from_city_name_snapshot, to_city_name_snapshot, km_travelled, total_amount, status_id, claim_statuses!status_id(status_code, status_name, display_color, allow_resubmit_status_name, allow_resubmit_display_color, is_terminal, is_rejection), allow_resubmit, is_superseded, current_approval_level, submitted_at, created_at, updated_at, resubmission_count, last_rejection_notes, last_rejected_at, accommodation_nights, food_with_principals_amount'
```

- [ ] **Step 3.2: Update the column-projection test to also assert joins are absent**

In `claim-columns.test.ts`, replace the first `it(...)` block:

```ts
// BEFORE:
it('includes snapshot location columns in claim projection', () => {
  expect(CLAIM_COLUMNS).toContain('outstation_state_name_snapshot')
  expect(CLAIM_COLUMNS).toContain('outstation_city_name_snapshot')
  expect(CLAIM_COLUMNS).toContain('from_city_name_snapshot')
  expect(CLAIM_COLUMNS).toContain('to_city_name_snapshot')
})
```

```ts
// AFTER:
it('includes snapshot location columns and excludes live join aliases in claim projection', () => {
  expect(CLAIM_COLUMNS).toContain('outstation_state_name_snapshot')
  expect(CLAIM_COLUMNS).toContain('outstation_city_name_snapshot')
  expect(CLAIM_COLUMNS).toContain('from_city_name_snapshot')
  expect(CLAIM_COLUMNS).toContain('to_city_name_snapshot')
  expect(CLAIM_COLUMNS).not.toContain('outstation_state:states')
  expect(CLAIM_COLUMNS).not.toContain('outstation_city:cities')
  expect(CLAIM_COLUMNS).not.toContain('from_city_data:cities')
  expect(CLAIM_COLUMNS).not.toContain('to_city_data:cities')
})
```

- [ ] **Step 3.3: Run targeted tests to verify they still pass**

```
npx vitest run src/features/claims/data/queries/__tests__/claim-columns.test.ts
```

Expected: **all 4 tests pass**.

---

## Task 4: Delete the fallback test and clean the prefers-snapshot mock

**Files:**

- Modify: `src/features/claims/data/queries/__tests__/claim-columns.test.ts`

- [ ] **Step 4.1: Delete the "falls back to master location names" test case**

Remove the entire third `it(...)` block (lines 49–80 in the original file — the test titled `'falls back to master location names when snapshots are not present'`). This test validated behaviour that is now intentionally removed: null snapshot must not fall back to live join data.

- [ ] **Step 4.2: Remove join props from the "prefers snapshot" mock**

In the second `it(...)` block (`'prefers snapshot location names over current master names'`), remove the four join-shaped properties from the mock input. These properties are never fetched after the CLAIM_COLUMNS change, so including them verifies nothing:

```ts
// REMOVE these four lines from the mock object in the "prefers snapshot" test:
      outstation_state: { state_name: 'Current State' },
      outstation_city: { city_name: 'Current City' },
      from_city_data: { city_name: 'Current From' },
      to_city_data: { city_name: 'Current To' },
```

The mock should now contain only the snapshot columns (`outstation_state_name_snapshot: 'Historical State'`, etc.) alongside the required `claim_statuses`, `work_locations`, `expense_locations`, and `vehicle_types` props.

- [ ] **Step 4.3: Run targeted tests one final time**

```
npx vitest run src/features/claims/data/queries/__tests__/claim-columns.test.ts
```

Expected: **all 3 tests pass** (the fallback test is gone; the remaining three reflect the new contract).

---

## Task 5: Verify the full test suite and type safety

**Files:** (no changes — verification only)

- [ ] **Step 5.1: Run the full unit test suite**

```
npm test
```

Expected: **all tests pass**. The four affected read paths (`claims.repository.ts`, `approvals.repository.ts`, `finance-queue.repository.ts`, `finance-history.repository.ts`) all pass `CLAIM_COLUMNS` directly to Supabase and are not unit-tested at the PostgREST layer, so no changes are needed there. Tests that build `Claim` objects using the resolved display fields (`outstation_state_name`, etc.) are unaffected.

- [ ] **Step 5.2: Run the TypeScript compiler**

```
npx tsc --noEmit
```

Expected: **zero errors**. The removed `const` vars (`outstationCity`, `outstationState`, `fromCityObj`, `toCityObj`) had no consumers other than the assignments we just replaced. If `tsc` reports "variable is declared but never read" errors for any of them, a variable was missed in Task 2 — fix it before continuing.

---

## Task 6: Write the migration

**Files:**

- Create: `supabase/migrations/20260622120000_add_snapshot_invariant_constraints.sql`

- [ ] **Step 6.1: Create the migration file with the exact content below**

```sql
-- Encode the trigger invariant (trg_expense_claims_location_snapshot) as hard
-- schema constraints. If the trigger is ever dropped or bypassed, any attempt
-- to set a location FK without populating its snapshot will be rejected at the
-- DB level rather than silently producing a null display name.
--
-- NOT VALID + VALIDATE CONSTRAINT is the production-safe pattern:
--   ADD CONSTRAINT NOT VALID — brief metadata lock, no table scan.
--   VALIDATE CONSTRAINT     — ShareUpdateExclusiveLock (non-blocking), scans rows.
ALTER TABLE public.expense_claims
  ADD CONSTRAINT expense_claims_state_snapshot_consistent
    CHECK (outstation_state_id IS NULL OR outstation_state_name_snapshot IS NOT NULL)
    NOT VALID,
  ADD CONSTRAINT expense_claims_outstation_city_snapshot_consistent
    CHECK (outstation_city_id IS NULL OR outstation_city_name_snapshot IS NOT NULL)
    NOT VALID,
  ADD CONSTRAINT expense_claims_from_city_snapshot_consistent
    CHECK (from_city_id IS NULL OR from_city_name_snapshot IS NOT NULL)
    NOT VALID,
  ADD CONSTRAINT expense_claims_to_city_snapshot_consistent
    CHECK (to_city_id IS NULL OR to_city_name_snapshot IS NOT NULL)
    NOT VALID;

ALTER TABLE public.expense_claims
  VALIDATE CONSTRAINT expense_claims_state_snapshot_consistent;
ALTER TABLE public.expense_claims
  VALIDATE CONSTRAINT expense_claims_outstation_city_snapshot_consistent;
ALTER TABLE public.expense_claims
  VALIDATE CONSTRAINT expense_claims_from_city_snapshot_consistent;
ALTER TABLE public.expense_claims
  VALIDATE CONSTRAINT expense_claims_to_city_snapshot_consistent;
```

---

## Task 7: Commit

**Files:**

- `src/features/claims/data/queries/claim-columns.ts`
- `src/features/claims/data/queries/__tests__/claim-columns.test.ts`
- `supabase/migrations/20260622120000_add_snapshot_invariant_constraints.sql`
- `docs/superpowers/specs/2026-06-22-remove-redundant-location-joins-design.md`
- `docs/superpowers/plans/2026-06-22-remove-redundant-location-joins.md`

- [ ] **Step 7.1: Stage and commit**

```bash
git add \
  src/features/claims/data/queries/claim-columns.ts \
  src/features/claims/data/queries/__tests__/claim-columns.test.ts \
  supabase/migrations/20260622120000_add_snapshot_invariant_constraints.sql \
  docs/superpowers/specs/2026-06-22-remove-redundant-location-joins-design.md \
  docs/superpowers/plans/2026-06-22-remove-redundant-location-joins.md
```

```bash
git commit -m "perf: remove redundant location joins from CLAIM_COLUMNS

Every CLAIM_COLUMNS query issued four unnecessary LEFT JOINs to states/cities
whose results were immediately discarded because mapClaimRow always prefers the
snapshot columns. Snapshot coverage is 100% (17K claims, 0 gaps) and the
trigger trg_expense_claims_location_snapshot guarantees it going forward.

- Remove four PostgREST join clauses from LEGACY_CLAIM_COLUMNS
- Simplify mapClaimRow to read snapshot columns directly (no fallback)
- Delete the fallback test; the fallback was not only dead but semantically
  wrong — it would have displayed current master data instead of historical
  submission data if it ever fired
- Add four CHECK constraints (NOT VALID + VALIDATE) encoding the trigger
  invariant so a future trigger drop cannot silently corrupt display names"
```
