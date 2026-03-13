# NxtExpense — Admin Panel Requirements

> **Related:** `hardcoded-audit-report.md`, `proposed-schema.sql`  
> **Purpose:** Define the admin panel needed for managing DB-driven configuration

---

## Overview

Once business rules migrate from code to database, an admin panel is required so the finance/HR team can manage configuration without developer intervention.

---

## Required Admin Pages

### 1. Designation Configuration (`/admin/designations`)

**Table:** `designation_config`

| Field                   | Input Type                  | Editable? |
| ----------------------- | --------------------------- | --------- |
| Designation name        | Read-only (PostgreSQL ENUM) | ❌        |
| Abbreviation            | Text input                  | ✅        |
| Allowed vehicle types   | Multi-select checkbox       | ✅        |
| Max KM (Two Wheeler)    | Number input                | ✅        |
| Max KM (Four Wheeler)   | Number input                | ✅        |
| Can create claims       | Toggle                      | ✅        |
| Can view finance queue  | Toggle                      | ✅        |
| Can view admin panel    | Toggle                      | ✅        |
| Actor filter code       | Text input                  | ✅        |
| Approval levels to skip | Multi-select (1, 2, 3)      | ✅        |
| Sort order              | Number input                | ✅        |
| Is active               | Toggle                      | ✅        |

**Access:** Admin designation only  
**Audit:** Log all changes with actor + timestamp

---

### 2. Expense Rates Management (`/admin/rates`)

**Table:** `expense_reimbursement_rates`

| Field        | Input Type                           | Editable?                             |
| ------------ | ------------------------------------ | ------------------------------------- |
| Designation  | Dropdown (from `designation_config`) | ⚠️ Part of composite key              |
| Rate type    | Read-only                            | ❌                                    |
| Vehicle type | Read-only                            | ❌                                    |
| Amount (₹)   | Number input                         | ✅                                    |
| Max KM       | Number input                         | ✅ (only for `intercity_per_km` rows) |

**Display:** Group by designation, show all rate types per designation in a card/grid layout  
**Validation:** Amount must be > 0. Max KM must be > 0 when applicable.

---

### 3. Transport Types (`/admin/transport-types`)

**Table:** `transport_types`

| Field      | Input Type   | Editable? |
| ---------- | ------------ | --------- |
| Name       | Text input   | ✅        |
| Is active  | Toggle       | ✅        |
| Sort order | Number input | ✅        |

**Actions:** Add new, edit existing, deactivate (never delete)

---

### 4. Email Domains (`/admin/email-domains`)

**Table:** `allowed_email_domains`

| Field     | Input Type | Editable? |
| --------- | ---------- | --------- |
| Domain    | Text input | ✅        |
| Is active | Toggle     | ✅        |

**Actions:** Add new, edit existing, deactivate  
**Validation:** Domain must match pattern `^[a-z0-9.-]+\.[a-z]{2,}$`

---

### 5. System Settings (`/admin/settings`)

**Table:** `system_settings`

| Setting                     | Display        | Input Type                    |
| --------------------------- | -------------- | ----------------------------- |
| Notes max length            | `500`          | Number input                  |
| Currency symbol             | `Rs.`          | Text input                    |
| Timezone                    | `Asia/Kolkata` | Dropdown (IANA timezone list) |
| UTC offset                  | `+05:30`       | Auto-derived from timezone    |
| Pagination max limit        | `100`          | Number input                  |
| Max claim date range (days) | `7`            | Number input                  |

**Validation:** Integer settings must be positive. Timezone must be valid IANA timezone.

---

### 6. Workflow State Machine (Read-Only) (`/admin/workflow`)

**Tables:** `claim_status_catalog`, `claim_transition_graph`

**Purpose:** Visual representation of the claim workflow state machine. Read-only for now — workflow changes should go through migrations.

**Display:**

- Status list with color tokens
- Transition graph as a table or simple flow diagram
- Which actor scopes can trigger which transitions

---

## Access Control

| Page                     | Required Designation       |
| ------------------------ | -------------------------- |
| `/admin/designations`    | Admin                      |
| `/admin/rates`           | Admin                      |
| `/admin/transport-types` | Admin                      |
| `/admin/email-domains`   | Admin                      |
| `/admin/settings`        | Admin                      |
| `/admin/workflow`        | Admin, Finance (read-only) |

All admin pages must:

1. Verify designation server-side before rendering
2. Log all write operations to an audit trail
3. Show confirmation dialog before saving changes
4. Show success/error feedback after operations

---

## Implementation Notes

- Use Next.js server components for data fetching
- Use server actions for mutations (no API routes)
- Follow existing project patterns (Zod validation, cursor pagination where applicable)
- Each admin page should be under `src/app/admin/` with feature logic in `src/features/admin/`
- Reuse existing `src/components/ui/` components (table, form inputs, toggles)

---

## Phased Delivery

| Phase   | Pages                                           | Depends On              |
| ------- | ----------------------------------------------- | ----------------------- |
| Phase 1 | Designation Config, Expense Rates               | Migration 022, 023      |
| Phase 2 | Transport Types, Email Domains, System Settings | Migration 024, 025, 026 |
| Phase 3 | Workflow Viewer                                 | No migration needed     |
