# Central-Team Employee Approval Routing — Design Analysis

**Date:** 2026-07-22
**Status:** ✅ APPROVED 2026-07-22 — Option E, ready for implementation planning
**Author:** Claude (investigation), for review by Tejeswar
**Subject employee:** Narina Venkata Naga Chandramouli (`NW0003405`, `chandramouli.narina@nxtwave.co.in`)

---

## 0. How to read this document

Every factual claim below was verified against the live `NxtExpenseTest`
database (`ibrvpangpuxiorspeffz`) or against source files in this repo.
Claims are tagged:

- **[VERIFIED]** — I read the actual code or ran the actual query. Evidence cited.
- **[INFERRED]** — logically follows from verified facts, but not directly observed.
- **[UNVERIFIED]** — I could not confirm this. Treat as an open risk.

There are no unattributed assertions. Where I was wrong earlier in the
investigation, Section 11 records the correction.

---

## 1. Problem statement

Chandramouli is a Business Operation Associate (BOA) who works for the
**central team**, not under any state hierarchy. Regular BOAs route
`SBH → HOD (Mansoor) → Finance`. He has no SBH, so his claims must route
`HOD (Mansoor) → Finance`, skipping the SBH stage.

**Hard constraint from the business (stated 2026-07-22):** he must remain a
**BOA in all records** — finance dashboards, admin analytics, and CSV exports.
Audit continuity is non-negotiable. A separate designation is therefore
disqualified regardless of its technical merits.

---

## 2. Current architecture — verified

### 2.1 Routing is two independent mechanisms

Approval routing is **not** one system. It is two, and they use the same word
("level") to mean different things. This is the single largest source of
confusion in this codebase.

**Mechanism 1 — where a claim STARTS (designation-scoped)**

`submit-claim.orchestrator.ts:151-163` **[VERIFIED]**:

```ts
const approvalFlow = await getDesignationApprovalFlow(supabase, designationId)
const firstLevel = approvalFlow.required_approval_levels?.[0]
return resolveInitialWorkflowStateFromRepository(supabase, firstLevel)
```

**Mechanism 2 — every hop AFTER submit (status-scoped, designation-blind)**

`submit_approval_action_atomic` selects the next status purely from
`claim_status_transitions` keyed on `from_status_id` **[VERIFIED]** — it never
reads `designation_approval_flow`, `designations`, or `required_approval_levels`.

**Consequence (load-bearing for this design):** only
`required_approval_levels[0]` has any runtime effect. The tail of the array is
decorative. **[VERIFIED]** — `getNextApprovalLevel()` in
`src/features/approvals/domain/approval-routing.ts` is the only code that reads
the tail, and grep confirms it is imported _only_ by two test files, never by
production code.

### 2.2 The column ↔ stage mapping (the confusing part)

From `submit_approval_action_atomic` **[VERIFIED]**:

```sql
IF v_level = 1 THEN
  check owner.approval_employee_id_level_1
ELSIF v_level = 2 THEN
  check owner.approval_employee_id_level_3   -- error text: "Level 2 (HOD) approver"
ELSE
  RAISE 'Claim is not at an approver-actionable level (current level = %)'
```

| Claim `current_approval_level` | Approver column consulted                                | Role in business terms           |
| ------------------------------ | -------------------------------------------------------- | -------------------------------- |
| 1                              | `approval_employee_id_level_1`                           | SBH                              |
| 1 (co-approve)                 | `approval_employee_id_level_2`, **only if actor is ZBH** | ZBH                              |
| 2                              | `approval_employee_id_level_**3**`                       | **HOD (Mansoor)**                |
| 3 / NULL                       | _none_                                                   | Finance (by role, not by column) |

`pending_approvals_filtered` uses the identical predicate **[VERIFIED]**, so the
queue and the action guard agree. Good — no split-brain.

**The trap:** `required_approval_levels` holds _stage_ numbers, not column
numbers. Mansoor sits in column 3 but acts at **stage 2**. Writing `[3]` to
route "to Mansoor" instead routes past him to Finance
(`claims.repository.ts:434` **[VERIFIED]**):

```ts
currentApprovalLevel: firstLevel >= 3 ? null : firstLevel
```

`[3]` → status `L3_PENDING_FINANCE_REVIEW`, level `NULL` → Finance. Silent, no error.

### 2.3 The complete transition graph [VERIFIED]

```
L1_PENDING  --approved (role: Level 1 Approver)--> L2_PENDING
L1_PENDING  --rejected--------------------------> REJECTED (terminal)
L2_PENDING  --approved (role: Level 2 Approver)--> L3_PENDING_FINANCE_REVIEW
L2_PENDING  --rejected--------------------------> REJECTED (terminal)
L3_PENDING_FINANCE_REVIEW --finance_approved (role: Finance Team)--> APPROVED
L3_PENDING_FINANCE_REVIEW --finance_rejected---> REJECTED (terminal)
APPROVED    --payment_released (role: Finance Team)--> PAYMENT_RELEASED (terminal)
```

Seven rows. Keyed on `from_status_id` only. **This is the guarantee that
nothing else breaks** — see Section 7.

### 2.4 Designation flows as configured today [VERIFIED]

| Designation                  | Code | Flow      | Employees | of which NULL L1 |
| ---------------------------- | ---- | --------- | --------- | ---------------- |
| Area Business Head           | ABH  | `[1,2,3]` | 20        | 0                |
| Business Operation Associate | BOA  | `[1,2,3]` | 7         | **1**            |
| Student Relationship Officer | SRO  | `[1,2,3]` | 64        | 0                |
| State Business Head          | SBH  | `[2,3]`   | 13        | 12               |
| Zonal Business Head          | ZBH  | `[2,3]`   | 2         | 2                |
| Program Manager              | PM   | `[3]`     | 2         | 2                |
| Admin                        | ADM  | _none_    | 2         | 2                |
| Finance                      | FIN  | _none_    | 6         | 6                |

**Critical observation:** Chandramouli is the **only employee in the entire
system** whose designation flow starts at stage 1 while having no stage-1
approver. Every other NULL-L1 employee belongs to a designation that already
starts at stage 2 or 3. This single fact makes several options far safer than
they would otherwise be.

### 2.5 The existing defect [VERIFIED]

Chandramouli: designation BOA (flow `[1,2,3]` → starts at stage 1),
`approval_employee_id_level_1` = **NULL**, `level_3` = Mansoor.

Stage-1 claims match approvers via `approval_employee_id_level_1`. His is NULL,
so `pending_approvals_filtered` matches **no one**. In the test DB this has
produced **52 claims** frozen in `L1_PENDING`, latest `2026-07-06`
(`CLAIM-NW0003405-060726-33197`). They are invisible in every approver queue and
cannot be actioned by anyone through the UI.

Per Tejeswar (2026-07-22): the production instances of these were already moved
manually via the admin panel; the test-DB backlog is disposable. **The stuck
claims are out of scope.** But note the _mechanism_ is not fixed — see Option D
and Section 9.3.

### 2.6 What is designation-scoped vs. global [VERIFIED]

| Concern                                                                      | Scope                                        | Impact if designation changes |
| ---------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------- |
| FOOD_BASE, FOOD_OUTSTATION, INTRACITY 2W/4W rates                            | **Global** (`designation_id IS NULL`)        | none                          |
| ACCOMMODATION rate                                                           | **Per-designation** (BOA = ₹1000)            | would need copying            |
| FOOD_WITH_PRINCIPALS                                                         | Per-designation; **BOA has no row**          | would need care               |
| Fuel: `base_fuel_rate_per_day`, `intercity_rate_per_km`, `max_km_round_trip` | **Per vehicle type**                         | none                          |
| Allowed vehicles                                                             | **Per-designation** (BOA = TWO_WHEELER only) | would need copying            |
| `validation_rules`, `system_settings`                                        | **Global**                                   | none                          |
| RLS policies                                                                 | **Zero reference designation**               | none                          |

---

## 3. Requirements

| #   | Requirement                                           | Source          |
| --- | ----------------------------------------------------- | --------------- |
| R1  | Claims route direct to Mansoor, then Finance          | Tejeswar        |
| R2  | Expense/fuel/vehicle entitlements identical to BOA    | Tejeswar        |
| R3  | **Remains BOA in dashboards, analytics, CSV exports** | Tejeswar (hard) |
| R4  | No other employee's routing changes                   | Tejeswar        |
| R5  | No other approval flow breaks                         | Tejeswar        |
| R6  | Change is auditable — records explain themselves      | Tejeswar        |

---

## 4. Options considered

### Option A — per-employee override column (base of the approved design)

Add `employees.approval_start_level smallint NULL CHECK (IN (1,2))`.

```ts
const firstLevel =
  employee.approval_start_level ?? approvalFlow.required_approval_levels?.[0]
```

|      |                                                     |
| ---- | --------------------------------------------------- |
| R1   | ✅ set to 2                                         |
| R2   | ✅ designation untouched                            |
| R3   | ✅ **stays BOA everywhere**                         |
| R4   | ✅ others read NULL → unchanged                     |
| R5   | ✅ transition graph untouched                       |
| R6   | ✅ explicit, greppable, intentional                 |
| Cost | 1 migration, ~10 lines, 1 call site, trigger update |

**Why the override is a scalar, not an array:** only `[0]` has runtime effect
(§2.1). An array would imply control the system does not actually offer.

### Option B — new `BOA-HQ` designation ❌ REJECTED

Zero code. But **violates R3** — analytics RPCs
(`get_admin_dashboard_analytics`, `get_finance_pending_dashboard_analytics`,
`finance_queue_filtered`, `finance_history_filtered`) all take
`p_designation_id uuid` and group by designation. BOA totals would silently drop
by one and cross-period comparisons would break at the changeover date.

Rejected by Tejeswar on audit grounds. I agree.

### Option C — set his `level_1` = Mansoor ❌ NOT RECOMMENDED

Zero code, zero schema, satisfies R3. But per §2.3, `L1_PENDING --approved-->
L2_PENDING`, and stage 2 consults column 3 = Mansoor again. **Mansoor approves
every claim twice**, producing two `approval_history` rows per claim. Permanent
friction and it pollutes the audit trail it is meant to protect.

Viable only as a zero-deploy stopgap.

### Option D — derive from NULL L1 (no schema change) ⚠️ INTERESTING BUT RISKY

Rule: _if the designation flow starts at stage 1 and the employee has no stage-1
approver, start at stage 2 instead._

Genuinely attractive:

- No schema change.
- Per §2.4, affects **exactly one employee today** — Chandramouli.
- Fixes the entire stuck-claim bug _class_, not just this instance.
- **The test kit already assumes this shape** (§10.2).

**Why I do not recommend it as the primary mechanism:** it converts a
data-entry mistake into a **silent control bypass**. If an admin ever clears
someone's L1 approver by accident, that person's claims quietly stop requiring
SBH approval instead of failing loudly. For an expense system with audit
requirements, implicit weakening of controls based on absent data is the wrong
default. The intent ("this person is central team") is not recorded anywhere —
it is inferred from a NULL, and NULLs do not carry reasons.

### Option E — hybrid (A + explicit guard) ✅ **APPROVED 2026-07-22**

Option A, **plus** make the §2.5 defect loud: if flow starts at stage 1 and both
`approval_start_level` and `approval_employee_id_level_1` are NULL, **reject
the submission with a clear error** instead of creating an unactionable claim.

Cost: ~5 more lines. Benefit: the bug that stranded 52 claims becomes impossible
to reintroduce. Intent stays explicit; the failure mode stays safe.

**This is the approved design.** Rationale for choosing it over bare Option A:
the stuck-claim bug has already occurred once in production. A guard that costs
five lines and converts a silent, invisible failure into an immediate,
actionable error is worth having permanently.

---

## 5. Detailed change list (Option E — approved)

### 5.1 Migration

```sql
ALTER TABLE public.employees
  ADD COLUMN approval_start_level smallint NULL;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_approval_start_level_check
  CHECK (approval_start_level IS NULL OR approval_start_level IN (1, 2));

COMMENT ON COLUMN public.employees.approval_start_level IS
  'Per-employee override for the approval stage a new claim starts at. '
  'NULL = use designation_approval_flow.required_approval_levels[0]. '
  'Set to 2 for central-team staff who have no SBH and route direct to HOD. '
  'Only values 1 and 2 are meaningful: stage 3 is Finance and has no approver column.';

UPDATE public.employees
SET approval_start_level = 2
WHERE employee_id = 'NW0003405';
```

**Note:** the `employees` table has **only a SELECT policy** (`authenticated`,
`USING true`) **[VERIFIED]** — no INSERT/UPDATE policy exists. All writes go
through `SECURITY DEFINER` RPCs. This `UPDATE` must therefore run as a migration
/ service role, not from a client. That is the intended path anyway.

### 5.2 Application code

| File                                      | Change                                                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/services/employee-service.ts:43` | add `approval_start_level` to `EMPLOYEE_COLUMNS` (explicit list, **not** `select *` — omitting it means the field silently reads `undefined`) |
| `src/lib/services/employee-service.ts:9`  | add field to `EmployeeRow` type                                                                                                               |
| `submit-claim.orchestrator.ts:151`        | take `employee`, not `designationId`                                                                                                          |
| `submit-claim.orchestrator.ts:644`        | pass `employee`                                                                                                                               |

Single call site **[VERIFIED]** — covers new claims _and_ resubmissions, since
resubmission supersedes and re-enters the same orchestrator.

### 5.2b The Option E guard (approved)

In the same resolver, after computing `firstLevel`, before creating the claim:

```
IF firstLevel == 1
   AND employee.approval_employee_id_level_1 IS NULL
THEN fail the submission with an explicit error
```

Suggested message — it must name the fix, not just the symptom:

> "Your approval chain is not configured: no Level 1 (SBH) approver is assigned.
> Contact your administrator."

Design notes:

- The guard tests the **resolved** `firstLevel`, not the raw designation flow —
  so an employee with `approval_start_level = 2` is never subject to it.
- It fails **at submit time**, before the row is written. Nothing is persisted,
  so there is no partial state and no claim to clean up.
- Today this guard would fire for **zero** employees: Chandramouli is the only
  one who qualifies (§2.4) and the override exempts him. It is a tripwire for
  future misconfiguration, not a fix for present data. **[VERIFIED]** — §2.4.
- Preferring a hard failure over a silent stuck claim is the entire point: a
  submitter who gets an error tells someone. A submitter whose claim vanishes
  into an empty queue does not.

### 5.3 Audit trigger (required for R6)

`capture_claim_config_snapshot_on_insert` stamps an `approval_flow` key read
from `designation_approval_flow` by designation **[VERIFIED]**. With an override
active, his snapshot would record BOA's `[1,2,3]` while the claim actually
started at stage 2 — **a record that contradicts itself.**

Since audit is the entire motivation, the trigger must also stamp the override.
Suggested addition to the `claim_context` object:

```sql
'approval_start_level_override',
(SELECT e.approval_start_level FROM public.employees e WHERE e.id = NEW.employee_id)
```

Then every claim carries proof of _why_ it started where it did.

### 5.4 Not required

`approver_selection_rules` (lists designations that can _be_ approvers — BOA is
absent and stays absent), `approval_routing` (**dead** — 13 BOA rows, read by
nothing; survives only in a stale comment at `employee-service.ts:232`),
`expense_reimbursement_rates` (**dead table** — appears only in the archived
schema dump), `designation_vehicle_permissions`, `expense_rates`,
`validation_rules`, RLS, and every analytics RPC.

---

## 6. What changes for him

```
Before:  submit → L1_PENDING (stage 1, NO APPROVER — STUCK)
After:   submit → L2_PENDING (stage 2) → Mansoor → L3_PENDING_FINANCE_REVIEW → Finance
```

Identical to the path SBH and ZBH staff already take in production today.

---

## 7. Guarantee analysis — why nothing else breaks

Requested explicitly. Each argument is evidence-backed, not assurance.

**7.1 Other employees' routing.** The override is a new nullable column. Every
existing row reads NULL, so `?? required_approval_levels[0]` reproduces today's
value exactly. Behaviour is bit-identical for 115 of 116 employees. **[VERIFIED]**
— data in §2.4.

**7.2 The approval chain itself.** Post-submit hops read _only_
`claim_status_transitions.from_status_id` (§2.3). Designation and the new column
are never consulted. Starting at `L2_PENDING` joins the **same seven transition
rows** SBH/ZBH claims already traverse. It is not a parallel path — it is
literally the same rows. **[VERIFIED]**

**7.3 Mansoor's authority.** `L2_PENDING --approved-->` requires role
`Level 2 Approver`. Mansoor holds `APPROVER_L2`, `is_active = true`
**[VERIFIED]**. He is already column-3 for all 7 BOAs, so no permission changes.

**7.4 Reporting / audit (R3).** `designation_id` on both `employees` and
`expense_claims` is untouched. Every dashboard, filter, analytic, and CSV groups
by designation and will continue to count him as BOA. Historical claims are
unaffected — nothing rewrites `expense_claims`. **[VERIFIED]**

**7.5 Entitlements (R2).** Designation unchanged ⇒ rates, vehicles, and fuel
resolve through identical rows. Nothing to copy, so nothing to drift. **[VERIFIED]**

**7.6 CSV export permission.** `canDownloadClaimsCsv` is a **blocklist**
(`sro`, `abh`) on designation _name_, default-allow. He stays BOA, which is not
listed. **[VERIFIED]** — `src/features/claims/utils/export-permissions.ts`

**7.7 RLS.** No policy on any table references designation **[VERIFIED]**. The
new column falls under the existing permissive SELECT policy. It is not
sensitive data.

**7.8 Rejection & resubmission.** Rejection is terminal from either stage and
resubmission re-enters the single orchestrator call site, so the override
applies identically on resubmit. **[VERIFIED]** — single call site at line 644.

---

## 8. What this design does NOT fix

Stated plainly so it is not mistaken for a complete solution.

1. ~~The stuck-claim mechanism survives.~~ **Closed by the §5.2b guard**
   (Option E, approved). Future misconfiguration now fails loudly at submit.
2. **The 52 existing test-DB claims** are untouched. Confirmed out of scope
   2026-07-22: production instances were already advanced manually via the admin
   panel; the test-DB backlog is disposable.
3. **The status label stays wrong.** His claims will read
   _"SBH Approved - Awaiting HOD Approval"_ though no SBH acted. Pre-existing —
   all 15 SBH/ZBH staff see this today. **Accepted as-is 2026-07-22.**
4. **No admin UI** — decided 2026-07-22. The override is DB-only; changing it
   requires SQL by a developer. Acceptable while the population is one person.
   If a second central-team case appears, revisit: it would need a field on the
   employee admin form plus changes to `admin_create_employee_atomic` and the
   reassign RPCs.

---

## 9. Risks

| #   | Risk                                                                                                                             | Severity          | Mitigation                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------- |
| 9.1 | `EMPLOYEE_COLUMNS` is an explicit list — forgetting the new column makes it silently `undefined`, override never fires, no error | **High** (silent) | explicit test asserting the column is selected            |
| 9.2 | Touches the submit path every claim traverses                                                                                    | Medium            | single call site; null-coalescing preserves old behaviour |
| 9.3 | Snapshot contradicts reality if §5.3 is skipped                                                                                  | Medium            | §5.3 is mandatory, not optional                           |
| 9.4 | Existing workflow tests give false confidence                                                                                    | **High**          | §10.2 — do not trust them                                 |
| 9.5 | Value `3` would route past Mansoor to Finance                                                                                    | Medium            | CHECK constraint blocks it at the DB                      |
| 9.6 | Two mechanisms now decide the start stage                                                                                        | Low–Med           | column COMMENT + this doc                                 |

---

## 10. Testing strategy

### 10.1 Required new coverage

- `approval_start_level = 2` → status `L2_PENDING`, level `2`
- `NULL` → falls back to designation flow (regression guard for the other 115)
- `EMPLOYEE_COLUMNS` actually selects the column (covers 9.1)
- CHECK constraint rejects `0`, `3`, negatives
- Resubmit after rejection re-applies the override

Option E guard (§5.2b):

- flow starts at 1 + L1 approver NULL + no override → submission **rejected**
  with the explicit error; **no claim row written**
- flow starts at 1 + L1 approver present → submits normally (must not
  over-trigger — this is the path all 84 SRO/ABH/BOA employees take)
- override = 2 + L1 approver NULL → submits normally, guard **not** triggered
  (this is Chandramouli; the regression that would silently re-break him)

### 10.2 ⚠️ Existing workflow tests cannot be trusted here

`workflow-test-kit.ts` is a **hand-written mock** that never invokes the real
RPC, and **its model contradicts production** **[VERIFIED]**:

```ts
const startsAtLevel1 = Boolean(config.level1ApproverEmail)
const startsAtLevel3 = !startsAtLevel1 && Boolean(config.level3ApproverEmail)
statusCode: startsAtLevel1 ? 'L1_PENDING' : 'L3_PENDING_FINANCE_REVIEW',
currentApprovalLevel: startsAtLevel1 ? 1 : startsAtLevel3 ? 3 : null,
```

For an SBH submitter the kit produces status `L3_PENDING_FINANCE_REVIEW` at
**level 3**, and lets Mansoor approve there. Production produces `L2_PENDING` at
**level 2**, and `submit_approval_action_atomic` **raises an exception** for any
approver action at level 3.

Both models happen to end "Mansoor, then Finance", which is why the divergence
has gone unnoticed. But `workflow-direct.test.ts` and `workflow-standard.test.ts`
passing tells us **nothing** about whether this change is correct.

Two consequences:

1. Validate against the real RPC (e2e or a DB-backed integration test), not the kit.
2. **The kit itself is arguably a latent bug** — it encodes a workflow the
   database does not implement. Worth a separate ticket; out of scope here.

Also note the kit independently confirms that "no L1 approver ⇒ start at the HOD
stage" was the _original intended_ design (Option D) — it simply was never
implemented in production.

### 10.3 Manual verification before prod

```sql
-- expect: L2_PENDING / 2
SELECT cs.status_code, c.current_approval_level
FROM expense_claims c
JOIN claim_statuses cs ON cs.id = c.status_id
WHERE c.employee_id = (SELECT id FROM employees WHERE employee_id='NW0003405')
ORDER BY c.created_at DESC LIMIT 1;

-- expect: exactly 1 row, Chandramouli
SELECT employee_id, employee_name, approval_start_level
FROM employees WHERE approval_start_level IS NOT NULL;
```

Then, as Mansoor, confirm the claim appears in `/approvals` and approves cleanly
to `L3_PENDING_FINANCE_REVIEW`.

---

## 11. Corrections to my earlier statements

Recorded for honesty, since these were said in conversation before verification:

1. I said _"only `'ZBH'` is hardcoded anywhere."_ **Wrong.** That was true of the
   `DESIGNATION_CODES` constant only. Designation **names** are hardcoded in
   `export-permissions.ts` (`'student relationship officer'`, `'area business
head'`, `'sro'`, `'abh'`). It does not affect this design (blocklist,
   default-allow, BOA absent), but the claim as stated was false.
2. I initially framed the column↔stage mapping in "stage" vocabulary while
   Tejeswar was using "column" vocabulary. Tejeswar's model of the columns
   (1=SBH, 2=ZBH, 3=HOD) was correct throughout, as was "Finance is not a level"
   — confirmed by `v_next_approval_level` being NULL'd for anything above 2.
3. I proposed Option B before the audit constraint was known. Tejeswar was right
   to reject it.

---

## 12. Decisions — resolved 2026-07-22

| #   | Question                            | Decision                                                                                                       |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Q1  | Admin UI for the override?          | **No UI.** DB-only, SQL by developer. Revisit if a second case appears (§8.4)                                  |
| Q2  | Option A or E?                      | **Option E** — A plus the loud guard (§5.2b)                                                                   |
| Q3  | Column name                         | **`approval_start_level`**                                                                                     |
| Q4  | "SBH Approved…" label on his claims | **Accepted as-is**, no rename                                                                                  |
| Q5  | The 52 stuck test-DB claims         | **Out of scope** — prod already advanced manually via admin panel                                              |
| Q6  | More central-team staff coming?     | **No — he is the only one.** Designation approach stays rejected; no `reporting_designation_id` project needed |

Q6 in particular closes the largest open risk: with a population of one, the
override is proportionate. Had the answer been "several more coming", the honest
recommendation would have flipped to a designation plus a reporting-rollup
column — a substantially larger project.

### Original open questions (for the record)

**Q1 — Admin UI: needed, or is SQL fine?**
The override would be DB-only. If ops must flip this for a future central-team
hire without a developer, it needs a field on the employee admin form plus
changes to `admin_create_employee_atomic` and the reassign RPCs — a
meaningfully larger change. My recommendation: **skip the UI for now** (this is
one person), revisit if a second case appears. Confirm?

**Q2 — Option A or Option E?**
E adds ~5 lines and makes the stuck-claim bug impossible to reintroduce. Given
you have already been bitten by it once, I lean E. Your call.

**Q3 — Column name.**
`approval_start_level` is explicit but long. Alternative:
`approval_start_level`. Any house preference?

**Q4 — The lying status label.**
His claims will show _"SBH Approved - Awaiting HOD Approval"_ with no SBH
involved. 15 SBH/ZBH staff already live with this. Leave it, or is it worth a
separate ticket to reword the label to something stage-neutral?

**Q5 — Scope confirmation.**
I have assumed the 52 stuck test-DB claims are out of scope and that production
was already corrected manually. Confirm, so I do not silently leave a real
backlog stranded.

**Q6 — Is he truly the only one?**
§2.4 shows he is the only such employee _today_. Are there other central-team
staff planned who would need the same treatment? If more than ~3 are coming,
Option B (a designation) becomes worth revisiting despite the reporting split —
at which point the honest fix is a `reporting_designation_id` for rollup, which
is a much bigger project.

---

## 13. Approved design — summary

**Option E**, approved 2026-07-22. The only option satisfying all six
requirements. Blast radius: one nullable column, one call site, one guard, one
trigger addition. §7 gives evidence-backed grounds that the other 115 employees
and all seven transition rows are untouched.

Implementation scope, in order:

1. Migration — add `employees.approval_start_level smallint NULL`, CHECK
   `IN (1,2)`, column COMMENT, and `UPDATE … = 2` for `NW0003405` (§5.1)
2. `EMPLOYEE_COLUMNS` + `EmployeeRow` — add the field (§5.2). **Do not skip:
   this is risk 9.1, the silent one**
3. Orchestrator — resolve the override, then apply the §5.2b guard
4. Snapshot trigger — stamp the override into `claim_context` (§5.3)
5. Tests per §10.1 — validated against the **real RPC**, not
   `workflow-test-kit.ts` (§10.2)
6. Manual verification per §10.3 before production

Two things not to skip:

- **§5.3, the snapshot stamp.** Without it the claim's own audit record says
  `[1,2,3]` while the claim started at stage 2 — a self-contradicting record,
  which defeats the reason this approach was chosen over a new designation.
- **§10.2.** The existing workflow tests model a workflow the database does not
  implement. Green tests there are not evidence for this change.
