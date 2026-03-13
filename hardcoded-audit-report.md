# NxtExpense — Hardcoded Values & Business Logic Audit Report

> **Audit Date:** 2026-03-08  
> **Scope:** Full codebase (`src/`), database schema, knowledge JSON  
> **Auditor:** Automated MCP-driven audit  
> **Status:** Complete

---

## 1. Executive Summary

| Metric                                                 | Count  |
| ------------------------------------------------------ | ------ |
| **Total hardcoded business items found**               | **62** |
| Hardcoded constants (amounts, limits, rates)           | 5      |
| Hardcoded arrays / enums (dropdowns, options)          | 14     |
| Hardcoded business logic (designation checks, routing) | 16     |
| Hardcoded strings (emails, labels, statuses)           | 18     |
| Duplicated definitions (same value in multiple files)  | 9      |
| **Files with hardcoded violations**                    | **28** |
| **Missing configuration tables**                       | **5**  |

### What's Already in the Database (Good)

| Item                                                 | Table                         | Status       |
| ---------------------------------------------------- | ----------------------------- | ------------ |
| Expense rates (food, fuel, intercity, accommodation) | `expense_reimbursement_rates` | ✅ DB-driven |
| Claim statuses with display labels & colors          | `claim_status_catalog`        | ✅ DB-driven |
| Workflow state transitions                           | `claim_transition_graph`      | ✅ DB-driven |
| Approval history                                     | `approval_history`            | ✅ DB-driven |
| Employee data (designation, approval chains)         | `employees`                   | ✅ DB-driven |

### What's NOT in the Database (Critical Gaps)

| Item                                              | Current Location                  | Severity |
| ------------------------------------------------- | --------------------------------- | -------- |
| Designation names & rules                         | PostgreSQL ENUM + code constants  | 🔴 P0    |
| Work location options                             | PostgreSQL ENUM + code constants  | 🔴 P0    |
| Vehicle types                                     | PostgreSQL ENUM + code constants  | 🔴 P0    |
| KM limits per vehicle type                        | Hardcoded in validation (150/300) | 🔴 P0    |
| Four-wheeler eligibility per designation          | Hardcoded in permissions          | 🔴 P0    |
| Transport types (Rental Vehicle, Rapido/Uber/Ola) | Hardcoded in validation           | 🟠 P1    |
| Allowed email domains                             | Hardcoded in auth module          | 🟠 P1    |
| Actor filter buckets (sbh/hod/finance)            | Hardcoded in approval filters     | 🟠 P1    |
| Designation → filter code mapping                 | Hardcoded in history-filters.ts   | 🟠 P1    |
| Approval level skip logic (L2 skipped)            | Hardcoded in permissions          | 🟠 P1    |
| Notes max length (500)                            | Hardcoded in Zod schemas          | 🟡 P2    |
| CSV export headers                                | Hardcoded in history-filters.ts   | 🟡 P2    |
| Currency format (Rs.)                             | Hardcoded in CSV export           | 🟡 P2    |
| Timezone (IST +05:30)                             | Hardcoded in date utils           | 🟡 P2    |

---

## 2. Hardcoded Constants (Amounts, Limits, Rates)

| #   | Constant                | Value | File                                          | Line    | Usage             | Migration Target                                                                 |
| --- | ----------------------- | ----- | --------------------------------------------- | ------- | ----------------- | -------------------------------------------------------------------------------- |
| 1   | KM limit (Two Wheeler)  | `150` | `src/features/claims/validations/index.ts`    | L106    | Validation max KM | `expense_reimbursement_rates` — add `max_km` column or new `vehicle_rules` table |
| 2   | KM limit (Four Wheeler) | `300` | `src/features/claims/validations/index.ts`    | L106    | Validation max KM | Same as above                                                                    |
| 3   | Notes max length        | `500` | `src/features/approvals/validations/index.ts` | L40     | Zod `.max(500)`   | `system_settings` table                                                          |
| 4   | Notes max length (dup)  | `500` | `src/features/finance/validations/index.ts`   | L41     | Zod `.max(500)`   | Same                                                                             |
| 5   | Notes max length (dup)  | `500` | `src/features/admin/validations/index.ts`     | L9, L28 | Zod `.max(500)`   | Same                                                                             |

**Key observation:** Expense rates (120, 350, 180, 300, 5, 8, 1000, 2000) are correctly stored in `expense_reimbursement_rates` table and fetched via `getRateAmount()`. This is well-designed. The only missing piece is **KM limits** (150/300) which are still hardcoded in validation.

---

## 3. Hardcoded Arrays & Enums

| #   | Array/Enum                                      | Values                                                                                 | File                                          | Line      | Duplicated?      | Migration Target                                        |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------- | --------- | ---------------- | ------------------------------------------------------- |
| 1   | `WORK_LOCATION_VALUES`                          | `['Office / WFH', 'Field - Base Location', 'Field - Outstation', 'Leave', 'Week-off']` | `src/lib/validations/claim.ts`                | L9-15     | Yes (3 places)   | DB lookup table or fetch from DB enum                   |
| 2   | `WORK_LOCATION_FILTER_VALUES`                   | Same 5 values                                                                          | `src/features/claims/types/index.ts`          | L9-15     | Duplicate of #1  | Consolidate → single DB source                          |
| 3   | `WORK_LOCATION_OPTIONS`                         | Same 5 values                                                                          | `src/app/claims/new/page.tsx`                 | L14-20    | Duplicate of #1  | Fetch from DB                                           |
| 4   | `VEHICLE_TYPE_VALUES`                           | `['Two Wheeler', 'Four Wheeler']`                                                      | `src/lib/validations/claim.ts`                | L17       | Yes (3+ places)  | DB lookup or fetch from DB enum                         |
| 5   | `z.enum(['Two Wheeler', 'Four Wheeler'])`       | Inline                                                                                 | `src/features/claims/validations/index.ts`    | L58, L84  | Duplicate of #4  | Use shared schema                                       |
| 6   | `TRANSPORT_TYPE_VALUES`                         | `['Rental Vehicle', 'Rapido/Uber/Ola']`                                                | `src/features/claims/validations/index.ts`    | L7        | Yes (2 places)   | New `transport_types` table                             |
| 7   | `TRANSPORT_TYPE_OPTIONS`                        | Same values                                                                            | `src/app/claims/new/page.tsx`                 | L22       | Duplicate of #6  | Fetch from DB                                           |
| 8   | `DESIGNATION_VALUES`                            | 8 designation names                                                                    | `src/features/employees/types/index.ts`       | L1-10     | Single source ✅ | Already DB enum; should fetch dynamically               |
| 9   | `FOUR_WHEELER_ALLOWED_DESIGNATIONS`             | `['State Business Head', 'Zonal Business Head', 'Program Manager']`                    | `src/features/employees/permissions/index.ts` | L10-13    | No               | `designation_vehicle_rules` table                       |
| 10  | `FINANCE_ACTIONS`                               | `['issued', 'finance_rejected']`                                                       | `src/features/finance/validations/index.ts`   | L5        | Yes (dup at L58) | Already DB enum; use `claim_transition_graph` to derive |
| 11  | `z.enum(['approved', 'rejected'])`              | Approval actions                                                                       | `src/features/approvals/validations/index.ts` | L36, L114 | Duplicated       | Same — derive from `claim_transition_graph`             |
| 12  | `z.enum(['all', 'sbh', 'hod', 'finance'])`      | Actor filter codes                                                                     | `src/features/approvals/validations/index.ts` | L63       | No               | New `approval_actor_buckets` table                      |
| 13  | `z.enum(['all', 'issued', 'finance_rejected'])` | Finance filter                                                                         | `src/features/finance/validations/index.ts`   | L93       | No               | Derive from DB                                          |
| 14  | `ALLOWED_EMAIL_DOMAINS`                         | `['nxtwave.co.in', 'nxtwave.tech', 'nxtwave.in']`                                      | `src/lib/auth/allowed-email-domains.ts`       | L1-5      | No               | `system_settings` or `allowed_email_domains` table      |

---

## 4. Hardcoded Business Logic (Designation Checks)

| #   | Logic Description                              | File                                              | Lines   | Severity | Migration Strategy                                                                   |
| --- | ---------------------------------------------- | ------------------------------------------------- | ------- | -------- | ------------------------------------------------------------------------------------ |
| 1   | Four Wheeler eligibility: only SBH/ZBH/PM      | `src/features/employees/permissions/index.ts`     | L10-24  | 🔴 P0    | Move to `designation_vehicle_rules` or add column to rates table                     |
| 2   | Allowed vehicle types per designation          | `src/features/employees/permissions/index.ts`     | L27-33  | 🔴 P0    | Derive from `expense_reimbursement_rates` (already partially done in `new/page.tsx`) |
| 3   | L2 approval level intentionally skipped        | `src/features/employees/permissions/index.ts`     | L37-53  | 🟠 P1    | `approval_routing_config` table                                                      |
| 4   | Finance designation check                      | `src/features/finance/permissions/index.ts`       | L4      | 🟡 P2    | `designation_roles` table                                                            |
| 5   | Admin designation check                        | `src/features/admin/permissions/index.ts`         | L4      | 🟡 P2    | Same                                                                                 |
| 6   | Can access employee claims (not Finance/Admin) | `src/features/employees/permissions/index.ts`     | L71     | 🟡 P2    | `designation_capabilities` table                                                     |
| 7   | Dashboard access (Finance → finance queue)     | `src/features/employees/permissions/index.ts`     | L57-67  | 🟡 P2    | Same                                                                                 |
| 8   | Designation → actor filter code mapping        | `src/features/approvals/utils/history-filters.ts` | L55-69  | 🟠 P1    | `designation_filter_mapping` table                                                   |
| 9   | Designation → acronym suffix (SBH, ZBH, PM)    | `src/features/finance/queries/filters.ts`         | L20-32  | 🟡 P2    | Add `abbreviation` column to designations                                            |
| 10  | KM limit per vehicle type in validation        | `src/features/claims/validations/index.ts`        | L106    | 🔴 P0    | Fetch from `vehicle_rules` table                                                     |
| 11  | Status check: `returned_for_modification`      | `src/features/claims/actions/index.ts`            | L78-92  | 🟡 Low   | Already driven by `claim_status_catalog`                                             |
| 12  | `finance_review` status check in HOD filter    | `src/features/finance/queries/filters.ts`         | L102    | 🟡 Low   | Part of workflow state machine                                                       |
| 13  | Approval level numeric checks (1, 2, 3)        | `src/features/approvals/permissions/index.ts`     | L13-20  | 🟠 P1    | Already a concern — hardcoded 3-level max                                            |
| 14  | Claim edit check: `status === 'draft'`         | `src/features/claims/permissions/index.ts`        | L9      | 🟡 Low   | Could derive from `claim_transition_graph`                                           |
| 15  | `resubmission_count > 0` check                 | Multiple components                               | Various | 🟡 Low   | Acceptable — semantic check                                                          |
| 16  | Transport type detection from description      | `src/app/claims/new/page.tsx`                     | L73-76  | 🟠 P1    | Store transport_type as column (not inferred)                                        |

---

## 5. Hardcoded Strings

| #   | String                  | Context                    | File                                                | Line     |
| --- | ----------------------- | -------------------------- | --------------------------------------------------- | -------- |
| 1   | `'State Business Head'` | Designation check          | `src/features/finance/queries/filters.ts`           | L21      |
| 2   | `'Zonal Business Head'` | Designation check          | `src/features/finance/queries/filters.ts`           | L25      |
| 3   | `'Program Manager'`     | Designation check          | `src/features/finance/queries/filters.ts`           | L29      |
| 4   | `'State Business Head'` | Filter mapping             | `src/features/approvals/utils/history-filters.ts`   | L55      |
| 5   | `'Program Manager'`     | Filter mapping             | `src/features/approvals/utils/history-filters.ts`   | L60      |
| 6   | `'Zonal Business Head'` | Filter mapping             | `src/features/approvals/utils/history-filters.ts`   | L61      |
| 7   | `'Finance'`             | Permission check           | Multiple files                                      | Various  |
| 8   | `'Admin'`               | Permission check           | Multiple files                                      | Various  |
| 9   | `'nxtwave.co.in'`       | Email domain               | `src/lib/auth/allowed-email-domains.ts`             | L2       |
| 10  | `'nxtwave.tech'`        | Email domain               | `src/lib/auth/allowed-email-domains.ts`             | L3       |
| 11  | `'nxtwave.in'`          | Email domain               | `src/lib/auth/allowed-email-domains.ts`             | L4       |
| 12  | `'Rental Vehicle'`      | Transport type             | `src/features/claims/validations/index.ts`          | L7       |
| 13  | `'Rapido/Uber/Ola'`     | Transport type             | `src/features/claims/validations/index.ts`          | L7       |
| 14  | `'Rs. '`                | Currency prefix            | `src/features/approvals/utils/history-filters.ts`   | L138     |
| 15  | `'T00:00:00+05:30'`     | IST timezone offset        | `src/features/approvals/queries/history-filters.ts` | L28      |
| 16  | `'T23:59:59.999+05:30'` | IST timezone offset        | `src/features/approvals/queries/history-filters.ts` | L29      |
| 17  | `'Asia/Kolkata'`        | Timezone                   | `src/lib/utils/date.ts`                             | L2       |
| 18  | `'CONFIRM'`             | Admin confirmation literal | `src/features/admin/validations/index.ts`           | L10, L29 |

---

## 6. Frontend Dropdown Audit

| #   | Component                   | Dropdown       | Source                               | Hardcoded?                         | Migration                            |
| --- | --------------------------- | -------------- | ------------------------------------ | ---------------------------------- | ------------------------------------ |
| 1   | `claim-submission-form.tsx` | Work Location  | Props from `page.tsx`                | **Props fed from hardcoded const** | Fetch from DB                        |
| 2   | `claim-submission-form.tsx` | Vehicle Type   | Props from `page.tsx`                | **Derived from rates table** ✅    | Already OK                           |
| 3   | `outstation-fields.tsx`     | Transport Type | Props from `page.tsx`                | **Props fed from hardcoded const** | Fetch from DB                        |
| 4   | `outstation-fields.tsx`     | Vehicle Type   | Props from parent                    | ✅ Data-driven                     | OK                                   |
| 5   | `base-location-fields.tsx`  | Vehicle Type   | Props from parent                    | ✅ Data-driven                     | OK                                   |
| 6   | `claims-filters-bar.tsx`    | Work Location  | `WORK_LOCATION_FILTER_VALUES` import | **Hardcoded import**               | Fetch from DB                        |
| 7   | `approval-filters-bar.tsx`  | Actor Bucket   | Inline `<option>` values             | **Fully hardcoded**                | Fetch from DB                        |
| 8   | `finance-filters-bar.tsx`   | Action filter  | Inline `<option>` values             | **Fully hardcoded**                | Derive from `claim_transition_graph` |
| 9   | `finance-filters-bar.tsx`   | Designation    | Server-fetched                       | ✅ Data-driven                     | OK                                   |
| 10  | `finance-filters-bar.tsx`   | Status         | `claim_status_catalog`               | ✅ Data-driven                     | OK                                   |

**Summary:** 4 dropdowns are fully data-driven, 4 are hardcoded, 2 are partially hardcoded.

---

## 7. Database Schema Gap Analysis

### Existing Tables (7)

| Table                         | Purpose                | Config or Transactional? |
| ----------------------------- | ---------------------- | ------------------------ |
| `employees`                   | Employee master data   | Transactional + Config   |
| `expense_claims`              | Claim records          | Transactional            |
| `expense_claim_items`         | Claim line items       | Transactional            |
| `expense_reimbursement_rates` | Rate configuration     | ✅ Configuration         |
| `approval_history`            | Approval audit trail   | Transactional            |
| `finance_actions`             | Finance audit trail    | Transactional            |
| `claim_status_catalog`        | Status display config  | ✅ Configuration         |
| `claim_transition_graph`      | Workflow state machine | ✅ Configuration         |
| `claim_status_audit`          | Status change audit    | Transactional            |

### Database Enums (Hardcoded in PostgreSQL)

| Enum Type               | Values                                                 | Issue                                          |
| ----------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `designation_type`      | 8 values (SRO, BOA, ABH, SBH, ZBH, PM, Finance, Admin) | Cannot add new designations without migration  |
| `vehicle_type`          | 2 values (Two Wheeler, Four Wheeler)                   | Cannot add new vehicle types without migration |
| `work_location_type`    | 5 values                                               | Cannot add new locations without migration     |
| `expense_item_type`     | 6 values                                               | Cannot add new item types without migration    |
| `claim_status`          | 9 values                                               | Acceptable — status machine is well-defined    |
| `approval_action_type`  | 8 values                                               | Acceptable — tied to workflow logic            |
| `finance_action_type`   | 3 values                                               | Acceptable                                     |
| `claim_actor_scope`     | 4 values                                               | Acceptable                                     |
| `claim_next_level_mode` | 4 values                                               | Acceptable                                     |

**Critical issue:** `designation_type`, `vehicle_type`, and `work_location_type` are PostgreSQL ENUMs. Adding/removing values requires a SQL migration and code deployment. These should be lookup tables instead.

### Missing Configuration Tables

| #   | Table Needed            | Purpose                                                                                                               | Priority |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | `designation_config`    | Designation rules: vehicle eligibility, accommodation limits, capabilities, abbreviation, approval level, filter code | 🔴 P0    |
| 2   | `vehicle_type_config`   | Vehicle rules: max KM limit, per-km rate source, base fuel rate source                                                | 🔴 P0    |
| 3   | `transport_types`       | Transport type options for outstation taxi claims                                                                     | 🟠 P1    |
| 4   | `allowed_email_domains` | Corporate email domains for auth validation                                                                           | 🟠 P1    |
| 5   | `system_settings`       | Global config: max notes length, currency symbol, timezone, pagination defaults                                       | 🟡 P2    |

---

## 8. Cross-Reference: Code vs expense_rules.json vs Database

| Business Rule                             | In `expense_rules.json`? | In Database?                     | In Code?               | Status               |
| ----------------------------------------- | ------------------------ | -------------------------------- | ---------------------- | -------------------- |
| Work location options                     | ✅ Yes                   | ✅ DB enum                       | ✅ Hardcoded           | 🔴 Triple-maintained |
| Vehicle types                             | ✅ Yes                   | ✅ DB enum                       | ✅ Hardcoded           | 🔴 Triple-maintained |
| Food base daily (₹120)                    | ✅ Yes                   | ✅ `expense_reimbursement_rates` | ❌ Not in code         | ✅ OK                |
| Food outstation daily (₹350)              | ✅ Yes                   | ✅ `expense_reimbursement_rates` | ❌ Not in code         | ✅ OK                |
| Fuel base 2W (₹180)                       | ✅ Yes                   | ✅ `expense_reimbursement_rates` | ❌ Not in code         | ✅ OK                |
| Fuel base 4W (₹300)                       | ✅ Yes                   | ✅ `expense_reimbursement_rates` | ❌ Not in code         | ✅ OK                |
| Intercity 2W (₹5/km)                      | ✅ Yes                   | ✅ `expense_reimbursement_rates` | ❌ Not in code         | ✅ OK                |
| Intercity 4W (₹8/km)                      | ✅ Yes                   | ✅ `expense_reimbursement_rates` | ❌ Not in code         | ✅ OK                |
| Accommodation limits                      | ✅ Yes                   | ✅ `expense_reimbursement_rates` | ❌ Not in code         | ✅ OK                |
| KM limit 2W (150)                         | ✅ Yes                   | ❌ **Missing**                   | ✅ Hardcoded           | 🔴 Gap               |
| KM limit 4W (300)                         | ✅ Yes                   | ❌ **Missing**                   | ✅ Hardcoded           | 🔴 Gap               |
| Four-wheeler eligibility                  | ✅ Yes                   | ❌ **Missing**                   | ✅ Hardcoded           | 🔴 Gap               |
| Transport types                           | ❌ No                    | ❌ **Missing**                   | ✅ Hardcoded           | 🔴 Gap               |
| Approval routing (SBH → L1, Mansoor → L3) | ✅ Yes                   | ✅ `employees` columns           | ✅ Partially hardcoded | 🟠 Partial           |
| L2 skip logic                             | ❌ No                    | ❌ **Missing**                   | ✅ Hardcoded           | 🟠 Gap               |
| Email domains                             | ❌ No                    | ❌ **Missing**                   | ✅ Hardcoded           | 🟠 Gap               |
| Date range max (7 days)                   | ✅ Yes                   | ❌ **Missing**                   | ❌ Not enforced        | 🔴 Not implemented   |
| Taxi + fuel mutual exclusivity            | ✅ Yes                   | ❌ **Missing**                   | ❌ Not enforced        | 🔴 Not implemented   |

### expense_rules.json Rules NOT in Database or Code

1. **Max claim date range: 7 days** — documented in knowledge base but not enforced anywhere
2. **Taxi + fuel mutual exclusivity per day** — documented but not enforced
3. **Food-with-principals rules** (₹500 per person, max 5/month) — not implemented at all
4. **Outstation accommodation limits** — rates exist in DB but no validation enforcing the cap

---

## 9. Answers to Critical Questions

### Codebase Questions

| #   | Question                                     | Answer                                                                                             |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Q1  | Unique business numeric literals?            | **5 unique**: 150, 300 (KM limits), 500 (notes max), 100 (pagination max), 6 (password min)        |
| Q2  | z.enum() definitions?                        | **14** across 5 files                                                                              |
| Q3  | const arrays with business data?             | **9** (work locations ×3, vehicle types ×2, transport types ×2, designations ×1, email domains ×1) |
| Q4  | Components with hardcoded `<option>` values? | **2** (`approval-filters-bar.tsx`, `finance-filters-bar.tsx`)                                      |
| Q5  | Files importing from `.github/knowledge/`?   | **0** — knowledge files are reference docs only, not imported                                      |
| Q6  | Switch statements on business entities?      | **0** switch statements; **6** if/else chains on designation                                       |
| Q7  | If/else blocks checking designation?         | **12** across 4 files                                                                              |
| Q8  | Inline calculations in React components?     | **0** — calculations properly separated in `calculations.ts` and `claim-summary-preview.ts`        |
| Q9  | Hardcoded email addresses?                   | **3 domains** in `allowed-email-domains.ts`; test files reference `@nxtwave.co.in`                 |
| Q10 | Validation duplicated frontend/backend?      | **No** — validation is server-side only via Zod. Frontend sends raw data. ✅                       |

### Database Questions

| #   | Question                                      | Answer                                                                                   |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Q11 | Does a designations table exist?              | **No.** Designation is a PostgreSQL ENUM (`designation_type`), not a table.              |
| Q12 | Is `employee.designation` an enum or FK?      | **PostgreSQL ENUM** (`designation_type`) — not a FK to a table.                          |
| Q13 | Is `claim.work_location` an enum or FK?       | **PostgreSQL ENUM** (`work_location_type`) — not a FK to a table.                        |
| Q14 | Is `claim.vehicle_type` an enum or FK?        | **PostgreSQL ENUM** (`vehicle_type`) — not a FK to a table.                              |
| Q15 | Any JSON columns storing config?              | **Yes** — `claim_transition_graph.metadata` and `approval_history.metadata` store JSONB. |
| Q16 | Approval chains: employees table or separate? | **Employees table** — `approval_email_level_1/2/3` columns. No separate routing table.   |
| Q17 | Lookup tables for cities/states/locations?    | **No.** From/to cities are free-text fields. No master tables exist.                     |
| Q18 | System settings table?                        | **No.** No `system_settings` or `config` table exists.                                   |
| Q19 | Expense rates in DB?                          | **Yes** — `expense_reimbursement_rates` with 36 rows. ✅                                 |
| Q20 | Claim statuses hardcoded or DB?               | **DB** — `claim_status_catalog` table exists with display labels, colors, sort order. ✅ |

### Gap Analysis Questions

| #   | Question                                             | Answer                                                                                                                                                 |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q21 | % of expense_rules.json in DB vs code?               | ~**60% in DB** (rates, statuses, workflow), ~**25% in code** (KM limits, eligibility), ~**15% unimplemented** (food-with-principals, taxi exclusivity) |
| Q22 | Rules in code but NOT in expense_rules.json?         | L2 approval skip logic, actor filter bucket mapping, designation abbreviations                                                                         |
| Q23 | Tables that should exist but don't?                  | 5 tables: `designation_config`, `vehicle_type_config`, `transport_types`, `allowed_email_domains`, `system_settings`                                   |
| Q24 | Dropdowns that could be DB-driven but aren't?        | **4**: work location, transport type, actor bucket filter, finance action filter                                                                       |
| Q25 | Calculations hardcoded vs configurable?              | Calculations are **well-designed** — rates come from DB, formulas are in utility functions. Only KM limits are hardcoded.                              |
| Q26 | Inconsistencies between code and expense_rules.json? | Work location uses `–` (en-dash) in JSON but `-` (hyphen) in code/DB. Otherwise consistent.                                                            |
| Q27 | Most frequently changing values?                     | Expense rates (already DB-driven ✅), designation eligibility rules, KM limits                                                                         |
| Q28 | Most complex to migrate?                             | PostgreSQL ENUM → lookup table conversion (requires ALTER TYPE migration and FK changes on all referencing tables)                                     |
| Q29 | Circular dependencies?                               | **No** — dependency graph is clean: UI → Actions → Mutations/Queries → DB                                                                              |
| Q30 | Blast radius of each migration?                      | ENUM→table migration affects: `employees`, `expense_claims`, `expense_reimbursement_rates`, `expense_claim_items` — all core tables                    |

### Architecture Questions

| #   | Question                          | Answer                                                                                                                           |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Q31 | Should expense_rules.json exist?  | **No** — it should be fully replaced by DB. Currently serves only as documentation.                                              |
| Q32 | Should Zod enums be replaced?     | **Yes** — replace `z.enum()` with `z.string().refine()` validated against DB-fetched values at runtime.                          |
| Q33 | Formula templates storage?        | **Not needed** — current approach (rates from DB, formula in TypeScript) is correct. Formulas rarely change; rates change often. |
| Q34 | Admin panel vs direct DB?         | **Admin panel recommended** — finance team cannot use SQL. Start with Supabase dashboard, then build proper admin UI.            |
| Q35 | Version business rules?           | Add `effective_from`/`effective_to` columns to `expense_reimbursement_rates`. Already has `created_at`.                          |
| Q36 | Migration without downtime?       | Phase approach: (1) create new tables, (2) dual-write period, (3) switch reads, (4) remove old code.                             |
| Q37 | Cache configuration?              | **Not needed yet** — 36 rate rows, 9 status rows. Direct DB fetch with Supabase caching headers is sufficient at current scale.  |
| Q38 | Type safety with DB-driven enums? | Use TypeScript branded types + runtime validation. Fetch allowed values at server component level, pass as props.                |
| Q39 | API layer for config?             | Server components fetch directly via Supabase client. No separate API needed.                                                    |
| Q40 | Rollback strategy?                | Keep old ENUM types during migration period. If new tables fail, code can fall back to ENUM checks.                              |

---

## 10. Migration Plan

### Phase 1: Create Configuration Tables (P0 — Critical)

**Estimated effort: 16 hours**

#### 1a. Create `designation_config` table

```sql
CREATE TABLE public.designation_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designation designation_type UNIQUE NOT NULL,
  abbreviation text, -- 'SRO', 'BOA', 'ABH', 'SBH', 'ZBH', 'PM'
  allowed_vehicle_types vehicle_type[] NOT NULL DEFAULT '{}',
  max_km_two_wheeler integer DEFAULT 150,
  max_km_four_wheeler integer DEFAULT 300,
  can_create_claims boolean DEFAULT true,
  can_view_approvals boolean DEFAULT false, -- determined at runtime by approval chain
  can_view_finance_queue boolean DEFAULT false,
  actor_filter_code text, -- 'sbh', 'hod', 'finance', null
  approval_level_start integer DEFAULT 1,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed data
INSERT INTO public.designation_config (designation, abbreviation, allowed_vehicle_types, can_create_claims, can_view_finance_queue, actor_filter_code, sort_order)
VALUES
  ('Student Relationship Officer', 'SRO', '{Two Wheeler}', true, false, null, 1),
  ('Business Operation Associate', 'BOA', '{Two Wheeler}', true, false, null, 2),
  ('Area Business Head', 'ABH', '{Two Wheeler}', true, false, null, 3),
  ('State Business Head', 'SBH', '{"Two Wheeler","Four Wheeler"}', true, false, 'sbh', 4),
  ('Zonal Business Head', 'ZBH', '{"Two Wheeler","Four Wheeler"}', true, false, 'hod', 5),
  ('Program Manager', 'PM', '{"Two Wheeler","Four Wheeler"}', true, false, 'hod', 6),
  ('Finance', null, '{}', false, true, 'finance', 7),
  ('Admin', null, '{}', false, false, null, 8);
```

#### 1b. Add KM limits to `expense_reimbursement_rates`

```sql
ALTER TABLE public.expense_reimbursement_rates
ADD COLUMN max_km integer;

UPDATE public.expense_reimbursement_rates
SET max_km = 150
WHERE vehicle_type = 'Two Wheeler' AND rate_type = 'intercity_per_km';

UPDATE public.expense_reimbursement_rates
SET max_km = 300
WHERE vehicle_type = 'Four Wheeler' AND rate_type = 'intercity_per_km';
```

#### 1c. Create `transport_types` table

```sql
CREATE TABLE public.transport_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.transport_types (name, sort_order)
VALUES ('Rental Vehicle', 1), ('Rapido/Uber/Ola', 2);
```

#### 1d. Create `allowed_email_domains` table

```sql
CREATE TABLE public.allowed_email_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.allowed_email_domains (domain)
VALUES ('nxtwave.co.in'), ('nxtwave.tech'), ('nxtwave.in');
```

#### 1e. Create `system_settings` table

```sql
CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  value_type text NOT NULL DEFAULT 'string', -- 'string', 'integer', 'boolean'
  description text,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.system_settings (key, value, value_type, description)
VALUES
  ('notes_max_length', '500', 'integer', 'Maximum character length for notes fields'),
  ('currency_symbol', 'Rs.', 'string', 'Currency symbol for display and export'),
  ('timezone', 'Asia/Kolkata', 'string', 'System timezone for date operations'),
  ('pagination_max_limit', '100', 'integer', 'Maximum items per page'),
  ('max_claim_date_range_days', '7', 'integer', 'Maximum days in a single claim date range');
```

### Phase 2: Refactor Code to Use DB Config (P1 — High)

**Estimated effort: 24 hours**

| #   | Task                                                         | Files Affected                                                                                                                                                 | Effort |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Replace `FOUR_WHEELER_ALLOWED_DESIGNATIONS` with DB query    | `src/features/employees/permissions/index.ts`, `src/app/claims/new/page.tsx`                                                                                   | 3h     |
| 2   | Replace hardcoded KM limits (150/300) with DB lookup         | `src/features/claims/validations/index.ts`, `src/features/claims/actions/index.ts`                                                                             | 4h     |
| 3   | Replace `WORK_LOCATION_OPTIONS` with DB fetch                | `src/app/claims/new/page.tsx`, `src/lib/validations/claim.ts`, `src/features/claims/types/index.ts`                                                            | 3h     |
| 4   | Replace `TRANSPORT_TYPE_VALUES/OPTIONS` with DB fetch        | `src/app/claims/new/page.tsx`, `src/features/claims/validations/index.ts`                                                                                      | 2h     |
| 5   | Replace `ALLOWED_EMAIL_DOMAINS` with DB fetch                | `src/lib/auth/allowed-email-domains.ts`                                                                                                                        | 2h     |
| 6   | Replace hardcoded actor filter codes with DB                 | `src/features/approvals/utils/history-filters.ts`, `src/features/approvals/validations/index.ts`, `src/features/approvals/components/approval-filters-bar.tsx` | 4h     |
| 7   | Replace designation abbreviation logic with DB               | `src/features/finance/queries/filters.ts`                                                                                                                      | 1h     |
| 8   | Replace L2 skip logic with configurable routing              | `src/features/employees/permissions/index.ts`                                                                                                                  | 3h     |
| 9   | Replace hardcoded finance action filter with DB-derived list | `src/features/finance/components/finance-filters-bar.tsx`                                                                                                      | 2h     |

### Phase 3: Eliminate Duplications (P1 — High)

**Estimated effort: 8 hours**

| #   | Duplication                                              | Files                                        | Fix                         |
| --- | -------------------------------------------------------- | -------------------------------------------- | --------------------------- |
| 1   | `WORK_LOCATION_*` defined 3 times                        | `claim.ts`, `types/index.ts`, `new/page.tsx` | Single source from DB       |
| 2   | `VEHICLE_TYPE_VALUES` defined 2+ times                   | `claim.ts`, `validations/index.ts`           | Single source from DB       |
| 3   | `TRANSPORT_TYPE_*` defined 2 times                       | `validations/index.ts`, `new/page.tsx`       | Single source from DB       |
| 4   | `z.enum(['issued', 'finance_rejected'])` defined 2 times | `finance/validations/index.ts` L5 & L58      | Consolidate to single const |
| 5   | Notes `.max(500)` in 3 different validation files        | approvals, finance, admin validations        | Use `system_settings`       |
| 6   | Action strings duplicated across type + validation files | Multiple                                     | Single source enum          |

### Phase 4: Long-Term — ENUM to Lookup Table (P2 — Medium)

**Estimated effort: 40+ hours (complex migration)**

This is the most impactful but highest-risk migration. PostgreSQL ENUMs cannot have values removed (only added). Converting to lookup tables requires:

1. Create lookup tables (`designations`, `work_locations`, `vehicle_types`)
2. Add FK columns alongside ENUM columns
3. Migrate data
4. Update all queries to use FK instead of ENUM
5. Remove ENUM columns
6. Drop ENUM types

**Recommendation:** Defer this to a separate initiative. The current ENUM approach works well for values that change rarely (designations, vehicle types). The Phase 1 `designation_config` table provides the missing configurability without the risky ENUM migration.

---

## 11. Refactoring Checklist (File-by-File)

| File                                                         | Changes Needed                                                                                                                                    | Priority |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `src/features/employees/permissions/index.ts`                | Replace `FOUR_WHEELER_ALLOWED_DESIGNATIONS` ↦ DB query; Replace L2 skip logic ↦ configurable; Replace Finance/Admin checks ↦ `designation_config` | P0       |
| `src/features/claims/validations/index.ts`                   | Replace KM limits (150/300) ↦ DB fetch; Refactor vehicle type validation to use DB-allowed types                                                  | P0       |
| `src/lib/validations/claim.ts`                               | Remove `WORK_LOCATION_VALUES`, `VEHICLE_TYPE_VALUES` ↦ accept dynamic values                                                                      | P1       |
| `src/features/claims/types/index.ts`                         | Remove `WORK_LOCATION_FILTER_VALUES` ↦ fetch from DB                                                                                              | P1       |
| `src/app/claims/new/page.tsx`                                | Remove `WORK_LOCATION_OPTIONS`, `TRANSPORT_TYPE_OPTIONS` ↦ fetch from DB tables                                                                   | P1       |
| `src/features/claims/validations/index.ts`                   | Remove `TRANSPORT_TYPE_VALUES` ↦ fetch from `transport_types` table                                                                               | P1       |
| `src/lib/auth/allowed-email-domains.ts`                      | Replace `ALLOWED_EMAIL_DOMAINS` ↦ fetch from `allowed_email_domains` table                                                                        | P1       |
| `src/features/approvals/utils/history-filters.ts`            | Replace designation→filter mapping ↦ `designation_config.actor_filter_code`                                                                       | P1       |
| `src/features/approvals/validations/index.ts`                | Replace hardcoded actor filter enum ↦ runtime validation against DB                                                                               | P1       |
| `src/features/approvals/components/approval-filters-bar.tsx` | Replace hardcoded `<option>` values ↦ props from server component                                                                                 | P1       |
| `src/features/finance/queries/filters.ts`                    | Replace `addAcronymSuffix()` ↦ `designation_config.abbreviation`                                                                                  | P2       |
| `src/features/finance/components/finance-filters-bar.tsx`    | Replace hardcoded action filter ↦ derive from `claim_transition_graph`                                                                            | P2       |
| `src/features/finance/validations/index.ts`                  | Consolidate duplicate `z.enum(['issued', 'finance_rejected'])`                                                                                    | P2       |
| `src/features/approvals/queries/history-filters.ts`          | Replace hardcoded IST offset ↦ `system_settings.timezone`                                                                                         | P2       |
| `src/features/approvals/utils/history-filters.ts`            | Replace `'Rs. '` ↦ `system_settings.currency_symbol`                                                                                              | P2       |
| `src/features/employees/types/index.ts`                      | `DESIGNATION_VALUES` should be a runtime fetch, not compile-time const                                                                            | P2       |
| `src/features/admin/validations/index.ts`                    | Replace `.max(500)` ↦ `system_settings.notes_max_length`                                                                                          | P2       |
| `src/features/approvals/validations/index.ts`                | Replace `.max(500)` ↦ same                                                                                                                        | P2       |
| `src/features/finance/validations/index.ts`                  | Replace `.max(500)` ↦ same                                                                                                                        | P2       |

---

## 12. Rules from expense_rules.json NOT Implemented

These rules exist in the knowledge base but have **no enforcement** in code or database:

| Rule                            | Description                                       | Implementation Needed              |
| ------------------------------- | ------------------------------------------------- | ---------------------------------- |
| Max 7-day date range            | Employees can only claim up to 7 consecutive days | Server action validation           |
| Taxi + fuel mutual exclusivity  | Cannot claim fuel and taxi on same day            | Server action + DB constraint      |
| Food-with-principals            | ₹500/person, max 5 times/month                    | New expense item type + validation |
| 1 fuel entry per day            | Only one fuel claim per day allowed               | DB unique constraint               |
| Travel cities for outstation    | Must record cities for outstation                 | Already implemented ✅             |
| Accommodation limit enforcement | Cap exists in rates table but not validated       | Server action validation           |

---

## 13. Prioritized Action Items

### Immediate (P0) — Do First

1. **Create `designation_config` table** — unblocks vehicle eligibility, dashboard access, filter mapping
2. **Add `max_km` to `expense_reimbursement_rates`** — removes last hardcoded rate value
3. **Create `transport_types` table** — removes hardcoded transport options

### Next Sprint (P1) — High Priority

4. **Create `allowed_email_domains` table** — security configuration
5. **Create `system_settings` table** — centralizes global config
6. **Refactor permissions to use `designation_config`** — removes all designation if/else chains
7. **Refactor dropdowns to fetch from DB** — eliminates hardcoded `<option>` values
8. **Implement missing business rules** — 7-day limit, taxi/fuel exclusivity

### Future (P2) — Medium Priority

9. **Convert PostgreSQL ENUMs to lookup tables** — enables runtime configuration
10. **Build admin panel for configuration management** — enables non-developers to update rules
11. **Centralize notes/pagination limits** — removes scattered magic numbers
12. **Add `effective_from`/`effective_to` to rates** — enables rate versioning
