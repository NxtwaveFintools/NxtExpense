# Plan: NxtExpense End-to-End Workflow System

## TL;DR

Build the complete expense claim submission + multi-level approval workflow on top of the existing auth layer. Eight phases from DB schema to tests. All business rules (reimbursement amounts, designation limits, approval chains) stored in Supabase and read at runtime — never hardcoded. Plain Tailwind CSS (no shadcn/ui), single-date-per-submission, free-text outstation city, migrations in `supabase/migrations/`.

---

## Phase 1: Database Schema (supabase/migrations/)

**Files to create: 5 SQL migration files**

### Migration 001_create_enums.sql

- `designation_type`: SRO | BOA | ABH | SBH | ZBH | PM
- `vehicle_type`: Two Wheeler | Four Wheeler
- `work_location_type`: Office / WFH | Field – Base Location | Field – Outstation | Leave | Week-off
- `expense_item_type`: food | fuel | accommodation | taxi_bill | travel_bus_train | food_with_principals | other
- `claim_status`: draft | submitted | pending_approval | approved | rejected
- `approval_action_type`: approved | rejected

### Migration 002_create_tables.sql

- `employees`: id (uuid PK), employee_id (NW…), employee_name, employee_email UNIQUE, state, designation (enum), approval_email_level_1 (nullable), approval_email_level_2 (nullable), approval_email_level_3 NOT NULL, created_at
- `expense_reimbursement_rates`: id, designation, vehicle_type (nullable), rate_type (food_base | food_outstation | fuel_base_daily | fuel_per_km | accommodation), amount NUMERIC, UNIQUE(designation, vehicle_type, rate_type)
- `expense_claims`: id, employee_id FK, claim_date DATE, work_location (enum), vehicle_type (nullable enum), own_vehicle_used BOOLEAN, from_city, to_city, outstation_city (free-text), km_travelled NUMERIC, total_amount NUMERIC DEFAULT 0, status (enum DEFAULT 'draft'), current_approval_level INT, submitted_at, created_at, updated_at; UNIQUE(employee_id, claim_date)
- `expense_claim_items`: id, claim_id FK (CASCADE), item_type (enum), description, amount NUMERIC, created_at
- `approval_history`: id, claim_id FK, approver_email, approval_level INT, action (enum), notes (nullable), acted_at TIMESTAMPTZ DEFAULT now()

### Migration 003_create_indexes.sql

- expense_claims(employee_id), expense_claims(claim_date), expense_claims(status), expense_claims(current_approval_level)
- expense_claim_items(claim_id)
- approval_history(claim_id), approval_history(approver_email)
- employees(employee_email)

### Migration 004_rls_policies.sql

- Enable RLS on all 5 tables
- employees: SELECT for authenticated (all can see all employees — needed for approval chain lookup)
- expense_claims SELECT: employee_id matches own profile OR approver_email matches current approval level
- expense_claims INSERT/UPDATE: own employee_id only (own profile)
- expense_claim_items: follows parent claim RLS via FK
- approval_history SELECT: related employee or approver; INSERT: current approver only

### Migration 005_seed_data.sql

- Seed all employees from employees.json (~50 rows)
- Seed expense_reimbursement_rates from expense_rules.json:
  - food_base: ₹120 (all designations)
  - food_outstation: ₹350 (all designations)
  - fuel_base_daily 2W: ₹180 (all designations with 2W access)
  - fuel_base_daily 4W: ₹300 (SBH, ZBH, PM only)
  - fuel_per_km 2W: ₹5 (outstation)
  - fuel_per_km 4W: ₹8 (outstation)
  - accommodation: ₹1000 (SRO, BOA, ABH) / ₹2000 (SBH, ZBH, PM)

---

## Phase 2: Shared Library Utilities

### src/lib/utils/date.ts (NEW)

- `formatDate(date: Date | string): string` → DD/MM/YYYY (single source of truth for display)
- `formatDatetime(ts: string): string` → DD/MM/YYYY HH:MM
- `parseDateDDMMYYYY(raw: string): Date` → throws if invalid
- `toISODate(date: Date): string` → YYYY-MM-DD for DB
- `isValidClaimDate(date: Date): boolean` → rejects future dates

### src/lib/utils/pagination.ts (NEW)

- `encodeCursor({ created_at, id }): string` → base64 opaque cursor
- `decodeCursor(cursor: string): { created_at: string; id: string }`
- `PaginatedResult<T>` type: { data, nextCursor, hasNextPage, limit }
- Reference pattern from copilot_instructions.md: `.limit(limit + 1)` with composite cursor

### src/lib/validations/claim.ts (NEW)

- `claimDateSchema`: Zod date string in DD/MM/YYYY, rejects future dates, converts to ISO
- `vehicleTypeSchema`: Zod enum matching vehicle_type DB enum
- `workLocationSchema`: Zod enum matching work_location_type DB enum

---

## Phase 3: Employees Feature (src/features/employees/)

### types/index.ts

- `Employee` type matching DB employees table
- `ApprovalChain`: { level1: string|null, level2: string|null, level3: string }

### queries/index.ts

- `getEmployeeByEmail(supabase, email): Promise<Employee | null>`
- `getEmployeeApprovalChain(employee: Employee): ApprovalChain`
- `getAllEmployees(supabase): Promise<Employee[]>` (for approver lookups)

### permissions/index.ts

- `canSubmitFourWheelerClaim(designation: string): boolean` — SBH, ZBH, PM only
- `getAllowedVehicleTypes(designation: string): VehicleType[]`
- `getNextApprovalLevel(employee: Employee, currentLevel: number | null): number | null`

---

## Phase 4: Claims Feature (src/features/claims/)

### types/index.ts

- Enums: `WorkLocation`, `VehicleType`, `ClaimStatus`, `ExpenseItemType` (mirrors DB enums)
- `Claim`: matches expense_claims row
- `ClaimItem`: matches expense_claim_items row
- `ClaimWithItems`: Claim + ClaimItem[]
- `ClaimFormValues`: form submission shape
- `PaginatedClaims`: PaginatedResult<Claim>

### validations/index.ts

Zod discriminated union by `work_location`:

- `officeOrWfhSchema`: just claim_date
- `leaveSchema`: just claim_date
- `weekOffSchema`: just claim_date
- `fieldBaseLocationSchema`: claim_date + vehicle_type (validated against designation server-side)
- `fieldOutstationNoVehicleSchema`: claim_date + outstation_city
- `fieldOutstationOwnVehicleSchema`: claim_date + outstation_city + vehicle_type + from_city + to_city + km_travelled (with max km limits by vehicle)
- Root `claimSubmissionSchema`: discriminated union, plus server-side checks for taxi/fuel exclusion and duplicate prevention

### queries/index.ts

- `getMyClaimsPaginated(supabase, employeeId, cursor?, limit): Promise<PaginatedClaims>`
- `getClaimById(supabase, claimId): Promise<ClaimWithItems | null>`

### mutations/index.ts

- `insertClaim(supabase, data): Promise<{ id: string } | { error: string }>`
- `insertClaimItems(supabase, items): Promise<void>`
- `updateClaimTotal(supabase, claimId, total): Promise<void>`
- `submitClaim(supabase, claimId, firstApprovalLevel): Promise<void>`

### actions/index.ts

Two server actions:

- `submitClaimAction(formData)`: validate → get employee → check duplicate → calculate reimbursement → insert claim + items → submit
- `getMyClaimsAction(cursor?)`: get current user → fetch paginated claims

### permissions/index.ts

- `canViewClaim(user, claim): boolean`
- `canEditClaim(user, claim): boolean` — only draft by owner

### components/ (6 files)

- `claim-submission-form.tsx`: full form with conditional field rendering by work_location
- `base-location-fields.tsx`: vehicle type selector (enforces designation limits)
- `outstation-fields.tsx`: own_vehicle toggle → shows vehicle/city/km fields or not
- `claim-list.tsx`: paginated table with cursor navigation
- `claim-status-badge.tsx`: colored status pill
- `claim-summary-card.tsx`: total breakdown display

---

## Phase 5: Approvals Feature (src/features/approvals/)

### types/index.ts

- `ApprovalAction`: matches approval_history row
- `PendingApproval`: Claim + employee info + items + approval history
- `ApprovalLevel`: 1 | 2 | 3

### validations/index.ts

- `approvalActionSchema`: { action: 'approved' | 'rejected', notes?: string }

### queries/index.ts

- `getPendingApprovalsPaginated(supabase, approverEmail, cursor?, limit): Promise<PaginatedResult<PendingApproval>>`
- `getClaimApprovalHistory(supabase, claimId): Promise<ApprovalAction[]>`

### mutations/index.ts

- `recordApprovalAction(supabase, data): Promise<void>` — inserts approval_history record
- `advanceClaimStatus(supabase, claimId, nextLevel): Promise<void>` — updates expense_claims
- `finalizeApproval(supabase, claimId): Promise<void>` — sets approved
- `rejectClaim(supabase, claimId): Promise<void>` — sets rejected

### actions/index.ts

- `approveClaimAction(claimId, notes?)`: validate approver authority → record action → advance or finalize
- `rejectClaimAction(claimId, notes?)`: validate → record rejection → reject claim
- `getPendingApprovalsAction(cursor?)`: fetch pending queue for current user

### permissions/index.ts

- `getApproverCurrentLevel(approverEmail, employee): ApprovalLevel | null` — which level this approver acts at
- `canApproveAtLevel(approverEmail, claim, employeeOfClaim): boolean`

### components/ (4 files)

- `approval-list.tsx`: paginated table of pending approvals
- `approval-detail.tsx`: full claim breakdown + employee info + approval history
- `approval-actions.tsx`: approve/reject form with notes
- `approval-history-timeline.tsx`: chronological audit trail of approval steps

---

## Phase 6: App Routes (src/app/)

### src/app/claims/page.tsx

Server component. Calls `requireCurrentUser` → `getMyClaimsAction`. Renders `ClaimList` + link to new claim.

### src/app/claims/new/page.tsx

Server component that fetches employee profile + rates. Renders `ClaimSubmissionForm` (client component).

### src/app/approvals/page.tsx

Server component. Calls `requireCurrentUser` → `getPendingApprovalsAction`. Renders `ApprovalList`.

### src/app/approvals/[id]/page.tsx

Server component. Fetches full claim + history. Renders `ApprovalDetail` + `ApprovalActions` + `ApprovalHistoryTimeline`.

---

## Phase 7: Dashboard Update

Update `src/app/dashboard/page.tsx`:

- Add navigation cards: "My Claims" + "Pending Approvals" (shown only if user is an approver)
- Add quick stats: total pending, total approved

---

## Phase 8: Tests

### src/lib/utils/**tests**/date.test.ts (NEW)

- formatDate for valid/invalid inputs
- isValidClaimDate rejects future dates
- parseDateDDMMYYYY parsing

### src/lib/utils/**tests**/pagination.test.ts (NEW)

- encodeCursor/decodeCursor roundtrip
- boundary: empty, last page

### src/features/claims/validations/**tests**/claim-validation.test.ts (NEW)

- Office/WFH: no extra fields needed
- Field base: vehicle required; 4-wheeler rejected for SRO
- Outstation + own vehicle: km > 150 rejected for 2W, km > 300 rejected for 4W
- Outstation taxi/fuel mutual exclusion
- Duplicate date rejection
- Future date rejection

### src/features/approvals/**tests**/approval-routing.test.ts (NEW)

- getApproverCurrentLevel: correct level for SRO (SBH = 1)
- getNextApprovalLevel: SBH→PM (level 2), SRO→final (level 3)
- canApproveAtLevel: wrong approver returns false

---

## Relevant Files

### New Files (in order of creation)

- `supabase/migrations/001_create_enums.sql`
- `supabase/migrations/002_create_tables.sql`
- `supabase/migrations/003_create_indexes.sql`
- `supabase/migrations/004_rls_policies.sql`
- `supabase/migrations/005_seed_data.sql`
- `src/lib/utils/date.ts`
- `src/lib/utils/pagination.ts`
- `src/lib/validations/claim.ts`
- `src/features/employees/types/index.ts`
- `src/features/employees/queries/index.ts`
- `src/features/employees/permissions/index.ts`
- `src/features/claims/types/index.ts`
- `src/features/claims/validations/index.ts`
- `src/features/claims/queries/index.ts`
- `src/features/claims/mutations/index.ts`
- `src/features/claims/actions/index.ts`
- `src/features/claims/permissions/index.ts`
- `src/features/claims/components/claim-submission-form.tsx`
- `src/features/claims/components/base-location-fields.tsx`
- `src/features/claims/components/outstation-fields.tsx`
- `src/features/claims/components/claim-list.tsx`
- `src/features/claims/components/claim-status-badge.tsx`
- `src/features/claims/components/claim-summary-card.tsx`
- `src/features/approvals/types/index.ts`
- `src/features/approvals/validations/index.ts`
- `src/features/approvals/queries/index.ts`
- `src/features/approvals/mutations/index.ts`
- `src/features/approvals/actions/index.ts`
- `src/features/approvals/permissions/index.ts`
- `src/features/approvals/components/approval-list.tsx`
- `src/features/approvals/components/approval-detail.tsx`
- `src/features/approvals/components/approval-actions.tsx`
- `src/features/approvals/components/approval-history-timeline.tsx`
- `src/app/claims/page.tsx`
- `src/app/claims/new/page.tsx`
- `src/app/approvals/page.tsx`
- `src/app/approvals/[id]/page.tsx`
- `src/lib/utils/__tests__/date.test.ts` (extend existing)
- `src/lib/utils/__tests__/pagination.test.ts`
- `src/features/claims/validations/__tests__/claim-validation.test.ts`
- `src/features/approvals/__tests__/approval-routing.test.ts`

### Modified Files

- `src/app/dashboard/page.tsx` — add navigation + quick stats
- `src/lib/utils/__tests__/date.test.ts` — may need to extend

---

## Verification

1. Run `supabase db push` (or apply migrations manually) and verify tables exist with correct schema
2. Seed data: confirm employees table has ~50 rows matching employees.json
3. Submit a claim as SRO employee → verify claim status = `pending_approval`, level = 1
4. Approve at level 1 (SBH) → verify advances to level 3 (Mansoor)
5. Final approve → verify status = `approved`
6. Submit duplicate claim → verify 409 / validation error
7. Submit future-dated claim → verify validation error
8. Submit 4-wheeler claim as SRO → verify rejected with designation error
9. Submit outstation + own vehicle with 200km on 2W → verify rejected (max 150km)
10. Run `npm test` → all unit tests pass
11. Run `npm run build` → zero TS errors

---

## Decisions

- **Single date per submission**: One claim = one calendar date (not range)
- **Outstation city**: Free-text (not preset dropdown)
- **Policy rates in DB**: All ₹ amounts come from `expense_reimbursement_rates` table, not code constants
- **RLS strategy**: All authenticated employees can SELECT employees table; expense_claims RLS uses subquery to match employee_email → auth.email()
- **Plain Tailwind**: No shadcn/ui — use custom components following existing dashboard styling conventions (border-border, bg-surface, bg-background CSS vars)
- **Approval state machine**: Claims advance level-by-level through non-null levels; final approval is always level_3 (Mansoor)
- **Migrations path**: `supabase/migrations/` folder in repo root

---

## Deferred / Out of Scope

- **food_with_principals**: deferred to a future phase
- **Accommodation + bus/train form fields**: not included in this plan
- **CSV/PDF export**: later

---

## Phase 9 — Finance Team Workflow _(depends on Phase 5)_

**Trigger**: Mansoor approves (level 3) → claim status transitions to `finance_review`

**Finance team rules**:

- Sees only `finance_review` claims (never sees in-progress approvals)
- Can act on claims individually OR bulk approve (→ `issued`)
- Can reject individually (→ `finance_rejected`)
- All actions timestamped + attributed
- Protected route — only finance team members can access

**New claim statuses**: `draft | submitted | pending_approval | approved | finance_review | issued | finance_rejected`
_(Note: `approved` = Mansoor acted; `finance_review` = in finance queue; `issued`/`finance_rejected` = final terminal states — exact terminology TBD)_

**Phase 5 mutation change**: `finalizeApproval` sets status = `finance_review` (not a terminal state) once level_3 acts.

### New migration

- `supabase/migrations/006_finance_workflow.sql`:
  - Add `Finance` to `designation_type` enum (finance team = employees with `Finance` designation — no separate table needed)
  - Add `finance_review | issued | finance_rejected` values to `claim_status` enum
  - Create `finance_actions` table: id, claim_id FK, actor_email, action (`issued` | `finance_rejected`), notes (nullable), acted_at TIMESTAMPTZ DEFAULT now()
  - RLS: `finance_actions` INSERT restricted to employees whose designation = `Finance`; SELECT open to finance team + claim owner

### New files: `src/features/finance/`

- `types/index.ts` — `FinanceAction`, `FinanceQueueItem` (claim + employee info), `FinanceActionType`
- `validations/index.ts` — `financeActionSchema` ({ action, notes? }), `bulkFinanceActionSchema` ({ claimIds[], action })
- `queries/index.ts` — `getFinanceQueuePaginated(supabase, cursor?, limit)` — only `finance_review` claims with employee info join
- `mutations/index.ts` — `recordFinanceAction`, `bulkRecordFinanceActions`, `updateClaimToIssued`, `updateClaimToFinanceRejected`
- `actions/index.ts` — `issueClaimAction(claimId)`, `financeRejectClaimAction(claimId)`, `bulkIssueClaimsAction(claimIds[])`, `getFinanceQueueAction(cursor?)`
- `permissions/index.ts` — `isFinanceTeamMember(employee: Employee): boolean` — pure check: `employee.designation === 'Finance'` (no DB call needed)
- `components/finance-queue.tsx` — paginated table with row checkboxes; bulk toolbar visible when ≥1 row checked
- `components/finance-queue-toolbar.tsx` — bulk action bar: selected count + "Issue Selected" button
- `components/finance-claim-row.tsx` — single row with individual "Issue" + "Reject" buttons
- `src/app/finance/page.tsx` — protected; redirects if employee designation !== `Finance`
