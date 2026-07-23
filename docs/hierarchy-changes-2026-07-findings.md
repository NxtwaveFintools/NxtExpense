# Hierarchy Changes — Discovery & Impact Analysis

**Date:** 2026-07-23
**Branch:** `hierarchy_changes`
**Source:** `NxtExpense_Tool_Higherachy_Changes` sheet (tabs: `New_Employees`, `Higherachy_Changes`)
**Status:** Discovery complete · all decisions received (§9, §9.3) · **nothing implemented, no migration written, nothing applied.**
**Start here if resuming:** §11 is the consolidated build spec — the exact records to create and pointers to move. §0 and §8 first, though: all head-counts below are dev-DB numbers and must be re-measured on production.

---

## 0. Read this first — which database I inspected

Everything below was measured against the **dev/test database** `ibrvpangpuxiorspeffz` (`NxtExpenseTest`), which is the one currently active in `.env.local`.

**Production (`rourehizhyshgvbzcscc`) is not reachable from my Supabase connection** — it isn't in the project list I can query. So:

- **Structure/mechanics findings are trustworthy** — schema, RPCs, RLS, and app code are the same codebase.
- **People/row-count findings are indicative, not final.** The exact list of who reports to whom, and the exact head-counts, must be re-run against production before we touch anything.

I've written every "who exists" query so it can be re-run verbatim on prod. See §8.

---

## 1. What the two sheets are asking for

### Tab `Higherachy_Changes` — five SBH swaps

| State       | Old SBH            | New SBH               |
| ----------- | ------------------ | --------------------- |
| Tamil Nadu  | hari.haran@        | sreejish.mohanakumar@ |
| Maharashtra | arkaprabha.ghosh@  | ashish.prakashpatil@  |
| Rajasthan   | adarshanand.digal@ | arkaprabha.ghosh@     |
| Delhi NCR   | akshaykumar.pal@   | bipin.sati@           |
| Kerala      | hari.haran@        | jijo.varghese@        |

Note the **chain**: Arka moves _out_ of Maharashtra and _into_ Rajasthan. He is both an "old" and a "new" SBH. Order of operations matters.

Note also **Hari Haran covers two states** (TN + KL) and is being replaced by **two different people**. This is a split, not a swap — see §4.1.

### Tab `New_Employees` — ten new joiners

| #   | Name                 | State         | Designation | Emp ID (sheet) | Email                |
| --- | -------------------- | ------------- | ----------- | -------------- | -------------------- |
| 1   | Siranjeeva C         | Tamil Nadu    | ABH         | NW0007161      | siranjeeva.c@        |
| 2   | Rethina Kumar C      | Tamil Nadu    | ABH         | NW0007243      | c.rethinakumar@      |
| 3   | Nilesh Tiwari        | Uttar Pradesh | ABH         | NW0007236      | nilesh.tiwari@       |
| 4   | Prathamesh Pawar     | Maharashtra   | ABH         | NW0007233      | prathamesh.pawar@    |
| 5   | Ashish Prakash Patil | Maharashtra   | **SBH**     | NW0007185      | ashish.prakashpatil@ |
| 6   | Bipin Chandra Sati   | Delhi NCR     | **SBH**     | NW0006996      | bipin.sati@          |
| 7   | Jijo Varghese        | Kerala        | **SBH**     | NW0000747      | jijo.varghese@       |
| 8   | Nithin K             | Karnataka     | **SBH**     | NW0007097      | nithin.k@            |
| 9   | Sparsh Gupta         | Rajasthan     | ABH         | NW0007253      | sparsh.gupta@        |
| 10  | Muhammed Hijas       | Kerala        | SRO         | NW0007045      | muhammed.hijas@      |

---

## 2. Identification — who already exists in the DB

### 2.1 Already exists (6 of the 15 named people)

| Person                    | Emp ID in DB     | Designation | Status          | States       | Roles                 | Note                                          |
| ------------------------- | ---------------- | ----------- | --------------- | ------------ | --------------------- | --------------------------------------------- |
| **Hari Haran S**          | NW0000737        | SBH         | ACTIVE          | KL, **TN\*** | APPROVER_L1, EMPLOYEE | outgoing TN + KL SBH                          |
| **Arka Prabha Ghosh**     | NW0001212        | SBH         | ACTIVE          | **(none)**   | APPROVER_L1, EMPLOYEE | ⚠️ has **no state mapping at all**            |
| **Adarsh Anand Digal**    | NW0002276        | SBH         | ACTIVE          | **RJ\***     | APPROVER_L1, EMPLOYEE | outgoing RJ SBH                               |
| **Akshay Kumar Pal**      | NW0002084        | SBH         | ACTIVE          | **DL\***, UP | APPROVER_L1, EMPLOYEE | outgoing DL SBH — but also covers UP          |
| **Sreejish Mohana Kumar** | NW0000744        | SBH         | ⚠️ **INACTIVE** | **KL\***, TN | ⚠️ **EMPLOYEE only**  | incoming TN SBH — needs reactivation          |
| **Muhammed Hijas**        | ⚠️ **NW1006377** | SRO         | ACTIVE          | KL\*         | EMPLOYEE              | ⚠️ **Emp ID mismatch** — sheet says NW0007045 |

`*` = primary state.

### 2.2 Does NOT exist — must be created (9 people)

| Person               | Designation | State         | Notes                                                                                                          |
| -------------------- | ----------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| Ashish Prakash Patil | SBH         | Maharashtra   | new SBH                                                                                                        |
| Bipin Chandra Sati   | SBH         | Delhi NCR     | new SBH                                                                                                        |
| Jijo Varghese        | SBH         | Kerala        | new SBH — Emp ID NW0000747 is an _old-series_ number. Prior-history check ruled **out of scope** (decision #5) |
| Nithin K             | SBH         | Karnataka     | new SBH — **not on the swap sheet**; an _addition_ to Karnataka alongside Vignesh, not a replacement. See §5   |
| Siranjeeva C         | ABH         | Tamil Nadu    |                                                                                                                |
| Rethina Kumar C      | ABH         | Tamil Nadu    |                                                                                                                |
| Nilesh Tiwari        | ABH         | Uttar Pradesh |                                                                                                                |
| Prathamesh Pawar     | ABH         | Maharashtra   |                                                                                                                |
| Sparsh Gupta         | ABH         | Rajasthan     |                                                                                                                |

None of the sheet's employee IDs (NW0007161, NW0007243, NW0007236, NW0007233, NW0007185, NW0006996, NW0000747, NW0007097, NW0007253) currently exist in the DB — **no ID collisions**, safe to insert.

### 2.3 Two data issues found that are unrelated to this change but sit in the blast radius

1. **Sreejish is INACTIVE and has lost his `APPROVER_L1` role.** He was handed over to Hari in a past migration (`20260425103000_handover_sreejish_to_hari_sbh.sql`). Bringing him back as TN SBH means reversing that: reactivate + re-grant `APPROVER_L1`. **An INACTIVE employee cannot log in** (`getEmployeeByEmail` returns null → `/no-access`), so this is a hard blocker, not cosmetic.

2. **The whole Maharashtra team has no state mapping.** Arka's 7 reports (Akre, Ingole, Adhapure, Jain, Bhatkar, Bhure, Raut) have **zero rows in `employee_states`**, and Arka himself has none. Maharashtra has 4 `employee_states` rows but **not one of them is a primary state for an active MH employee** — they're all cross-state links from Mansoor / Shashank / Hari Santhosh / Chandramouli. So "Maharashtra" as an org unit only exists implicitly via "who points at Arka as L1".

---

## 3. How the hierarchy actually works — the single most important finding

**The approval hierarchy is driven entirely by three denormalized columns on `employees`:**

```
employees.approval_employee_id_level_1   -- the SBH  (claim level 1)
employees.approval_employee_id_level_2   -- ZBH, read-only visibility only
employees.approval_employee_id_level_3   -- the HOD/PM (claim level 2)  ← note the off-by-one
```

⚠️ **Level naming is off by one.** A claim at `current_approval_level = 2` is checked against `approval_employee_id_level_**3**`. Confirmed in `submit_approval_action_atomic`, in `pending_approvals_filtered`, and in the `approver reads pending claims` RLS policy. Anyone writing SQL here will get it wrong on the first try.

### What this means for us

| Consequence                                                  | Detail                                                                                                                                                                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`approval_routing` is not used at runtime.**               | The 45-row per-state routing table is read by nobody in the approval path. It's config/documentation. Its per-state L1 rows do _not_ need to exist for approvals to work.                                                                          |
| **`employee_states` does not route approvals.**              | State affects: the admin approver dropdown (`get_admin_approver_options_by_state`), `admin_create_employee_atomic` validation, state-scoped expense rates, outstation city lists, and analytics filters. **It does not affect who approves what.** |
| **Swapping a pointer instantly re-routes in-flight claims.** | Because approver is resolved live from the owner's row, a claim sitting in L1_PENDING moves from the old SBH's queue to the new SBH's queue the moment you update the column. **No orphaned claims** — this is good news.                          |
| **History is preserved automatically.**                      | `approval_history` stores the actual actor. `get_my_approver_acted_claim_ids` is recursive through `employee_replacements`, so a new SBH inherits visibility of their predecessor's acted claims.                                                  |
| **Sidebar access is derived, not assigned.**                 | `hasApproverAssignments()` = "does anyone point at me at L1/L2/L3". A new SBH sees no `/approvals` tab until at least one report points at them. An outgoing SBH loses the tab the moment their last report is moved.                              |

---

## 3.1 The approval workflow end to end

### "L1 / L2 / L3" means three different things

This is the single biggest source of confusion in this codebase. Three numbering systems collide, and they do **not** line up:

| System                         | Where it lives                                                                                                                                                   | Values                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Stage** (the business truth) | `expense_claims.current_approval_level`, `claim_statuses.approval_level`, `designation_approval_flow.required_approval_levels`, `employees.approval_start_level` | 1 = SBH, 2 = HOD, 3 = Finance                |
| **Approver column**            | `employees.approval_employee_id_level_N`                                                                                                                         | `_1` = SBH, `_2` = ZBH, `_3` = HOD           |
| **Role code**                  | `roles.role_code`                                                                                                                                                | `APPROVER_L1`, `APPROVER_L2`, `FINANCE_TEAM` |

The actual mapping:

```
Stage 1  →  column _level_1  →  role APPROVER_L1   →  status L1_PENDING
Stage 2  →  column _level_3  →  role APPROVER_L2   →  status L2_PENDING    ← off by one
Stage 3  →  (no column)      →  role FINANCE_TEAM  →  status L3_PENDING_FINANCE_REVIEW
```

### What each one is for

**`approval_employee_id_level_1` — the SBH.** Acts at stage 1. Claim sits in `L1_PENDING`. Approving moves it to `L2_PENDING`. Requires role `APPROVER_L1`.

**`approval_employee_id_level_2` — the ZBH. NOT an approval step.** Nobody ever acts on this column. It exists solely for read-only visibility: `pending_approvals_filtered` lets a ZBH _see_ claims sitting at stage 1 beneath them (`v_is_zbh AND owner.approval_employee_id_level_2 = v_employee_id`), but `submit_approval_action_atomic` at stage 1 accepts **only** `approval_employee_id_level_1`. Look, don't touch. This is why Hari, Nagaraju, Ravinder and Sambit all have it NULL with no ill effect.

**`approval_employee_id_level_3` — the HOD (Mansoor). Acts at STAGE 2.** This is the off-by-one:

```sql
IF v_level = 1 THEN     ... owner.approval_employee_id_level_1
ELSIF v_level = 2 THEN  ... owner.approval_employee_id_level_3   -- here
```

Requires role `APPROVER_L2`. So one single step is called "L2" by the role, "level_3" by the column, and "stage 2" by the claim.

**Finance — stage 3, and it has no approver column at all.** Purely role-based: any `FINANCE_TEAM` member can pick it up. `L3_PENDING_FINANCE_REVIEW` → `finance_approved` → `APPROVED` → `payment_released` → `PAYMENT_RELEASED` (terminal).

This is exactly why `20260722100000_central_employee_approval_start_level.sql` forbids a value of `3` for `approval_start_level` — stage 3 has no approver column, so starting there would route the claim _past_ the HOD straight to Finance. `claims.repository.ts:436` confirms: `currentApprovalLevel: firstLevel >= 3 ? null : firstLevel`.

### Where a claim starts

`resolveStartLevel(override, flow) = override ?? flow[0]`

| Designation     | `required_approval_levels` | Starts at                                             |
| --------------- | -------------------------- | ----------------------------------------------------- |
| SRO / BOA / ABH | `[1,2,3]`                  | Stage 1 — SBH                                         |
| SBH / ZBH       | `[2,3]`                    | Stage 2 — HOD (skips SBH; you can't approve yourself) |
| PM              | `[3]`                      | Stage 3 — Finance directly                            |

⚠️ **Only `flow[0]` has any runtime effect.** The tail is decorative — every hop after the first is driven by `claim_status_transitions`, keyed on `from_status_id` alone, which never consults designation. (`getNextApprovalLevel` is dead code, imported by tests only.)

`approval_start_level` overrides just that first element **without changing designation**, so reporting, analytics and CSV exports still count the person under their real designation. Chandramouli (NW0003405) is a BOA on the central team with no SBH; the `[1,2,3]` flow stranded his claims at stage 1 with no eligible approver, so he's set to `2` to route direct to HOD. He is the only such row in the database.

### Why this section decides the plan

1. **An SBH swap only rewrites `_level_1`.** Claims at `L2_PENDING` read `_level_3` (Mansoor — unchanged) and are never affected. This is why the drain gate in §9.2 is `L1_PENDING` only, not "all in-flight claims".
2. **Adarsh SBH → ABH moves him from `[2,3]` to `[1,2,3]`.** He stops going direct to HOD and now needs a stage-1 approver. Leaving `_level_1` NULL makes `shouldBlockForMissingLevel1Approver` block his submissions outright (§9.1).
3. **Every new SBH needs the `APPROVER_L1` role**, or `submit_approval_action_atomic` refuses their approvals — the `L1_PENDING → L2_PENDING` transition carries `requires_role_id = APPROVER_L1`. Sreejish currently holds `EMPLOYEE` only, so his role must be re-granted, not just his status flipped.

---

## 4. Impact analysis per swap

Head-counts below are **dev-DB numbers** — re-measure on prod.

### 4.1 Tamil Nadu + Kerala — Hari Haran → Sreejish (TN) **and** Jijo (KL)

This is the hard one. Hari's 16 reports must be **split by state**:

| To                | Reports | Who                                                                             |
| ----------------- | ------- | ------------------------------------------------------------------------------- |
| **Sreejish (TN)** | 12      | 10 SRO + 2 ABH (Narendran B, Sivaranjith Sivakumar)                             |
| **Jijo (KL)**     | 4       | 3 SRO (Akshay E, Jithin Radhakrishnan, Muhammed Hijas) + 1 ABH (Ananth Lal S S) |

⚠️ **The built-in Replace flow cannot do this.** `admin_finalize_employee_replacement_atomic` does a blanket `UPDATE ... WHERE approval_employee_id_level_1 = old` — it moves **all 16** to one person. A split needs a state-filtered update, i.e. a migration, not the admin UI.

Also: Hari himself is an SBH whose own claims route somewhere, and Sreejish's `employee_states` currently has **KL as primary and TN secondary** — backwards for his new role.

### 4.2 Delhi NCR — Akshay Kumar Pal → Bipin Sati

Same split problem. **Resolved by decision #1: Akshay keeps UP.**

| State  | Reports                    | Goes to                 |
| ------ | -------------------------- | ----------------------- |
| **DL** | 7 (5 SRO + 1 BOA + 1 ABH)  | → Bipin Sati            |
| **UP** | 11 (7 SRO + 1 BOA + 3 ABH) | → **stays with Akshay** |

⚠️ A blanket replace would wrongly hand the 11 UP people to Bipin. The update **must** be filtered to `state_code = 'DL'` — which is why this needs a migration, not the admin Replace flow. Akshay is not inactivated. The new UP ABH (Nilesh Tiwari) slots under Akshay.

### 4.3 Rajasthan — Adarsh Digal → Arka Ghosh

- 9 reports (7 SRO + 1 ABH Vaibhav Sharma + **Adarsh himself**).
- ⚠️ **Adarsh is his own L1 approver** (`approval_employee_id_level_1` points at himself). Pre-existing data bug. When he's replaced, that self-loop becomes "Adarsh's claims are approved by Arka", which is probably right — but it should be a deliberate decision, not an accident.
- Clean single-state swap otherwise.

### 4.4 Maharashtra — Arka Ghosh → Ashish Prakash Patil

- 7 reports, **all with no state mapping**. A state-filtered update **will not find them** — they must be moved by pointer (`WHERE approval_employee_id_level_1 = arka`), which is fine here because Arka's reports are exactly the MH team.
- **Ordering constraint:** Arka must be moved off Maharashtra _before or atomically with_ being wired into Rajasthan, or he briefly owns both states' queues.
- Good opportunity to backfill the missing `employee_states` rows for the MH team while we're in there.

### 4.5 Kerala — see §4.1

---

## 5. Karnataka — the extra SBH and the state split

### Current state

| Role                      | Who                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Current Karnataka SBH** | **Vignesh Shenoy** (NW0003236, vignesh.shenoy@, KA primary)                                                      |
| Karnataka ZBH (L2)        | Tibirisetty V L S Hari Santhosh (KA + MH)                                                                        |
| Vignesh's reports         | **16** — 11 SRO, 1 BOA (Bhargav Raj Gv), 4 ABH (Gajendra K, Matam Dinesh Babu, Omkar Gundacharya, Raghu Acharya) |

**Nithin K (NW0007097) is being added as a second Karnataka SBH.** The swap sheet does **not** list Karnataka — so this is an _addition_, not a replacement. Vignesh stays; Karnataka gets divided between Vignesh and Nithin.

### On the `Karnataka_1` / `Karnataka_2` idea

I want to flag this clearly before you decide, because the mechanics don't work the way the naming suggests.

**Creating new state rows does not route anyone.** Per §3, `employee_states` has no effect on approvals. Splitting the state would _not_ send new employees to Nithin — you'd still have to set each person's `approval_employee_id_level_1` by hand. The split buys you a label, and costs you the following:

| Cost                                            | Detail                                                                                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **44 active cities stay on old Karnataka**      | `cities.state_id` points at the current KA row. Employees moved to `Karnataka_1`/`Karnataka_2` would see **zero outstation cities**. All 53 cities would need re-parenting or duplicating. |
| **`approval_routing` needs new per-state rows** | 3 rows per new state (SRO/BOA/ABH → SBH). Cosmetic today, but the admin _Approver Rules_ page reads it.                                                                                    |
| **State-scoped expense rates fork**             | `expense_rates.state_id` exists and is in use (AP/TG food overrides). Any future Karnataka rate must now be written twice.                                                                 |
| **Analytics / filters fragment**                | Admin analytics, finance dashboard, and profile all filter by state. "Karnataka" stops being one number.                                                                                   |
| **Auto-generated state codes are ugly**         | `admin_create_state_atomic` derives the code from the name: `Karnataka_1` → `K1`, `Karnataka_2` → `K2`. Not `KA1`/`KA2`.                                                                   |
| **Historical claims keep the old state**        | Snapshots freeze state at submit time; past Karnataka claims stay on the old row forever.                                                                                                  |

**My recommendation:** don't split the state. Karnataka stays one state; both Vignesh and Nithin get `KA` in `employee_states`, and you divide the _people_ between them by setting `approval_employee_id_level_1`. This is exactly what already happens for Odisha/West Bengal (Sambit covers both) and DL/UP (Akshay covers both) — the system is already designed for many-SBHs-per-state and many-states-per-SBH.

If you want the region visible in the UI, the cheaper options are a region label on the employee, or naming based on who the SBH is. Happy to price that out if you'd rather go that way — but I'd want it to be a deliberate choice, not a side effect of the mapping problem.

### ✅ Resolved by decision #2

**Nithin has joined and is already an SBH for Karnataka** (NW0007097) — but _which_ employees report to him is not yet decided. So Karnataka reduces to one task: create his full SBH record (`KA` primary, `APPROVER_L1` role, `level_2` = Hari Santhosh, `level_3` = Mansoor, `level_1` NULL — the standard SBH flow `[2,3]`, so his own claims go direct to HOD).

**No employees move to him in this change.** Vignesh keeps all 16 reports and is unaffected. Because nothing points at Nithin yet, his record is inert: no `/approvals` tab, no queue, no effect on any existing claim. He can log in and submit his own claims immediately.

**No state split is required.** The `Karnataka_1`/`Karnataka_2` question is deferred until the Karnataka division is actually finalised — at which point the recommendation above still stands: divide the people, not the state.

---

## 6. Landmines found in the existing code

These will bite during execution if not handled.

| #   | Landmine                                                                               | Impact                                                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | **`approval_employee_id_level_2` vs `level_3`** — claim level 2 reads column `level_3` | Any hand-written SQL will silently wire the HOD to the wrong column                                                                                                                                                                                                                                                                       |
| 2   | **`admin_reassign_employee_approvers_atomic` nulls what you don't pass**               | It sets all three levels unconditionally. Passing only L1 **wipes the HOD (Mansoor) to NULL** and strands the claim at level 2. The admin UI pre-fills all three, so the UI is safe — **a script is not.**                                                                                                                                |
| 3   | **`reassign_orphaned_approvals` is dead code that will throw**                         | It writes to `employee_designation_history`, a table that no longer exists in this DB. Any call errors out. Do not use it.                                                                                                                                                                                                                |
| 4   | **Replace flow inactivates immediately**                                               | `admin_prepare_employee_replacement_atomic` sets the employee INACTIVE _before_ the new person is created. Between the two steps the outgoing person **cannot log in** — including to see their own pending claims. Don't prepare a replacement until the successor's row is ready to go in.                                              |
| 5   | **Replace flow is all-or-nothing per person**                                          | Blanket `UPDATE WHERE level_N = old`. Unusable for the TN/KL and DL/UP splits (§4.1, §4.2).                                                                                                                                                                                                                                               |
| 6   | **`admin_create_employee_atomic` takes exactly one state and one role**                | Multi-state SBHs (e.g. someone covering DL+UP) need a second `employee_states` insert afterwards. The UI can't do it.                                                                                                                                                                                                                     |
| 7   | **Creating an employee ≠ creating a login**                                            | The auth user is only provisioned if `loginPassword` is supplied. Without it the person exists in `employees` but cannot sign in.                                                                                                                                                                                                         |
| 8   | **Tests hard-code these exact people**                                                 | `workflow-test-kit.ts`, `workflow-standard.test.ts` ("BOA(Karnataka) with Vignesh as SBH approver"), `workflow-direct.test.ts`, `approval-analytics.test.ts`, `e2e/fixtures/test-accounts.ts`, and `scripts/dev/provision-test-accounts.mjs` all name Hari / Sreejish / Vignesh. **These will break** and must be updated in the same PR. |
| 9   | **`rpc-contracts.test.ts` asserts on the past handover migrations**                    | Lines 99–135 and 175+ pin the Sreejish→Hari and Anshuman→Sambit migrations. Reversing Sreejish→Hari must not break those assertions.                                                                                                                                                                                                      |
| 10  | **`provision-test-accounts.mjs` is already stale**                                     | Labels Hari as "ABH                                                                                                                                                                                                                                                                                                                       | Tamil Nadu"; he's SBH. Worth fixing while we're here. |

---

## 7. Recommended approach

### Answer to "employees first or hierarchy first?"

**Employees first — strictly.** Four of the five new SBHs don't exist yet. You cannot point anyone at an approver row that isn't there, and `admin_create_employee_atomic` validates the L1 approver against `approver_selection_rules` at insert time. Creating people first also means every step after it is a pointer update, which is instant and reversible.

### Proposed phases

**Phase 0 — Confirm against production (blocking, no writes)**
Re-run the §8 queries on `rourehizhyshgvbzcscc`. Produce the real per-SBH report lists. Snapshot `employees(id, approval_employee_id_level_1..3)` for every affected person so we have a byte-exact rollback.

**Phase 1 — ✅ Done.** All decisions received (§9 and §9.3). §9.4 lists five items being actioned on stated assumptions rather than explicit answers — glance at those before building.

**Phase 2 — Create the 9 new people + fix the 2 existing records**

- Insert the 9 new employees (5 ABH + 4 SBH) with correct designation, state, role, and approvers. **All new SBHs need the `APPROVER_L1` role** — without it `submit_approval_action_atomic` rejects their approvals, because the `L1_PENDING → L2_PENDING` transition requires `requires_role_id = APPROVER_L1`.
- Reactivate Sreejish + re-grant `APPROVER_L1` + flip his primary state KL → TN.
- Update Muhammed Hijas's employee ID to `NW0007045`.
- Backfill `employee_states` for Arka (→ RJ) and the 7 MH staff (→ MH).
- **Nothing has changed for anyone yet** — new rows have no reports, so no queue moves. This phase is safe to ship on its own.

**Phase 3 — Drain, then move pointers, one state at a time**

For each state: _gate on `L1_PENDING = 0`_ (§9.2) → migrate → verify.

| Order | State           | Move                                                                                | Gate on                    |
| ----- | --------------- | ----------------------------------------------------------------------------------- | -------------------------- |
| 1     | **Maharashtra** | Arka's 7 → Ashish                                                                   | Arka's L1 queue empty      |
| 2     | **Rajasthan**   | Adarsh's 9 → Arka                                                                   | Adarsh's L1 queue empty    |
| 3     | **Kerala**      | Hari's 4 KL reports → Jijo                                                          | Hari's L1 queue empty      |
| 4     | **Tamil Nadu**  | Hari's 12 TN reports → Sreejish                                                     | (same gate as 3)           |
| 5     | **Delhi NCR**   | Akshay's **DL-only** 7 → Bipin                                                      | Akshay's DL L1 queue empty |
| 6     | **Karnataka**   | _no pointer moves_ — Nithin's record created in Phase 2; his team is a later change | n/a                        |

Maharashtra **must** precede Rajasthan: Arka has to be freed from MH before he takes RJ, or he briefly owns both queues.

Each step is one migration with a matching rollback file — the repo keeps `supabase/rollback/` in lockstep and I'd follow that convention.

**Phase 4 — Role and status changes (last, after queues are empty)**

- **Hari Haran → INACTIVE.** Only after his approval queue _and_ his own claims are settled (landmine #4, §9.4 G).
- **Adarsh Digal → ABH.** Set `approval_employee_id_level_1` = Arka in the _same_ migration — otherwise he cannot submit claims at all (§9.1). The ₹2000→₹1000 accommodation drop is confirmed intended (§9.3 A); no override.
- **Akshay** — state remap only: `UP` primary, drop `DL` (§9.4 E). Stays SBH, stays active.
- **Arka** — `RJ` primary added (§9.4 F) and ZBH switched Hari Santhosh → Satya Priya Dash (§9.3 C).

**Phase 5 — Fix the tests and fixtures** (landmines #8–#10), then full e2e via `npm run test:e2e:parallel`.

### Why "nothing should be broken" is achievable here

The architecture is on our side: approvals resolve live from a pointer, so each swap is a single atomic `UPDATE` with an exact rollback, and history visibility is inherited through `employee_replacements`. Phase 2 is inert by construction. Phase 3 is gated on an empty queue, which makes decision #7 hold by definition rather than by mechanism.

The real risks are all **data-shape** risks, and all are avoidable by using migrations rather than the admin UI: splits the built-in tooling can't express (§4.1, §4.2), the NULL-wiping reassign RPC (#2), the login lockout during replacement (#4), and Adarsh's designation change silently blocking his own submissions (§9.1).

---

## 8. Queries to re-run against production

```sql
-- A. Do these people exist, and in what state?
select e.employee_id, e.employee_name, e.employee_email, d.designation_code, st.status_code,
  (select string_agg(s.state_code || case when es.is_primary then '*' else '' end, ',')
     from employee_states es join states s on s.id = es.state_id
    where es.employee_id = e.id) as states,
  (select string_agg(r.role_code, ',')
     from employee_roles er join roles r on r.id = er.role_id
    where er.employee_id = e.id and er.is_active) as roles
from employees e
join designations d on d.id = e.designation_id
left join employee_statuses st on st.id = e.employee_status_id
where lower(e.employee_email) in (
  'hari.haran@nxtwave.co.in','arkaprabha.ghosh@nxtwave.co.in','adarshanand.digal@nxtwave.co.in',
  'akshaykumar.pal@nxtwave.co.in','vignesh.shenoy@nxtwave.co.in','sreejish.mohanakumar@nxtwave.co.in',
  'ashish.prakashpatil@nxtwave.co.in','bipin.sati@nxtwave.co.in','jijo.varghese@nxtwave.co.in',
  'nithin.k@nxtwave.co.in','siranjeeva.c@nxtwave.co.in','c.rethinakumar@nxtwave.co.in',
  'nilesh.tiwari@nxtwave.co.in','prathamesh.pawar@nxtwave.co.in','sparsh.gupta@nxtwave.co.in',
  'muhammed.hijas@nxtwave.co.in'
);

-- B. Exact report list per outgoing SBH, broken down by state (drives the splits)
select l1.employee_name as sbh, coalesce(s.state_code,'(NO STATE)') as report_state,
       d.designation_code, count(*) as n,
       string_agg(e.employee_name, ', ' order by e.employee_name) as names
from employees e
join employees l1 on l1.id = e.approval_employee_id_level_1
left join employee_states es on es.employee_id = e.id and es.is_primary
left join states s on s.id = es.state_id
join designations d on d.id = e.designation_id
where lower(l1.employee_email) in (
  'hari.haran@nxtwave.co.in','akshaykumar.pal@nxtwave.co.in','vignesh.shenoy@nxtwave.co.in',
  'adarshanand.digal@nxtwave.co.in','arkaprabha.ghosh@nxtwave.co.in')
group by l1.employee_name, s.state_code, d.designation_code
order by 1, 2;

-- C. In-flight claims that will change hands (run immediately before cutover)
select l1.employee_name as current_approver, cs.status_code, count(*) as claims
from expense_claims c
join employees owner on owner.id = c.employee_id
join employees l1 on l1.id = owner.approval_employee_id_level_1
join claim_statuses cs on cs.id = c.status_id
where cs.status_code in ('L1_PENDING','L2_PENDING')
group by 1,2 order by 1,2;

-- D. Rollback snapshot — capture BEFORE any write
select id, employee_id, employee_name, employee_email,
       approval_employee_id_level_1, approval_employee_id_level_2,
       approval_employee_id_level_3, approval_start_level, employee_status_id
from employees;

-- E. ID collision check for the new joiners
select employee_id, employee_name, employee_email from employees
where employee_id in ('NW0007161','NW0007243','NW0007236','NW0007233','NW0007185',
                      'NW0006996','NW0000747','NW0007097','NW0007253','NW0007045');
```

---

## 9. Decisions received (2026-07-23)

| #   | Question                                  | Decision                                                                                                               | Consequence                                                                                                                                                         |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Does Akshay keep UP?                      | **Yes.** Akshay stays SBH for UP. Bipin takes Delhi NCR only.                                                          | DL reports (7) → Bipin. UP reports (11) untouched. Akshay is **not** inactivated.                                                                                   |
| 2   | Which Karnataka people move to Nithin?    | **None for now.** Nithin hasn't joined. Create him as SBH with his own claims going direct to HOD; reassignment later. | Karnataka work reduces to "create one SBH row". **No state split needed** — see §5.                                                                                 |
| 3   | Outgoing SBHs — leave or change role?     | **Only Hari Haran goes inactive.** Adarsh becomes **ABH**. Akshay stays SBH (UP). Arka moves MH → RJ.                  | See §9.1 — Adarsh's designation change has knock-on effects.                                                                                                        |
| 4   | Muhammed Hijas's employee ID              | **Update to sheet value `NW0007045`** — he converted from Intern to Employee.                                          | Future claim numbers become `CLAIM-NW0007045-…`; existing ones keep `CLAIM-NW1006377-…` permanently (claim_number is stored text). Two prefixes in his history.     |
| 5   | Is Jijo a returning employee?             | **Out of scope.** Create fresh.                                                                                        | No investigation.                                                                                                                                                   |
| 6   | Login method                              | **Microsoft SSO.**                                                                                                     | ✅ **No work required** — the app already uses `provider: 'azure'` (`signInWithOAuthMutation`). New joiners need only an `employees` row; no password provisioning. |
| 7   | Mid-flight claim reassignment acceptable? | **No.** Existing claims stay with their original approver; only new claims follow the new config.                      | **Drain-then-cutover per person** (§9.2). Each outgoing approver clears their `L1_PENDING` queue _before_ their pointer is swapped.                                 |

### 9.1 Adarsh Digal SBH → ABH — three knock-on effects

This is a designation change, not just a reassignment, and it touches more than the org chart.

1. **His own approval chain changes.** `designation_approval_flow` gives SBH `[2,3]` (direct to HOD) but ABH `[1,2,3]`. As an ABH his claims now start at **level 1** and need an L1 approver. He is currently **his own L1** (pre-existing self-loop) — that must become **Arka** (the new RJ SBH).
   ⚠️ If `approval_employee_id_level_1` is left NULL, `shouldBlockForMissingLevel1Approver` **blocks him from submitting claims at all**, with an error. This is a hard requirement, not a nicety.

2. **His accommodation rate halves.** `expense_rates` is designation-scoped:
   | expense_type | SBH | ABH |
   |---|---|---|
   | `ACCOMMODATION` | **₹2000** | **₹1000** |
   | `FOOD_WITH_PRINCIPALS` | ₹500 | ₹500 |

   New claims after the change get the ABH rate. Past claims keep their frozen snapshot. ✅ **Confirmed intended** (§9.3 A) — no override needed.

3. **There is no admin UI to change a designation.** `employee-management.tsx` only does search / reassign-approvers / replace. This requires a migration.

Once his 9 reports move to Arka he automatically loses the `/approvals` tab (`hasApproverAssignments` is derived), and once his designation is ABH he stops appearing in the L1 approver dropdown (`approver_selection_rules` maps level 1 → SBH). His `APPROVER_L1` role row becomes inert — recommend removing it for cleanliness.

### 9.2 Drain-then-cutover — the agreed model

Per outgoing approver, in this order:

1. Tell them to clear their queue — approve/reject everything at `L1_PENDING`.
2. **Verify empty** with query C in §8 before proceeding. This is the gate.
3. Apply the migration that moves the pointers.
4. Only then apply any status/designation change (inactivate Hari; Adarsh → ABH).

**Why this is safe:** an SBH swap only rewrites `approval_employee_id_level_1`. Claims sitting at `L2_PENDING` read `approval_employee_id_level_3` (Mansoor — unchanged), so **they are never affected** and do not need to drain. The gate is only `L1_PENDING`. `DRAFT` claims are also fine — they resolve their approver at submit time, so they'll correctly follow the new config.

**Why the gate is mandatory, not optional:** if we swapped while claims were pending, those claims would move to the new approver (violating decision #7). And for Hari specifically, if he were inactivated while still holding pending claims, he could not log in to action them (`getEmployeeByEmail` returns null for INACTIVE → `/no-access`) and they would be **permanently stuck**. Draining removes both problems.

---

## 9.3 Second round of decisions (2026-07-23)

**A. Adarsh's accommodation rate → ✅ ABH rate is correct.** He moves to ₹1000/night on new claims. Past claims keep their frozen ₹2000 snapshot. No override needed — this falls out of the designation change automatically.

**D. Hari's approval history → ✅ Clean cut. Record neither replacement row.** Neither Sreejish nor Jijo inherits Hari's past approvals; each sees only what they action from cutover onward. No cross-state leakage. Hari's history remains fully visible to Finance and Admin, so nothing is lost from the audit trail.
⚠️ Implementation note: this means we **must not** use `admin_finalize_employee_replacement_atomic` for Hari — it writes an `employee_replacements` row as a side effect. Hari's two splits are plain `UPDATE`s.

**C. ZBH (`level_2`) → ✅ Follow the existing state pattern.**
| SBH | State | ZBH (`level_2`) |
|---|---|---|
| Sreejish | TN | NULL (matches Hari today) |
| Jijo | KL | NULL (matches Hari today) |
| Ashish | MH | Tibirisetty V L S Hari Santhosh |
| Bipin | DL | Satya Priya Dash |
| Nithin | KA | Tibirisetty V L S Hari Santhosh |
| **Arka** (MH → RJ) | RJ | **CHANGE:** Hari Santhosh → Satya Priya Dash |

**I. Nithin → ✅ Create now. Correction: he has already joined** — he holds employee ID NW0007097 and a corporate mail. He is a full SBH for Karnataka; only _which_ employees report to him is undecided. So he gets a complete, working SBH record in Phase 2: `KA` primary state, `APPROVER_L1` role, `level_2` = Hari Santhosh, `level_3` = Mansoor, `level_1` NULL (SBH flow is `[2,3]` — his own claims go direct to HOD). He can log in and submit from day one. Reports get assigned when the Karnataka division is finalised — that is a later, separate change.

### 9.4 Proceeding on these unless you say otherwise

**B. L1 approver for the 5 new ABHs** = the SBH of their state:
| New ABH | State | L1 |
|---|---|---|
| Siranjeeva C | TN | Sreejish |
| Rethina Kumar C | TN | Sreejish |
| Nilesh Tiwari | UP | Akshay Kumar Pal |
| Prathamesh Pawar | MH | Ashish Prakash Patil |
| Sparsh Gupta | RJ | Arka Prabha Ghosh |

All five also get `level_3` = Mansoor and `APPROVER_L1` is **not** needed (they're submitters, not approvers — role `EMPLOYEE`).

**E. Akshay's states** → flip to `UP` primary, drop the `DL` link. Otherwise he keeps surfacing as a Delhi NCR approver option alongside Bipin in the admin dropdown.

**F. Arka's states** → add `RJ` primary (he currently has none at all). Also backfill the 7 Maharashtra staff with `MH` primary while we're in there — they currently have zero `employee_states` rows (§2.3), which is a pre-existing data hole.

**G. Hari's own claims** → settle them before inactivating, alongside his approval queue. Inactivating doesn't strand them (Mansoor can still act at `level_3`), but Hari loses all visibility of his own history the moment he goes inactive.

**H. Sequencing** → state-by-state as each person drains, rather than one big-bang cutover. Each state is an independent migration with its own rollback, so partial completion is a safe resting state.

---

## 10. Reference — how the pieces fit

**Designations** (`hierarchy_level`): SRO 1 · BOA 2 · ABH 3 · SBH 4 · ZBH 5 · PM 6 · FIN 7 · ADM 8

**Roles:** ADMIN · APPROVER_L1 · APPROVER_L2 · EMPLOYEE · FINANCE_TEAM

**States (13, 11 in real use):** AP, TG, TN, KL, KA, MH, RJ, DL, UP, WB, OD (+ inactive America, Germany)

**Approval flow** (`designation_approval_flow.required_approval_levels`) — full explanation in **§3.1**:

- SRO / BOA / ABH → `[1,2,3]` — SBH, then HOD, then Finance
- SBH / ZBH → `[2,3]` — straight to HOD, then Finance
- PM → `[3]` — Finance only
- Only element `[0]` has runtime effect; the tail is decorative.

**Claim status ladder:** `L1_PENDING` → `L2_PENDING` → `L3_PENDING_FINANCE_REVIEW` → `APPROVED` → `PAYMENT_RELEASED` (or `REJECTED` from any pending stage)

**Transitions** (`claim_status_transitions`, keyed on `from_status_id` only):

| From                        | Action             | To                          | Requires role                   |
| --------------------------- | ------------------ | --------------------------- | ------------------------------- |
| `L1_PENDING`                | `approved`         | `L2_PENDING`                | `APPROVER_L1`                   |
| `L1_PENDING`                | `rejected`         | `REJECTED`                  | `APPROVER_L1` (notes required)  |
| `L2_PENDING`                | `approved`         | `L3_PENDING_FINANCE_REVIEW` | `APPROVER_L2`                   |
| `L2_PENDING`                | `rejected`         | `REJECTED`                  | `APPROVER_L2` (notes required)  |
| `L3_PENDING_FINANCE_REVIEW` | `finance_approved` | `APPROVED`                  | `FINANCE_TEAM`                  |
| `L3_PENDING_FINANCE_REVIEW` | `finance_rejected` | `REJECTED`                  | `FINANCE_TEAM` (notes required) |
| `APPROVED`                  | `payment_released` | `PAYMENT_RELEASED`          | `FINANCE_TEAM`                  |

**Current SBH roster (dev DB, ACTIVE only):**

| SBH                | State(s) | Reports |
| ------------------ | -------- | ------- |
| Akshay Kumar Pal   | DL\*, UP | 18      |
| Hari Haran S       | KL, TN\* | 16      |
| Vignesh Shenoy     | KA\*     | 16      |
| Madugula Nagaraju  | AP\*     | 10      |
| Adarsh Anand Digal | RJ\*     | 9       |
| Ravinder Jangili   | TG\*     | 8       |
| Arka Prabha Ghosh  | (none)   | 7       |
| Sambit Kumar Aich  | OD\*, WB | 6       |
| Shashank Nanabala  | all 11   | 0       |
| Shivam Kansagara   | (none)   | 0       |

**HOD/PM:** Mansoor Valli Gangupalli (NW0000320) — `approval_employee_id_level_3` for essentially everyone.
**ZBHs:** Satya Priya Dash (DL, OD*, RJ, UP, WB) · Tibirisetty V L S Hari Santhosh (KA*, MH)
**Special case:** Narina Venkata Naga Chandramouli (BOA, central) has `approval_start_level = 2` — skips SBH, goes direct to HOD. Only such record in the DB.

**Observed approver pattern across all active non-SBH staff** (confirms the spec in §11):

- `level_3` = **Mansoor for every single employee**, without exception.
- `level_2` = the ZBH of their state: Hari Santhosh (KA/MH), Satya Priya Dash (DL/OD/RJ/UP/WB), NULL (TN/KL/AP/TG).
- `level_1` = the SBH of their state, NULL for SBH/ZBH/PM.

---

## 11. Build spec — the consolidated target state

⚠️ **Resolve everything by natural key (`employee_id`, `employee_email`, `designation_code`, `state_code`, `role_code`) — never by hard-coded UUID.** The UUIDs I observed are from the dev database and **will differ on production**. The two prior handover migrations already follow this convention; match them.

### 11.1 The 9 employees to create (Phase 2)

`level_3` = Mansoor (`mansoor@nxtwave.co.in`) for all nine. `level_2` follows the ZBH-of-state pattern. `level_1` is NULL for SBHs by design — the SBH flow is `[2,3]`, so their own claims go direct to HOD.

| Emp ID    | Name                 | Email                | Desig   | State (primary) | Roles                      | `level_1`            | `level_2` (ZBH)  |
| --------- | -------------------- | -------------------- | ------- | --------------- | -------------------------- | -------------------- | ---------------- |
| NW0007161 | Siranjeeva C         | siranjeeva.c@        | ABH     | TN              | EMPLOYEE                   | Sreejish             | NULL             |
| NW0007243 | Rethina Kumar C      | c.rethinakumar@      | ABH     | TN              | EMPLOYEE                   | Sreejish             | NULL             |
| NW0007236 | Nilesh Tiwari        | nilesh.tiwari@       | ABH     | UP              | EMPLOYEE                   | Akshay Kumar Pal     | Satya Priya Dash |
| NW0007233 | Prathamesh Pawar     | prathamesh.pawar@    | ABH     | MH              | EMPLOYEE                   | Ashish Prakash Patil | Hari Santhosh    |
| NW0007253 | Sparsh Gupta         | sparsh.gupta@        | ABH     | RJ              | EMPLOYEE                   | Arka Prabha Ghosh    | Satya Priya Dash |
| NW0007185 | Ashish Prakash Patil | ashish.prakashpatil@ | **SBH** | MH              | EMPLOYEE + **APPROVER_L1** | NULL                 | Hari Santhosh    |
| NW0006996 | Bipin Chandra Sati   | bipin.sati@          | **SBH** | DL              | EMPLOYEE + **APPROVER_L1** | NULL                 | Satya Priya Dash |
| NW0000747 | Jijo Varghese        | jijo.varghese@       | **SBH** | KL              | EMPLOYEE + **APPROVER_L1** | NULL                 | NULL             |
| NW0007097 | Nithin K             | nithin.k@            | **SBH** | KA              | EMPLOYEE + **APPROVER_L1** | NULL                 | Hari Santhosh    |

⚠️ **Ordering within Phase 2:** the 4 SBHs must be inserted _before_ the ABHs that point at them (Ashish before Prathamesh, etc.). Sreejish must be reactivated before Siranjeeva/Rethina are created.

⚠️ `admin_create_employee_atomic` validates `level_1` against `approver_selection_rules` (level 1 → SBH, `requires_same_state`), so an ABH's SBH must already hold the right designation **and** share the state. If writing raw SQL instead, that check is bypassed — get it right manually.

### 11.2 The 3 existing records to fix (Phase 2)

| Who                                   | Change                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Sreejish Mohana Kumar** (NW0000744) | status INACTIVE → **ACTIVE** · grant **APPROVER_L1** · primary state KL → **TN** (keep TN, drop or demote KL)                  |
| **Muhammed Hijas**                    | `employee_id` NW1006377 → **NW0007045** (Intern→Employee conversion). Existing `claim_number`s keep the old prefix — expected. |
| **Arka Prabha Ghosh** (NW0001212)     | add `employee_states` row → **RJ primary** (currently has none at all)                                                         |
| **7 Maharashtra staff**               | backfill `employee_states` → **MH primary** (Akre, Ingole, Adhapure, Jain, Bhatkar, Bhure, Raut — currently zero rows)         |

### 11.3 Pointer moves (Phase 3 — each gated on `L1_PENDING = 0`)

All are `UPDATE employees SET approval_employee_id_level_1 = <new>` over a filtered set. **Do not touch `level_2` or `level_3` in these migrations.**

| #   | State | Filter                                                                             | New `level_1` | Expected rows (dev)                  |
| --- | ----- | ---------------------------------------------------------------------------------- | ------------- | ------------------------------------ |
| 1   | MH    | `level_1 = Arka` (no state filter — MH team has no state rows until 11.2 backfill) | Ashish        | 7                                    |
| 2   | RJ    | `level_1 = Adarsh`                                                                 | Arka          | 9 (incl. Adarsh himself — self-loop) |
| 3   | KL    | `level_1 = Hari` **AND** primary state = KL                                        | Jijo          | 4                                    |
| 4   | TN    | `level_1 = Hari` **AND** primary state = TN                                        | Sreejish      | 12                                   |
| 5   | DL    | `level_1 = Akshay` **AND** primary state = DL                                      | Bipin         | 7                                    |

⚠️ Steps 3–5 **must** carry the state filter, or they'll sweep up the other state's team. Step 1 must run before step 2.
⚠️ **Do not use `admin_finalize_employee_replacement_atomic`** for any of these — it does a blanket unfiltered update _and_ writes an `employee_replacements` row, which contradicts the clean-cut decision (§9.3 D).

### 11.4 Role / status / designation changes (Phase 4 — last)

| Who                   | Change                                                            | Precondition                                          |
| --------------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| **Hari Haran**        | → **INACTIVE**                                                    | approval queue drained **and** his own claims settled |
| **Adarsh Digal**      | SBH → **ABH**, and set `level_1` = **Arka** in the same migration | after 11.3 step 2                                     |
| **Akshay Kumar Pal**  | states → **UP primary, drop DL**. Stays SBH, stays ACTIVE.        | after 11.3 step 5                                     |
| **Arka Prabha Ghosh** | `level_2` **Hari Santhosh → Satya Priya Dash** (MH ZBH → RJ ZBH)  | after 11.3 step 2                                     |

⚠️ Adarsh's `level_1` is **mandatory**, not optional — as an ABH his flow becomes `[1,2,3]` and `shouldBlockForMissingLevel1Approver` will block every claim he tries to submit if it's NULL. His `APPROVER_L1` role row becomes inert; removing it is optional cleanup.

### 11.5 Unchanged — explicitly out of scope

Vignesh Shenoy keeps all 16 Karnataka reports · Akshay keeps all 11 UP reports · Mansoor stays `level_3` for everyone · no ZBH changes except Arka · no state split (`Karnataka_1`/`Karnataka_2` rejected, §5) · Nithin gets **no** reports in this change · Chandramouli's `approval_start_level = 2` untouched.

### 11.6 Definition of done

- [ ] §8 queries A/B/E re-run on **production**; head-counts in 11.1/11.3 corrected to real numbers
- [ ] §8 query D snapshot captured for rollback
- [ ] Phase 2 migration + rollback file; verify all 9 exist with correct designation/state/role/approvers
- [ ] Per state: §8 query C shows `L1_PENDING = 0` → apply migration → re-verify counts moved
- [ ] Phase 4 applied; Adarsh can still submit a claim (the real regression test for §9.1)
- [ ] Tests/fixtures updated (landmines #8–#10) — `workflow-test-kit.ts`, `workflow-standard.test.ts`, `workflow-direct.test.ts`, `approval-analytics.test.ts`, `e2e/fixtures/test-accounts.ts`, `scripts/dev/provision-test-accounts.mjs`
- [ ] `npm run test:e2e:parallel` green
