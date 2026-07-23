# Design: Remove Redundant Location Joins from CLAIM_COLUMNS

**Date:** 2026-06-22
**Status:** Approved
**Effort:** ~1–2 hours
**Risk:** Very low — TypeScript-only change + non-destructive DB constraint

---

## Problem

Every query that uses `CLAIM_COLUMNS` fetches the same four city/state display
names twice:

**Fetch 1 — snapshot text columns stored directly on `expense_claims`:**

```
outstation_state_name_snapshot
outstation_city_name_snapshot
from_city_name_snapshot
to_city_name_snapshot
```

**Fetch 2 — four live PostgREST LEFT JOINs for the identical data:**

```
outstation_state:states!outstation_state_id(state_name)
outstation_city:cities!outstation_city_id(city_name)
from_city_data:cities!from_city_id(city_name)
to_city_data:cities!to_city_id(city_name)
```

`mapClaimRow` picks the snapshot first (`r.outstation_state_name_snapshot ??
outstationState?.state_name ?? null`), so the JOIN result is fetched on every
query but the `??` short-circuits — the live JOIN data is **never used**.

`CLAIM_COLUMNS` is consumed in four hot read paths: My Claims pagination,
Pending Approvals pagination, Finance Queue pagination, and Finance History
pagination. Each page fetch issues four unnecessary LEFT JOINs to `states` and
`cities` and discards their output.

---

## Why the Fallback Is Now Dead Code

Migration `20260521162000_admin_state_city_management_and_historical_freeze.sql`
did three things atomically:

1. Added the four snapshot columns to `expense_claims`.
2. Backfilled all existing claims via `UPDATE … FROM states/cities`.
3. Created `trg_expense_claims_location_snapshot` — a `BEFORE INSERT OR UPDATE`
   trigger that populates all four snapshot columns whenever the corresponding
   FK is set.

Live verification on test DB (17,664 claims):

| Snapshot column                  | FK-set count | Snapshot-populated count | Gap   |
| -------------------------------- | ------------ | ------------------------ | ----- |
| `outstation_state_name_snapshot` | 256          | 256                      | **0** |
| `outstation_city_name_snapshot`  | 256          | 256                      | **0** |
| `from_city_name_snapshot`        | 133          | 133                      | **0** |
| `to_city_name_snapshot`          | 133          | 133                      | **0** |

The invariant is: **when the FK is set the snapshot is populated; when the FK
is NULL the snapshot is NULL.** The fallback branch `?? outstationState?.state_name`
has never fired. Beyond being unreachable, the fallback is also semantically
incorrect: if it ever did execute it would display the **current** master-table
name rather than the historical name at submission time, silently corrupting
the audit trail. Deleting it is a domain-correctness improvement, not just
dead-code removal.

---

## Snapshot Immutability

The snapshot columns represent **historical fact** — the state and city names
as they existed when the claim was submitted. The snapshot trigger fires on
`UPDATE OF outstation_state_id, outstation_city_id, from_city_id, to_city_id`,
so if a city or state is later renamed in the master table the snapshot is
unchanged. This is intentional: display and export must show what was true at
submission time.

---

## Approach Selected: B — TypeScript Cleanup + DB Constraint

Remove the four live JOIN clauses (TypeScript change, zero migration needed for
the app to work). Additionally add four `CHECK` constraints that encode the
trigger invariant in the DB, so a future trigger drop or accidental bypass
becomes a hard constraint violation rather than a silent display NULL.

---

## Changes

### 1. `src/features/claims/data/queries/claim-columns.ts`

**`CLAIM_COLUMNS` string — remove the four live JOIN clauses.**

Remove from `LEGACY_CLAIM_COLUMNS`:

```
outstation_state:states!outstation_state_id(state_name),
outstation_city:cities!outstation_city_id(city_name),
from_city_data:cities!from_city_id(city_name),
to_city_data:cities!to_city_id(city_name),
```

Keep the four snapshot columns:

```
outstation_state_name_snapshot,
outstation_city_name_snapshot,
from_city_name_snapshot,
to_city_name_snapshot
```

**`mapClaimRow` — remove dead variables and simplify four assignments.**

Remove the four `const` declarations that destructure the now-absent JOIN
objects:

```ts
// DELETE these four lines:
const outstationCity = ...
const outstationState = ...
const fromCityObj = ...
const toCityObj = ...
```

Replace the four `??`-chained fallback assignments with direct snapshot reads:

```ts
// BEFORE:
outstation_state_name: r.outstation_state_name_snapshot ?? outstationState?.state_name ?? null,
outstation_city_name:  r.outstation_city_name_snapshot  ?? outstationCity?.city_name  ?? null,
from_city_name:        r.from_city_name_snapshot        ?? fromCityObj?.city_name     ?? null,
to_city_name:          r.to_city_name_snapshot          ?? toCityObj?.city_name       ?? null,

// AFTER (r is Record<string, unknown>; the outer as Claim cast at return covers the whole object):
outstation_state_name: r.outstation_state_name_snapshot as string | null,
outstation_city_name:  r.outstation_city_name_snapshot  as string | null,
from_city_name:        r.from_city_name_snapshot        as string | null,
to_city_name:          r.to_city_name_snapshot          as string | null,
```

No change to the `Claim` type or any call site — the resolved field names
(`outstation_state_name`, `outstation_city_name`, `from_city_name`,
`to_city_name`) are unchanged.

### 2. `src/features/claims/data/queries/__tests__/claim-columns.test.ts`

**Remove the "falls back to master location names" test case** (lines 49–80).
That test validates the now-deleted fallback path. It passes `null` snapshots
and expects live-join values — after the fix, `null` snapshot → `null` output,
which is the correct new behaviour.

**Update the "prefers snapshot" test case** to remove the live-join properties
(`outstation_state`, `outstation_city`, `from_city_data`, `to_city_data`) from
the mock input — they are no longer fetched, so passing them verifies nothing.

**Optionally add a test case** confirming that when all four snapshot columns
are `null` (FK also NULL), `mapClaimRow` returns `null` for all four display
name fields.

### 3. New migration — DB CHECK constraints

Create migration `YYYYMMDDHHMMSS_add_snapshot_invariant_constraints.sql`
(timestamp to be assigned at creation time):

```sql
-- Encode the trigger invariant in the schema so a future trigger drop
-- cannot produce a FK-set / snapshot-null mismatch silently.
-- NOT VALID defers row-level validation, avoiding a full table scan during
-- ALTER TABLE and keeping the migration fast on large tables.
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

-- Validate each constraint separately. VALIDATE CONSTRAINT acquires only a
-- ShareUpdateExclusiveLock (non-blocking) while scanning existing rows.
ALTER TABLE public.expense_claims
  VALIDATE CONSTRAINT expense_claims_state_snapshot_consistent;
ALTER TABLE public.expense_claims
  VALIDATE CONSTRAINT expense_claims_outstation_city_snapshot_consistent;
ALTER TABLE public.expense_claims
  VALIDATE CONSTRAINT expense_claims_from_city_snapshot_consistent;
ALTER TABLE public.expense_claims
  VALIDATE CONSTRAINT expense_claims_to_city_snapshot_consistent;
```

`NOT VALID` + separate `VALIDATE CONSTRAINT` is the standard production pattern:
`ADD CONSTRAINT` acquires only a brief metadata lock, while validation runs
non-blocking against existing rows. They carry no RLS or index cost.

---

## What Does NOT Change

- The `Claim` TypeScript type — display field names are unchanged.
- All other JOIN clauses in `CLAIM_COLUMNS` (`work_locations`, `expense_locations`,
  `vehicle_types`, `claim_statuses`) — those do not have snapshot equivalents and
  are required for display.
- The snapshot trigger `trg_expense_claims_location_snapshot` — not touched.
- All tests that build `Claim` objects directly using `outstation_state_name` /
  `outstation_city_name` / `from_city_name` / `to_city_name` as already-resolved
  display strings — those are unaffected.

---

## Test Strategy

- **Unit:** Updated `claim-columns.test.ts` (two test cases affected, one new
  optional case).
- **Type-check:** `tsc --noEmit` — verifies no call site depends on the removed
  JOIN alias properties.
- **Existing integration tests** (`approval-routing.test.ts`,
  `approval-permissions.test.ts`, `bc-expense-export.test.ts`,
  `payment-journals-export.test.ts`) — these construct `Claim` objects directly
  from the resolved display fields, so they are unaffected and serve as
  regression coverage.

---

## Rollback

The TypeScript change and the DB constraints are independently reversible.
Reverting `claim-columns.ts` restores the previous query shape (JOIN+fallback)
without touching the DB. The CHECK constraints can be dropped separately at
any point without affecting application behaviour:

```sql
ALTER TABLE public.expense_claims
  DROP CONSTRAINT expense_claims_state_snapshot_consistent,
  DROP CONSTRAINT expense_claims_outstation_city_snapshot_consistent,
  DROP CONSTRAINT expense_claims_from_city_snapshot_consistent,
  DROP CONSTRAINT expense_claims_to_city_snapshot_consistent;
```
