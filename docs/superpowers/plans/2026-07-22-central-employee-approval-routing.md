# Central-Team Approval Routing (Option E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route Chandramouli's (`NW0003405`) claims direct to Mansoor (HOD) instead of via SBH, while keeping him a BOA in all reporting, and make future approval-chain misconfiguration fail loudly instead of silently stranding claims.

**Architecture:** Add a nullable per-employee override `employees.approval_start_level` consulted at submit time ahead of `designation_approval_flow.required_approval_levels[0]`. Post-submit routing is untouched — it runs off `claim_status_transitions` and never reads designation. A guard rejects submission when the resolved start level is 1 but no Level-1 approver is assigned. The config-snapshot trigger stamps the override so each claim's audit record explains itself.

**Tech Stack:** Next.js (App Router, server actions), TypeScript, Supabase/Postgres, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-22-central-employee-approval-routing-design.md`

---

## ⚠️ Standing constraints for this repo

Two of the user's standing preferences override this skill's defaults:

1. **Never run `git commit`.** The user commits all work themselves. Tasks below end at a **Checkpoint** (verified, stopping point) — do not commit.
2. **Never apply migrations.** Write migration files only. The user applies them. Read-only SQL via Supabase MCP is fine.

Task 1 produces a single `.sql` file that sits unapplied until the user runs it. **Tasks 2–4 are code-only and their unit tests pass without the migration applied** (the DB column is not needed for mocked tests). Task 5 is manual verification and requires the user to have applied the migration first.

**Single migration by design.** The column, constraint, comment, data update, and trigger replacement live in one file because Postgres DDL is transactional — Supabase wraps each migration file in a transaction, so the whole feature commits or rolls back as a unit. Splitting it would open a window where the column exists but the trigger still omits `approval_start_level_override`, so any claim submitted in that window would carry an audit record that cannot explain why it started where it did. The one ordering requirement — `ALTER TABLE` before `CREATE OR REPLACE FUNCTION` — is satisfied by the file's ordering.

---

## Landmine: existing tests will break in Task 4

**[VERIFIED]** Three test files submit claims with fixtures that have **no L1 approver** while mocking a flow of `[1]`:

| File                                                             | Tests | Fixture (line) | Flow mock (line) |
| ---------------------------------------------------------------- | ----- | -------------- | ---------------- |
| `src/features/claims/__tests__/claim-actions.test.ts`            | 10    | `:161`         | `:188` → `[1]`   |
| `src/features/claims/__tests__/claim-actions-branches.test.ts`   | 17    | `:225`         | `:288` → `[1]`   |
| `src/features/claims/__tests__/claim-race-and-atomicity.test.ts` | 3     | `:148`         | `:165` → `[1]`   |

The Task 4 guard fires on exactly that combination, so **all three fixtures must gain an L1 approver in the same task that adds the guard.** This is expected and correct — those fixtures were modelling an employee who could never actually submit. Task 4 handles it explicitly.

---

## File Structure

| File                                                                           | Responsibility                                                                             | Action |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------ |
| `supabase/migrations/20260722100000_central_employee_approval_start_level.sql` | Column, CHECK, comment, data update **and** snapshot-trigger replacement — one atomic unit | Create |
| `src/lib/services/employee-service.ts`                                         | `EmployeeRow` type + `EMPLOYEE_COLUMNS` select list                                        | Modify |
| `src/features/claims/server/services/submit-claim.orchestrator.ts`             | Override resolution + guard                                                                | Modify |
| `src/features/claims/__tests__/approval-start-level.test.ts`                   | New behaviour coverage                                                                     | Create |
| `src/features/claims/__tests__/claim-actions.test.ts`                          | Fixture fix                                                                                | Modify |
| `src/features/claims/__tests__/claim-actions-branches.test.ts`                 | Fixture fix                                                                                | Modify |
| `src/features/claims/__tests__/claim-race-and-atomicity.test.ts`               | Fixture fix                                                                                | Modify |

---

## Task 1: Migration — column, data, and snapshot trigger (single atomic file)

Both database changes ship in one file so the feature applies atomically. See "Single migration by design" above for why.

**Files:**

- Create: `supabase/migrations/20260722100000_central_employee_approval_start_level.sql`

- [ ] **Step 1: Write the first half — column, constraint, comment, data**

Create the file with this content. Step 2 appends the trigger to the same file.

```sql
-- Per-employee approval start-level override.
--
-- Approval routing is two independent mechanisms:
--   1. WHERE a claim starts  — designation_approval_flow.required_approval_levels[0]
--   2. every hop AFTER that  — claim_status_transitions, keyed on from_status_id only
--
-- Only element [0] of required_approval_levels has any runtime effect; the tail
-- is decorative (getNextApprovalLevel is dead code, imported by tests only).
-- This column overrides that single value for one employee, without changing
-- their designation — so all reporting, analytics, and CSV exports continue to
-- count them under their real designation. That reporting continuity is the
-- reason this approach was chosen over creating a new designation.
--
-- Values: 1 = start at SBH stage, 2 = start at HOD stage.
-- 3 is deliberately excluded: stage 3 is Finance and has no approver column, so
-- a value of 3 would route the claim PAST the HOD straight to Finance
-- (claims.repository.ts nulls current_approval_level for firstLevel >= 3).
--
-- Business case: Narina Venkata Naga Chandramouli (NW0003405) is a Business
-- Operation Associate on the central team. He has no SBH, so BOA's [1,2,3] flow
-- stranded his claims at stage 1 with no eligible approver.

ALTER TABLE public.employees
  ADD COLUMN approval_start_level smallint NULL;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_approval_start_level_check
  CHECK (approval_start_level IS NULL OR approval_start_level IN (1, 2));

COMMENT ON COLUMN public.employees.approval_start_level IS
  'Per-employee override for the approval stage a new claim starts at. '
  'NULL = use designation_approval_flow.required_approval_levels[0]. '
  'Set to 2 for central-team staff who have no SBH and route direct to HOD. '
  'Only 1 and 2 are valid: stage 3 is Finance and has no approver column.';

UPDATE public.employees
SET approval_start_level = 2
WHERE employee_id = 'NW0003405';
```

- [ ] **Step 2: Append the second half — snapshot trigger replacement**

Append the following to the **same file**, below the `UPDATE`. It must come after the `ALTER TABLE` so the column exists when the function is created.

Without this, the claim's own audit record reports the designation flow `[1,2,3]` while the claim actually started at stage 2 — a self-contradicting record. Audit continuity is the reason this approach was chosen over a new designation, so this is not optional.

`CREATE OR REPLACE FUNCTION` requires the complete body, so the full current function is reproduced with one addition (marked).

```sql
-- ────────────────────────────────────────────────────────────────────────
-- Stamp the override into the claim config snapshot.
--
-- The snapshot's 'approval_flow' key is read from designation_approval_flow
-- by designation. For an employee with approval_start_level set, that key
-- reports the designation's flow (e.g. [1,2,3]) while the claim actually
-- started at the overridden stage — a record that contradicts itself.
-- Recording the override alongside it makes every claim explain why it
-- started where it did.
--
-- Only the 'claim_context' object changes; the rest of the function is
-- reproduced verbatim because CREATE OR REPLACE requires the full body.
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.capture_claim_config_snapshot_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_version_id uuid;
  v_snapshot jsonb;
BEGIN
  SELECT id
  INTO v_version_id
  FROM public.config_versions
  ORDER BY version_number DESC
  LIMIT 1;

  IF v_version_id IS NULL THEN
    INSERT INTO public.config_versions (change_scope, change_summary)
    VALUES ('bootstrap', 'Auto-created baseline configuration version.')
    RETURNING id INTO v_version_id;
  END IF;

  v_snapshot := jsonb_build_object(
    'claim_context',
    jsonb_build_object(
      'claim_id', NEW.id,
      'claim_date', NEW.claim_date,
      'employee_id', NEW.employee_id,
      'designation_id', NEW.designation_id,
      'work_location_id', NEW.work_location_id,
      'base_location_day_type_code', NEW.base_location_day_type_code,
      'vehicle_type_id', NEW.vehicle_type_id,
      'outstation_state_id', NEW.outstation_state_id,
      'has_intercity_travel', NEW.has_intercity_travel,
      'has_intracity_travel', NEW.has_intracity_travel,
      'intercity_own_vehicle_used', NEW.intercity_own_vehicle_used,
      'intracity_own_vehicle_used', NEW.intracity_own_vehicle_used,
      -- ── ADDED: per-employee approval start-level override ──────────────
      'approval_start_level_override',
      (
        SELECT e.approval_start_level
        FROM public.employees e
        WHERE e.id = NEW.employee_id
      )
      -- ───────────────────────────────────────────────────────────────────
    ),
    'state_city_master',
    jsonb_build_object(
      'outstation_state',
      CASE
        WHEN NEW.outstation_state_id IS NULL THEN NULL::jsonb
        ELSE jsonb_build_object(
          'id', NEW.outstation_state_id,
          'name', NEW.outstation_state_name_snapshot
        )
      END,
      'outstation_city',
      CASE
        WHEN NEW.outstation_city_id IS NULL THEN NULL::jsonb
        ELSE jsonb_build_object(
          'id', NEW.outstation_city_id,
          'name', NEW.outstation_city_name_snapshot
        )
      END,
      'from_city',
      CASE
        WHEN NEW.from_city_id IS NULL THEN NULL::jsonb
        ELSE jsonb_build_object(
          'id', NEW.from_city_id,
          'name', NEW.from_city_name_snapshot
        )
      END,
      'to_city',
      CASE
        WHEN NEW.to_city_id IS NULL THEN NULL::jsonb
        ELSE jsonb_build_object(
          'id', NEW.to_city_id,
          'name', NEW.to_city_name_snapshot
        )
      END
    ),
    'designation',
    (
      SELECT to_jsonb(d)
      FROM public.designations d
      WHERE d.id = NEW.designation_id
    ),
    'work_location',
    (
      SELECT to_jsonb(wl)
      FROM public.work_locations wl
      WHERE wl.id = NEW.work_location_id
    ),
    'vehicle_type',
    (
      SELECT to_jsonb(vt)
      FROM public.vehicle_types vt
      WHERE vt.id = NEW.vehicle_type_id
    ),
    'approval_flow',
    (
      SELECT to_jsonb(af)
      FROM public.designation_approval_flow af
      WHERE af.designation_id = NEW.designation_id
        AND af.is_active = true
      ORDER BY af.created_at DESC
      LIMIT 1
    ),
    'allowed_vehicle_types',
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(vt) ORDER BY vt.display_order)
        FROM public.designation_vehicle_permissions p
        JOIN public.vehicle_types vt ON vt.id = p.vehicle_type_id
        WHERE p.designation_id = NEW.designation_id
      ),
      '[]'::jsonb
    ),
    'effective_expense_rates',
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(er) ORDER BY er.expense_type, er.effective_from DESC)
        FROM public.expense_rates er
        WHERE er.location_id = NEW.work_location_id
          AND er.is_active = true
          AND er.effective_from <= NEW.claim_date
          AND (er.effective_to IS NULL OR er.effective_to >= NEW.claim_date)
          AND (er.designation_id IS NULL OR er.designation_id = NEW.designation_id)
      ),
      '[]'::jsonb
    ),
    'validation_rules',
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(vr) ORDER BY vr.rule_code)
        FROM public.validation_rules vr
        WHERE vr.is_active = true
      ),
      '[]'::jsonb
    ),
    'system_settings',
    COALESCE(
      (
        SELECT jsonb_object_agg(ss.setting_key, ss.setting_value)
        FROM public.system_settings ss
        WHERE ss.is_active = true
      ),
      '{}'::jsonb
    )
  );

  INSERT INTO public.claim_config_snapshots (
    claim_id,
    config_version_id,
    snapshot_data
  )
  VALUES (
    NEW.id,
    v_version_id,
    v_snapshot
  )
  ON CONFLICT (claim_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
```

- [ ] **Step 3: Confirm the trigger's only change is the added key**

Read the appended function and diff it mentally against the live definition. The sole difference must be the `approval_start_level_override` pair inside `claim_context`. Any other difference is an accidental edit — revert it. The other ten snapshot keys must be byte-identical, or claims will silently start recording different audit data.

To fetch the live definition for comparison (read-only, safe):

```sql
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'capture_claim_config_snapshot_on_insert';
```

- [ ] **Step 4: Sanity-check the file structure**

Confirm, in order: `ALTER TABLE ... ADD COLUMN` → `ADD CONSTRAINT` → `COMMENT ON COLUMN` → `UPDATE` → `CREATE OR REPLACE FUNCTION`. The `ALTER TABLE` **must** precede the function.

Run: `grep -n "ALTER TABLE\|ADD CONSTRAINT\|COMMENT ON\|^UPDATE\|CREATE OR REPLACE FUNCTION" supabase/migrations/20260722100000_central_employee_approval_start_level.sql`
Expected: five matches in exactly that order, with `CREATE OR REPLACE FUNCTION` last.

- [ ] **Step 5: Checkpoint**

Single migration file written, **not applied**. Report to the user that it is ready to apply. Do not commit.

> **⚠️ Deploy ordering is a hard dependency.** This migration MUST be applied before the
> Task 2–4 code is deployed. Task 2 adds `approval_start_level` to `EMPLOYEE_COLUMNS`, an
> explicit PostgREST select list — if that code reaches an environment without the column,
> every employee fetch fails with "column does not exist", taking down login, claims, and
> approvals. Not a silent fallback: a hard outage. Applying the migration early is safe —
> an unused nullable column changes nothing until the code ships.
>
> (This is the mirror image of the risk described in Task 2: column absent from the select
> list = silent no-op; column absent from the database = total failure.)

---

## Task 2: Expose the column to the application

`EMPLOYEE_COLUMNS` is an **explicit** select list, not `select *`. Omitting the column here makes `employee.approval_start_level` silently `undefined`, the `??` falls through to the designation flow, and the feature does nothing with **no error anywhere**. This is risk 9.1 in the spec — the silent one. Step 1 tests exactly that.

**Files:**

- Modify: `src/lib/services/employee-service.ts:9-21` (type), `:43-44` (select list)
- Create: `src/features/claims/__tests__/approval-start-level.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/claims/__tests__/approval-start-level.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { EMPLOYEE_COLUMNS_FOR_TEST } from '@/lib/services/employee-service'

describe('EMPLOYEE_COLUMNS', () => {
  it('selects approval_start_level so the override is never silently undefined', () => {
    expect(EMPLOYEE_COLUMNS_FOR_TEST).toContain('approval_start_level')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/claims/__tests__/approval-start-level.test.ts`
Expected: FAIL — `EMPLOYEE_COLUMNS_FOR_TEST` is not exported.

- [ ] **Step 3: Add the field to the `EmployeeRow` type**

In `src/lib/services/employee-service.ts`, inside the `EmployeeRow` type, after `approval_employee_id_level_3`:

```ts
approval_employee_id_level_3: string | null
approval_start_level: number | null
```

- [ ] **Step 4: Add the column to the select list and export it for testing**

Replace the `EMPLOYEE_COLUMNS` declaration:

```ts
const EMPLOYEE_COLUMNS =
  'id, employee_id, employee_name, employee_email, designation_id, employee_status_id, approval_employee_id_level_1, approval_employee_id_level_2, approval_employee_id_level_3, approval_start_level, created_at, employee_statuses!employee_status_id(status_code), designations!designation_id(designation_name), employee_states!employee_id(is_primary, state_id, states!state_id(state_name))'

/**
 * Exported for tests only. `EMPLOYEE_COLUMNS` is an explicit select list, so a
 * column missing here reads as `undefined` at runtime with no error — see
 * approval-start-level.test.ts.
 */
export const EMPLOYEE_COLUMNS_FOR_TEST = EMPLOYEE_COLUMNS
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/features/claims/__tests__/approval-start-level.test.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Verify types still compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Checkpoint**

Do not commit.

---

## Task 3: Resolve the override at submit time

**Files:**

- Modify: `src/features/claims/server/services/submit-claim.orchestrator.ts:4-13` (import), `:151-163` (resolver), `:644-647` (call site)
- Modify: `src/features/claims/__tests__/approval-start-level.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/claims/__tests__/approval-start-level.test.ts`:

```ts
import { resolveStartLevel } from '@/features/claims/server/services/submit-claim.orchestrator'

describe('resolveStartLevel', () => {
  it('uses the employee override when set', () => {
    expect(resolveStartLevel(2, [1, 2, 3])).toBe(2)
  })

  it('falls back to the designation flow when the override is null', () => {
    expect(resolveStartLevel(null, [1, 2, 3])).toBe(1)
  })

  it('falls back to the designation flow when the override is undefined', () => {
    expect(resolveStartLevel(undefined, [2, 3])).toBe(2)
  })

  it('returns undefined when neither source provides a level', () => {
    expect(resolveStartLevel(null, [])).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/claims/__tests__/approval-start-level.test.ts`
Expected: FAIL — `resolveStartLevel` is not exported.

- [ ] **Step 3: Add the exported helper**

In `src/features/claims/server/services/submit-claim.orchestrator.ts`, add above the existing `resolveInitialWorkflowState` function (currently line 151):

```ts
/**
 * Resolves which approval stage a new claim starts at.
 *
 * Precedence: the per-employee override wins over the designation flow. Only
 * element [0] of the designation flow has runtime effect — every hop after
 * submit is driven by claim_status_transitions, which never reads designation.
 */
export function resolveStartLevel(
  override: number | null | undefined,
  requiredApprovalLevels: number[] | null | undefined
): number | undefined {
  return override ?? requiredApprovalLevels?.[0]
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/claims/__tests__/approval-start-level.test.ts`
Expected: PASS (5 tests total, including Task 2's)

- [ ] **Step 5: Import the `EmployeeRow` type**

In the same file, change the `employee-service` import (currently lines 10-14) to:

```ts
import {
  getEmployeeByEmail,
  getEmployeePrimaryStateId,
  getEmployeeRoles,
  type EmployeeRow,
} from '@/lib/services/employee-service'
```

- [ ] **Step 6: Rewrite the resolver to take the employee**

Replace the whole `resolveInitialWorkflowState` function (currently lines 151-163):

```ts
async function resolveInitialWorkflowState(
  supabase: SupabaseClient,
  employee: EmployeeRow
) {
  const designationId = employee.designation_id

  if (!designationId) {
    throw new Error('Employee designation is required to submit claims.')
  }

  const approvalFlow = await getDesignationApprovalFlow(supabase, designationId)
  const firstLevel = resolveStartLevel(
    employee.approval_start_level,
    approvalFlow.required_approval_levels
  )

  return resolveInitialWorkflowStateFromRepository(supabase, firstLevel)
}
```

- [ ] **Step 7: Update the call site**

At the call site (currently lines 644-647), replace:

```ts
initialWorkflowState = await resolveInitialWorkflowState(
  supabase,
  employee.designation_id
)
```

with:

```ts
initialWorkflowState = await resolveInitialWorkflowState(supabase, employee)
```

- [ ] **Step 8: Run the full suite to confirm no regression**

Run: `npm test`
Expected: PASS. Task 3 introduces no guard yet, so all 30 existing submit tests still pass — their fixtures have `approval_start_level: undefined`, which falls through to the designation flow exactly as before.

- [ ] **Step 9: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Checkpoint**

Do not commit.

---

## Task 4: The Option E guard

Fails submission when the resolved start level is 1 but no Level-1 approver is assigned — instead of writing a claim nobody can action. It tests the **resolved** level, so an employee with `approval_start_level = 2` is never subject to it.

Today this fires for **zero** employees: Chandramouli is the only one who would qualify, and his override exempts him. It is a tripwire for future misconfiguration.

**Files:**

- Modify: `src/features/claims/server/services/submit-claim.orchestrator.ts` (resolver from Task 3)
- Modify: `src/features/claims/__tests__/approval-start-level.test.ts`
- Modify: `src/features/claims/__tests__/claim-actions.test.ts:161-164`
- Modify: `src/features/claims/__tests__/claim-actions-branches.test.ts:225-228`
- Modify: `src/features/claims/__tests__/claim-race-and-atomicity.test.ts:148-152`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/claims/__tests__/approval-start-level.test.ts`:

```ts
import { shouldBlockForMissingLevel1Approver } from '@/features/claims/server/services/submit-claim.orchestrator'

describe('shouldBlockForMissingLevel1Approver', () => {
  it('blocks when starting at stage 1 with no level 1 approver', () => {
    expect(shouldBlockForMissingLevel1Approver(1, null)).toBe(true)
  })

  it('allows when starting at stage 1 with a level 1 approver', () => {
    expect(shouldBlockForMissingLevel1Approver(1, 'emp-sbh')).toBe(false)
  })

  it('allows an overridden stage 2 start with no level 1 approver', () => {
    // This is Chandramouli. If this ever returns true he is silently re-broken.
    expect(shouldBlockForMissingLevel1Approver(2, null)).toBe(false)
  })

  it('allows stage 2 with a level 1 approver present', () => {
    expect(shouldBlockForMissingLevel1Approver(2, 'emp-sbh')).toBe(false)
  })

  it('does not block when no start level could be resolved', () => {
    expect(shouldBlockForMissingLevel1Approver(undefined, null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/claims/__tests__/approval-start-level.test.ts`
Expected: FAIL — `shouldBlockForMissingLevel1Approver` is not exported.

- [ ] **Step 3: Add the guard predicate**

In `src/features/claims/server/services/submit-claim.orchestrator.ts`, directly below `resolveStartLevel`:

```ts
/**
 * A claim starting at stage 1 is only actionable by the owner's
 * `approval_employee_id_level_1`. If that is unset the claim would be written
 * with no eligible approver and would never appear in any queue — invisible,
 * with no error. Blocking at submit turns that silent failure into one the
 * submitter can report.
 */
export function shouldBlockForMissingLevel1Approver(
  startLevel: number | undefined,
  level1ApproverId: string | null | undefined
): boolean {
  return startLevel === 1 && !level1ApproverId
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/claims/__tests__/approval-start-level.test.ts`
Expected: PASS (10 tests total)

- [ ] **Step 5: Wire the guard into the resolver**

In `resolveInitialWorkflowState`, insert between the `firstLevel` assignment and the `return`:

```ts
const firstLevel = resolveStartLevel(
  employee.approval_start_level,
  approvalFlow.required_approval_levels
)

if (
  shouldBlockForMissingLevel1Approver(
    firstLevel,
    employee.approval_employee_id_level_1
  )
) {
  throw new Error(
    'Your approval chain is not configured: no Level 1 (SBH) approver is assigned. Contact your administrator.'
  )
}

return resolveInitialWorkflowStateFromRepository(supabase, firstLevel)
```

- [ ] **Step 6: Run the full suite and watch it break**

Run: `npm test`
Expected: **FAIL** — roughly 27 failures across the three files listed above, all reporting the new approval-chain error. This is the landmine from the top of this plan, and confirms the guard is live.

- [ ] **Step 7: Fix fixture 1**

`src/features/claims/__tests__/claim-actions.test.ts`, line 161:

```ts
mocks.getEmployeeByEmail.mockResolvedValue({
  id: 'emp-1',
  designation_id: 'desg-1',
  approval_employee_id_level_1: 'emp-sbh',
})
```

- [ ] **Step 8: Fix fixture 2**

`src/features/claims/__tests__/claim-actions-branches.test.ts`, line 225:

```ts
mocks.getEmployeeByEmail.mockResolvedValue({
  id: 'emp-1',
  designation_id: 'desg-1',
  approval_employee_id_level_1: 'emp-sbh',
})
```

Leave the `mockResolvedValueOnce({ id: 'emp-1', designation_id: null })` at line 520 unchanged — it asserts the missing-designation error, which throws before the guard is reached.

- [ ] **Step 9: Fix fixture 3**

`src/features/claims/__tests__/claim-race-and-atomicity.test.ts`, line 148:

```ts
mocks.getEmployeeByEmail.mockResolvedValue({
  id: 'emp-1',
  designation_id: 'desig-1',
  employee_statuses: { status_code: 'ACTIVE' },
  approval_employee_id_level_1: 'emp-sbh',
})
```

- [ ] **Step 10: Run the full suite to verify green**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 11: Add an end-to-end guard test through the real action**

This test needs the full submit mock harness, which already exists **only** inside `claim-actions.test.ts` (there is no shared harness module — **[VERIFIED]**, `src/features/claims/__tests__/helpers/` does not exist). Do not extract one for a single test.

Add this case **inside `claim-actions.test.ts`**, within the existing `describe('submitClaimAction', ...)` block so `mocks` and `VALID_FORM_INPUT` are in scope. Use `mockResolvedValueOnce` so it overrides `beforeEach` for this test only and does not leak into siblings:

```ts
it('blocks submission when no level 1 approver is assigned', async () => {
  // Arrange — employee starts at stage 1 (designation flow) but has no SBH.
  mocks.getEmployeeByEmail.mockResolvedValueOnce({
    id: 'emp-1',
    designation_id: 'desg-1',
    approval_employee_id_level_1: null,
  })
  mocks.getDesignationApprovalFlow.mockResolvedValueOnce({
    required_approval_levels: [1],
  })

  // Act
  const result = await submitClaimAction(VALID_FORM_INPUT)

  // Assert
  expect(result.ok).toBe(false)
  expect(result.error).toContain('no Level 1 (SBH) approver is assigned')
  // The whole point of the guard: nothing was persisted.
  expect(mocks.insertClaim).not.toHaveBeenCalled()
})
```

- [ ] **Step 12: Run the full suite**

Run: `npm test`
Expected: PASS. Confirm `insertClaim` was not called — the assertion that nothing was persisted is the point of the guard.

- [ ] **Step 13: Lint and typecheck**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 14: Checkpoint**

Do not commit.

---

## Task 5: Manual verification (requires the user to apply the migration)

**Blocked until the user has applied the Task 1 migration.** Ask before starting.

- [ ] **Step 1: Confirm the column and data landed**

```sql
SELECT employee_id, employee_name, approval_start_level
FROM employees
WHERE approval_start_level IS NOT NULL;
```

Expected: exactly one row — `NW0003405`, Narina Venkata Naga Chandramouli, `2`.

- [ ] **Step 2: Confirm no one else was affected**

```sql
SELECT count(*) AS employees_with_override
FROM employees
WHERE approval_start_level IS NOT NULL;
```

Expected: `1`.

- [ ] **Step 3: Confirm the CHECK constraint rejects stage 3**

```sql
-- expected to FAIL with a check-constraint violation
UPDATE employees SET approval_start_level = 3 WHERE employee_id = 'NW0003405';
```

Expected: `ERROR: new row for relation "employees" violates check constraint "employees_approval_start_level_check"`. If this **succeeds**, the constraint is missing — stop and fix Task 1 before going further, because a value of 3 routes claims past Mansoor straight to Finance.

- [ ] **Step 4: Submit a claim as Chandramouli and confirm the landing state**

```sql
SELECT cs.status_code, c.current_approval_level, c.claim_number
FROM expense_claims c
JOIN claim_statuses cs ON cs.id = c.status_id
WHERE c.employee_id = (SELECT id FROM employees WHERE employee_id = 'NW0003405')
ORDER BY c.created_at DESC
LIMIT 1;
```

Expected: `L2_PENDING` / `2`.

- [ ] **Step 5: Confirm the snapshot explains itself**

```sql
SELECT s.snapshot_data->'claim_context'->>'approval_start_level_override' AS override,
       s.snapshot_data->'approval_flow'->>'required_approval_levels'      AS designation_flow
FROM claim_config_snapshots s
JOIN expense_claims c ON c.id = s.claim_id
WHERE c.employee_id = (SELECT id FROM employees WHERE employee_id = 'NW0003405')
ORDER BY s.created_at DESC
LIMIT 1;
```

Expected: `override` = `2`, `designation_flow` = `[1,2,3]`. Both present is the point — the record shows the designation's rule _and_ the exception applied to it.

- [ ] **Step 6: Confirm Mansoor can see and action it**

Sign in as `mansoor@nxtwave.co.in`, open `/approvals`, confirm the claim is listed, and approve it. Then re-run Step 4's query.

Expected: status advances to `L3_PENDING_FINANCE_REVIEW`, `current_approval_level` becomes `NULL`.

- [ ] **Step 7: Confirm he still reports as a BOA**

```sql
SELECT d.designation_name, count(*) AS claims
FROM expense_claims c
JOIN employees e ON e.id = c.employee_id
JOIN designations d ON d.id = e.designation_id
WHERE e.employee_id = 'NW0003405'
GROUP BY 1;
```

Expected: `Business Operation Associate`. This is requirement R3 — if this returns anything else, the reporting continuity that justified this whole approach is broken.

- [ ] **Step 8: Confirm a normal BOA is unchanged**

Submit a claim as any other BOA (e.g. `NW0006012`, Bhargav Raj Gv) and re-run Step 4's query against that employee.

Expected: `L1_PENDING` / `1` — routing through SBH exactly as before.

- [ ] **Step 9: Report results to the user**

Summarise each step's actual output. If any expectation missed, report it plainly rather than reporting success.

---

## Notes for the implementer

**Do not trust `workflow-test-kit.ts`.** **[VERIFIED]** It is a hand-written mock that never calls `submit_approval_action_atomic`, and its model contradicts production: for an SBH submitter it produces status `L3_PENDING_FINANCE_REVIEW` at level 3 with Mansoor approving there, whereas production produces `L2_PENDING` at level 2 and the real RPC **raises an exception** for any approver action at level 3. `workflow-direct.test.ts` and `workflow-standard.test.ts` going green is not evidence this change is correct — Task 5 (manual verification) is. (The kit's own divergence is a pre-existing latent bug; out of scope here, worth its own ticket.)

**The column ↔ stage offset.** Stage 1 → column `approval_employee_id_level_1` (SBH). Stage 2 → column `approval_employee_id_level_**3**` (HOD). Stage 3 → Finance, no column. If anything in this plan seems to mismatch, re-read §2.2 of the spec before "fixing" it.

**Value 3 is not a shortcut to Finance.** It is excluded by the CHECK constraint on purpose.

**Exporting sync helpers from the orchestrator is safe.** **[VERIFIED]** A file carrying the `'use server'` directive may only export async functions — exporting the sync `resolveStartLevel` / `shouldBlockForMissingLevel1Approver` from such a file would be a build error. The directive lives in `src/features/claims/server/actions/submit-claim.action.ts:1`, **not** in the orchestrator, which is a plain module starting with imports. So Tasks 3 and 4 are safe as written. If you ever move these helpers into an action file, they must become async or move to a separate module.
