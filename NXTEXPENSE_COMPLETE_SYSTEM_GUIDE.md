# NxtExpense Complete System Documentation (Beginner Friendly)

## Document Goal

This document explains the full NxtExpense system in simple language.

It is written for:

- New developers joining the project
- QA engineers who need architecture context
- Product/operations people who want technical clarity
- Beginners who are learning full-stack systems

It covers:

- Architecture
- Folder structure
- Frontend and backend
- Database design
- Authentication
- Approval workflow
- Data flow
- How to extend the system safely

---

## 1. Project Overview

### What This App Does

NxtExpense is an internal expense claim platform.

Employees can:

- Log in with company account
- Submit daily expense claims
- Track claim status

Approvers can:

- Review pending claims
- Approve or reject with notes

Finance team can:

- Process approved claims
- Issue payment or reject
- Export finance history

Admins can:

- Manage key configuration tables
- Roll back claim states
- Reassign approvers

### Real-World Analogy

Think of this system like a digital office file movement process:

1. Employee fills an expense form and submits it.
2. First manager checks it.
3. Higher approver checks it.
4. Finance verifies and pays.
5. Every action is written in a permanent log.

This is exactly what NxtExpense does, but with strict role checks and database-controlled workflow states.

---

## 2. Architecture Overview

### Big Picture

NxtExpense uses a modern full-stack architecture:

- Frontend and backend in Next.js App Router
- Database + auth + RLS in Supabase
- Server Actions for business operations
- Supabase RPCs for atomic workflow transitions

### Frontend vs Backend

Frontend responsibilities:

- Render pages and forms
- Collect user input
- Trigger server actions
- Show statuses and timeline

Backend responsibilities:

- Validate payloads
- Check user session and role
- Read and write data through Supabase
- Run transactional workflow logic via RPCs

### How Next.js and Supabase Work Together

At runtime:

1. Page loads on server component.
2. Page calls queries or services with Supabase server client.
3. User performs an action (submit/approve/reject/issue).
4. Client component calls server action.
5. Server action validates and calls RPC or table mutation.
6. DB updates status + history inside transaction.
7. UI reloads/revalidates.

### Core Technical Pattern

The project mostly follows:

- Page components: compose data and render UI
- Feature actions: write operations and permission checks
- Feature queries: read operations with pagination and filters
- Lib services: shared data access or business helpers
- DB migrations: source of truth for schema and workflow design

---

## 3. Folder and File Structure

### Root-Level Important Files

- `package.json`: scripts, dependencies, tooling commands
- `middleware.ts`: route protection + session refresh + domain gate
- `playwright.config.ts`: end-to-end browser test config
- `vitest.config.ts`: unit/integration test config and coverage rules
- `supabase/migrations/*`: full database schema and workflow evolution
- `ADMIN_SYSTEM_ARCHITECTURE.md`: architecture analysis and design guidance

### Source Root

Inside `src/`:

- `app/`: route-level pages and route handlers (Next.js App Router)
- `features/`: feature modules (claims, approvals, finance, admin, auth)
- `components/`: reusable UI components
- `lib/`: shared infra, services, utils, validations

### App Router Structure (`src/app`)

- `page.tsx`: redirects user to dashboard or login
- `login/page.tsx`: login UI
- `auth/callback/route.ts`: OAuth callback handler
- `(app)/layout.tsx`: authenticated app shell (header + transitions)
- `(app)/dashboard/page.tsx`: main dashboard
- `(app)/claims/*`: claims list/new/detail/export
- `(app)/approvals/*`: approvals list/detail/export
- `(app)/finance/*`: finance queue/history/export
- `(app)/admin/*`: admin module pages
- `api/config/*`: lightweight read APIs for config catalogs

### Feature Modules (`src/features`)

Each feature is grouped by domain:

- `auth/`
- `claims/`
- `approvals/`
- `finance/`
- `admin/`
- `dashboard/`
- `employees/` (permission helpers)

Common subfolders:

- `actions/`: server actions (writes)
- `queries/`: reads and data shaping
- `components/`: feature UI
- `validations/`: zod schemas
- `types/`: feature types
- `permissions/`: role checks
- `utils/`: formatting and filter helpers

### Shared Libraries (`src/lib`)

- `supabase/`: client creation and middleware session refresh logic
- `session/`: authenticated user helpers
- `auth/`: domain checks and OAuth utility helpers
- `services/`: DB-backed reusable business/service logic
- `utils/`: pagination, date, search params, workflow labels
- `validations/`: shared zod schemas

---

## 4. Frontend

### Routing and Pages

Main user-facing pages:

- Login: `src/app/login/page.tsx`
- Dashboard: `src/app/(app)/dashboard/page.tsx`
- Claims list: `src/app/(app)/claims/page.tsx`
- New claim: `src/app/(app)/claims/new/page.tsx`
- Claim detail: `src/app/(app)/claims/[id]/page.tsx`
- Approvals: `src/app/(app)/approvals/page.tsx`
- Finance: `src/app/(app)/finance/page.tsx`
- Admin dashboard: `src/app/(app)/admin/page.tsx`

### Layout and Navigation

Global layout:

- `src/app/layout.tsx`: theme providers, fonts, toaster
- `src/app/(app)/layout.tsx`: app header and transitions

Header and navigation:

- `src/components/ui/app-header.tsx`
- `src/components/ui/app-nav-links.tsx`

Navigation is role-aware:

- Employee sees claims
- Approver sees approvals
- Finance sees finance queue
- Admin sees admin pages

### Claims UI Structure

Core components:

- `src/features/claims/components/claim-list.tsx`
- `src/features/claims/components/claim-submission-form.tsx`
- `src/features/claims/components/use-claim-submission-form.ts`
- `src/features/claims/components/claim-detail.tsx`
- `src/features/claims/components/claim-history-timeline.tsx`

Submission form behavior:

- Dynamically shows fields based on work location configuration
- Supports base location and outstation branches
- Calculates summary preview before submit
- Uses server action for final validation + insertion

### Approvals UI Structure

Key components:

- `src/features/approvals/components/approval-list.tsx`
- `src/features/approvals/components/approval-actions.tsx`
- `src/features/approvals/components/approval-history-list.tsx`

Approver can:

- See pending claims assigned to current level
- Run workflow actions based on DB-provided available actions
- View approval history timeline

### Finance UI Structure

Key components:

- `src/features/finance/components/finance-queue.tsx`
- `src/features/finance/components/finance-actions.tsx`
- `src/features/finance/components/finance-history-list.tsx`
- `src/features/finance/components/finance-filters-bar.tsx`

Finance can:

- Filter by many fields
- Run single or bulk actions
- Export history CSV

### UI to Backend Interaction Pattern

Client components call server actions.

Example:

- `approval-actions.tsx` calls `submitApprovalAction` from `features/approvals/actions`
- `finance-actions.tsx` calls `submitFinanceAction` from `features/finance/actions`
- claim form hook calls `submitClaimAction` from `features/claims/actions`

This keeps direct database access on the server side, not in browser code.

---

## 5. Backend Logic

### Where Backend Logic Lives

In this project, backend is split into three layers:

1. Server actions in feature modules
2. Query modules for reading
3. Supabase RPC functions for atomic transitions

### Authentication and Session Backend

Main files:

- `middleware.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/session/server-session.ts`
- `src/app/auth/callback/route.ts`

Behavior:

- Refreshes Supabase session on protected routes
- Clears stale auth cookies if refresh token is invalid
- Blocks non-corporate domains
- Redirects unauthorized users to login

### Claims Backend

Main files:

- `src/features/claims/actions/index.ts`
- `src/features/claims/mutations/index.ts`
- `src/features/claims/queries/index.ts`

What happens on claim submit:

- Validate input with zod
- Resolve employee by authenticated email
- Check role is allowed for employee claims
- Check duplicate claim date guard
- Resolve work location behavior from DB flags
- Validate city-state consistency for outstation
- Compute amounts using DB rates
- Resolve initial workflow status from designation flow
- Insert claim and claim items
- Handle rejected-claim resubmission path with supersede RPC

### Approvals Backend

Main files:

- `src/features/approvals/actions/index.ts`
- `src/features/approvals/queries/index.ts`
- `src/features/approvals/queries/history-filters.ts`

What happens on approval action:

- Validate payload
- Fetch approver context
- Check notes length from system settings
- Check available actions from RPC
- Call RPC `submit_approval_action_atomic`
- Revalidate affected paths

### Finance Backend

Main files:

- `src/features/finance/actions/index.ts`
- `src/features/finance/queries/index.ts`
- `src/features/finance/queries/filters.ts`

What happens on finance action:

- Validate payload
- Confirm user is finance team member
- Enforce notes length rules
- Check available actions from RPC
- Call `submit_finance_action_atomic`
- Bulk path calls `bulk_finance_actions_atomic`

### Admin Backend

Main files:

- `src/features/admin/actions/index.ts`
- `src/features/admin/queries/index.ts`

Admin capabilities:

- Rollback claim via `admin_rollback_claim_atomic`
- Reassign approvers via `admin_reassign_employee_approvers_atomic`
- Toggle or update config tables (designations, work locations, vehicles, rates)

### API Routes

Config endpoints:

- `src/app/api/config/claim-statuses/route.ts`
- `src/app/api/config/designations/route.ts`
- `src/app/api/config/states/route.ts`
- `src/app/api/config/vehicle-types/route.ts`
- `src/app/api/config/work-locations/route.ts`

Export endpoints:

- `src/app/(app)/claims/export/route.ts`
- `src/app/(app)/approvals/export/route.ts`
- `src/app/(app)/finance/export/route.ts`

These support both GET and POST and return CSV.

### Example Request Flow (Simple)

Use case: approval click.

1. User clicks approve button in `approval-actions.tsx`.
2. Client calls server action `submitApprovalAction`.
3. Action checks user and notes limits.
4. Action calls `get_claim_available_actions` RPC for permissioned actions.
5. Action calls `submit_approval_action_atomic` RPC.
6. RPC updates claim status and inserts approval history atomically.
7. Server action revalidates pages.
8. UI shows updated queue/history.

---

## 6. Database (Supabase)

## Important Note

This codebase has historical migrations and refactors.

Some old tables and patterns still exist in migration history.

Current runtime code primarily uses ID-based tables and role flags.

### Core Business Tables Used by Runtime

#### `employees`

Purpose:

- Master profile for each internal user

Important fields:

- `id`
- `employee_id`
- `employee_name`
- `employee_email`
- `designation_id`
- `employee_status_id`
- `approval_employee_id_level_1`
- `approval_employee_id_level_2`
- `approval_employee_id_level_3`

#### `employee_roles`

Purpose:

- Many-to-many mapping between employee and roles

#### `roles`

Purpose:

- RBAC role catalog

Important flags:

- `is_finance_role`
- `is_admin_role`

#### `designations`

Purpose:

- Job designation catalog (SRO, BOA, ABH, SBH, ZBH, PM, FIN, ADM)

#### `states`, `cities`, `employee_states`

Purpose:

- Geography and employee-state mapping

#### `employee_statuses`

Purpose:

- Employee status lookup

#### `expense_claims`

Purpose:

- Main claim header table

Important fields:

- `claim_number`
- `employee_id`
- `claim_date`
- `work_location_id`
- `vehicle_type_id`
- `outstation_state_id`
- `outstation_city_id`
- `from_city_id`
- `to_city_id`
- `km_travelled`
- `status_id`
- `current_approval_level`
- `allow_resubmit`
- `is_superseded`
- `total_amount`

#### `expense_claim_items`

Purpose:

- Line items under each claim

#### `approval_history`

Purpose:

- Immutable action history across approval and finance transitions

#### `finance_actions`

Purpose:

- Finance action log for finance team operations

#### `claim_statuses`

Purpose:

- Workflow status catalog

Key behavior fields:

- `approval_level`
- `is_rejection`
- `is_terminal`
- `is_payment_issued`
- `requires_comment`
- `display_color`

#### `claim_status_transitions`

Purpose:

- Transition graph for which action can move from status A to status B

Used for:

- Available actions resolution
- Approval/finance transition execution

#### `designation_approval_flow`

Purpose:

- Which approval levels apply for each designation

#### `approval_routing`

Purpose:

- Data-driven routing config by designation/state/level/role

#### `work_locations`

Purpose:

- Work location catalog and behavior flags

Flags used in form logic:

- `requires_vehicle_selection`
- `requires_outstation_details`
- `allows_expenses`

#### `vehicle_types`

Purpose:

- Vehicle catalog and rate/limit values

Fields used heavily:

- `base_fuel_rate_per_day`
- `intercity_rate_per_km`
- `max_km_round_trip`

#### `designation_vehicle_permissions`

Purpose:

- Which designations can use which vehicle types

#### `expense_rates`

Purpose:

- Amount config for food/accommodation and other expense types

#### `validation_rules`

Purpose:

- DB-backed validation parameters

#### `system_settings`

Purpose:

- App-wide settings (including max notes length)

#### `allowed_email_domains`

Purpose:

- Corporate domain whitelist used in auth gate

### Legacy or Transitional Tables in Migration History

You will see these in migration evolution:

- `expense_reimbursement_rates`
- `claim_approvals`
- `claim_expenses`
- `claim_status_catalog`
- `claim_transition_graph`
- `claim_status_audit`

Some are archived or not used by current runtime paths.

### Relationships (Beginner View)

- Employee owns many claims (`employees.id` -> `expense_claims.employee_id`)
- Claim has many items (`expense_claims.id` -> `expense_claim_items.claim_id`)
- Claim has many history rows (`expense_claims.id` -> `approval_history.claim_id`)
- Claim has many finance actions (`expense_claims.id` -> `finance_actions.claim_id`)
- Claim status is lookup (`expense_claims.status_id` -> `claim_statuses.id`)
- Employee role junction (`employee_roles.employee_id` and `employee_roles.role_id`)
- Work location lookup (`expense_claims.work_location_id` -> `work_locations.id`)
- Vehicle lookup (`expense_claims.vehicle_type_id` -> `vehicle_types.id`)

### RLS (Row Level Security)

RLS is enabled widely and is critical.

Policies evolved over many migrations.

General intent:

- Owners can access own claim data
- Assigned approvers can access actionable claim data
- Finance role can access finance stage data
- Admin has broader control via role and RPC paths

### Why DB-Driven Workflow Matters

Instead of hardcoding every action in app code:

- statuses are in `claim_statuses`
- transitions are in `claim_status_transitions`
- available actions are derived in SQL function

This makes workflow safer to evolve with migrations.

---

## 7. Authentication (Microsoft via Supabase)

### Key Files

- `src/features/auth/actions/index.ts`
- `src/app/auth/callback/route.ts`
- `src/lib/auth/auth-helpers.ts`
- `src/lib/auth/allowed-email-domains.ts`
- `src/lib/session/server-session.ts`
- `middleware.ts`

### Login Flow (Step by Step)

1. User opens login page.
2. User clicks Microsoft button.
3. `signInWithMicrosoftAction` starts OAuth with Supabase.
4. User authenticates in Microsoft.
5. Microsoft redirects to Supabase callback.
6. Supabase redirects to app callback: `/auth/callback`.
7. `src/app/auth/callback/route.ts` exchanges code for session.
8. System checks user email domain against DB whitelist.
9. If valid, redirect to dashboard.
10. If invalid, sign out and redirect to login with error.

### Session Handling

- Session is read server-side via Supabase server client
- Middleware refreshes auth session on protected routes
- Stale refresh tokens are handled by clearing auth cookies

### Route Access Rules

Protected routes include:

- `/dashboard`
- `/claims`
- `/approvals`
- `/finance`
- `/admin`

Public auth route:

- `/login`

Behavior:

- No session or invalid domain on protected route -> redirect login
- Valid session hitting login page -> redirect dashboard

### Dev Password Login

Email/password login exists but is env-gated.

- Enabled by default in non-production
- Production requires `ALLOW_PASSWORD_LOGIN_IN_PROD=true` or `1`

---

## 8. Approval Mechanism (Very Important)

### Business Meaning

Approval mechanism is the heart of this system.

It controls how a claim moves from submission to payment or rejection.

### Main Components Involved

Code files:

- `src/features/claims/actions/index.ts`
- `src/features/approvals/actions/index.ts`
- `src/features/finance/actions/index.ts`
- `src/features/claims/queries/index.ts`

Database objects:

- `expense_claims`
- `claim_statuses`
- `claim_status_transitions`
- `approval_history`
- `finance_actions`
- RPCs `submit_approval_action_atomic`
- RPCs `submit_finance_action_atomic`
- RPC `get_claim_available_actions`

### How Available Actions Are Determined

Frontend does not hardcode button logic alone.

System calls `get_claim_available_actions` with claim id.

That function checks:

- Current claim status
- Current user role and actor scope
- Transition table entries from current status

It returns action list like:

- `approved`
- `rejected`
- `issued`
- and metadata like comment requirement or allow-resubmit support

### Approval Action Flow

When approver submits action:

1. Validate payload
2. Check available actions includes requested action
3. Call RPC `submit_approval_action_atomic`
4. RPC validates approver assignment against owner routing columns
5. RPC resolves transition from DB
6. RPC updates `expense_claims` status atomically
7. RPC inserts into `approval_history`
8. Response returns updated status code and level

### Finance Action Flow

When finance submits action:

1. Validate payload
2. Ensure user has finance role
3. Check action is available
4. Call RPC `submit_finance_action_atomic`
5. RPC resolves transition and updates claim
6. Inserts into `finance_actions`
7. Inserts into `approval_history` too

### Status Lifecycle

Exact status names evolve over migrations, but practical lifecycle is:

- Pending approval levels (L1/L2)
- Finance review
- Payment issued (final approved)
- Rejected (terminal rejection path)

State is tracked by:

- `expense_claims.status_id`
- `expense_claims.current_approval_level`

### Role-Based Logic

Practical role groups:

- Employee: creates claims
- Approver: acts at pending approval levels
- Finance: handles finance review/issue/reject
- Admin: operational overrides and config changes

### Why This Is Strong Design

- DB transition rules are central source of truth
- Actions are validated before execution
- Transition writes are atomic
- Full history is captured for audit

---

## 9. End-to-End Flow (Employee to Manager Approval)

Use case:

Employee logs in -> creates claim -> submits -> manager approves.

### Step A: Employee Login

Files involved:

- `src/app/login/page.tsx`
- `src/features/auth/actions/index.ts`
- `src/app/auth/callback/route.ts`

DB involved:

- Supabase Auth session
- `allowed_email_domains`

### Step B: Open New Claim Form

Files involved:

- `src/app/(app)/claims/new/page.tsx`
- `src/features/claims/components/claim-submission-form.tsx`
- `src/features/claims/components/use-claim-submission-form.ts`

DB reads:

- work locations
- vehicle types allowed by designation
- states/cities
- expense rates

### Step C: Submit Claim

Files involved:

- `src/features/claims/actions/index.ts`
- `src/features/claims/mutations/index.ts`

DB writes:

- insert into `expense_claims`
- insert into `expense_claim_items`

Workflow initialization:

- status resolved from `designation_approval_flow` + `claim_statuses`

### Step D: Manager Opens Approvals Page

Files involved:

- `src/app/(app)/approvals/page.tsx`
- `src/features/approvals/queries/index.ts`

DB reads:

- pending claims assigned to manager level
- available actions for each claim

### Step E: Manager Approves

Files involved:

- `src/features/approvals/components/approval-actions.tsx`
- `src/features/approvals/actions/index.ts`

DB updates via RPC:

- `submit_approval_action_atomic`

DB results:

- claim status moves forward
- new row in `approval_history`

### APIs/RPCs Used in this Flow

- server actions (Next.js)
- `get_claim_available_actions` RPC
- `submit_approval_action_atomic` RPC

---

## 10. Data Flow (UI -> Backend -> DB -> UI)

### Generic Pattern

1. UI page loads in server component.
2. Server component fetches data via query/service.
3. UI displays list/form.
4. User triggers action.
5. Client component calls server action.
6. Server action validates with zod.
7. Server action checks auth and role.
8. Server action runs DB write or RPC.
9. Server action revalidates pages.
10. UI reload reflects new state.

### Claims Example

UI:

- `claim-submission-form.tsx`

Backend action:

- `submitClaimAction` in `features/claims/actions/index.ts`

DB path:

- `expense_claims`
- `expense_claim_items`

Return path:

- success with claim number
- redirect to claims list

### Approvals Example

UI:

- `approval-actions.tsx`

Backend action:

- `submitApprovalAction`

DB path:

- action availability RPC
- atomic transition RPC
- history insertion

Return path:

- toast success
- route back to approvals

### Finance Example

UI:

- `finance-actions.tsx`

Backend action:

- `submitFinanceAction`

DB path:

- finance atomic transition RPC
- finance action log

Return path:

- queue/history refresh with new state

---

## 11. Key Code Walkthrough

### A. Auth Code Walkthrough

File:

- `middleware.ts`

Core behavior:

- Defines protected routes list
- Calls `refreshAuthSession`
- Validates corporate email domain
- Redirects unauthorized users

File:

- `src/app/auth/callback/route.ts`

Core behavior:

- Exchanges OAuth code for session
- Validates domain
- Redirects to safe next path

### B. Claim Submission Walkthrough

File:

- `src/features/claims/actions/index.ts`

Important highlights:

- Uses zod schema `claimSubmissionSchema`
- Checks duplicate claim for same date
- Reads work-location behavior flags from DB
- Validates outstation city-state consistency
- Computes claim amount through `calculation-service`
- Uses `resolveInitialWorkflowState` to choose starting status

### C. Approval Logic Walkthrough

Files:

- `src/features/approvals/actions/index.ts`
- migration `20260318123000_make_workflow_action_resolution_db_driven.sql`

Important highlights:

- Available actions are not assumed; fetched from RPC
- RPC enforces correct approver assignment by level
- Transition selection is role-aware and transition-table driven
- Writes both claim state and history atomically

### D. Finance Logic Walkthrough

Files:

- `src/features/finance/actions/index.ts`
- migration `20260318123030_make_finance_actions_transition_driven.sql`

Important highlights:

- Finance role check is mandatory
- Transition resolution is DB-driven
- `finance_issued` normalization to external `issued` action is handled
- Inserts both `finance_actions` and `approval_history`

### E. Cursor Pagination Walkthrough

File:

- `src/lib/utils/pagination.ts`

Important highlights:

- Uses encoded cursor payload: `created_at + id`
- Supports trail for back navigation
- Implemented across claims/approvals/finance pages

This is more stable than offset pagination for changing datasets.

---

## 12. Mental Model (Simple Analogy)

Imagine a physical office where every expense claim is a paper file.

People involved:

- Employee creates the file.
- Manager stamps approve or reject.
- Higher approver confirms.
- Finance stamps payment issued.
- Admin can intervene only for operational correction.

Rules book:

- Status and transition tables are the office rulebook.
- RPC functions are strict clerks who enforce the rulebook.
- History tables are the audit register.

User interface:

- Dashboard is front desk.
- Claims page is filing desk.
- Approvals page is manager desk.
- Finance page is payment desk.
- Admin page is operations control room.

This analogy helps you reason about data correctness and workflow constraints.

---

## 13. How to Extend the System

### If You Add a New Feature

Follow this order:

1. Decide feature domain (`claims`, `approvals`, `finance`, etc.)
2. Add/extend types in feature `types/`
3. Add validation in feature `validations/`
4. Add query/action functions
5. Add page/component UI
6. Add migration if schema or workflow changes
7. Add unit + e2e tests

### Where to Add What

If you need a new read query:

- add inside `src/features/<feature>/queries/`

If you need write operation:

- add inside `src/features/<feature>/actions/`

If operation is complex and transactional:

- prefer a Supabase RPC migration

If you need role checks:

- use role-based helpers from permissions/services

If you need date or pagination behavior:

- reuse `src/lib/utils/date.ts`
- reuse `src/lib/utils/pagination.ts`

### If You Add a New Claim Status

Checklist:

1. Add status row in migration (`claim_statuses`)
2. Add transitions (`claim_status_transitions`)
3. Validate action availability still correct
4. Confirm approvals and finance filters still map correctly
5. Update tests for status visibility and flow

### If You Add a New Approval Step

Checklist:

1. Update `designation_approval_flow`
2. Update `approval_routing`
3. Add transition rows for new step
4. Update RPC logic only if needed
5. Add e2e workflow path tests

### If You Add New Form Fields

Checklist:

1. Add field in feature type
2. Add zod validation
3. Add DB column via migration if needed
4. Handle optional/empty value normalization
5. Ensure payload and insert/query mapping are aligned

### Extension Safety Rules

- Do not bypass server actions with client-side DB writes
- Do not hardcode role strings if role flags exist in DB
- Do not hardcode status assumptions when transition table can be used
- Keep date formatting consistent (`DD/MM/YYYY` display)
- Keep cursor-based pagination for list views

---

## Appendix A: Key Files by Responsibility

### Authentication

- `middleware.ts`
- `src/app/auth/callback/route.ts`
- `src/features/auth/actions/index.ts`
- `src/lib/session/server-session.ts`
- `src/lib/auth/allowed-email-domains.ts`

### Claims

- `src/app/(app)/claims/page.tsx`
- `src/app/(app)/claims/new/page.tsx`
- `src/features/claims/actions/index.ts`
- `src/features/claims/mutations/index.ts`
- `src/features/claims/queries/index.ts`

### Approvals

- `src/app/(app)/approvals/page.tsx`
- `src/features/approvals/actions/index.ts`
- `src/features/approvals/queries/index.ts`
- `src/features/approvals/queries/history-filters.ts`

### Finance

- `src/app/(app)/finance/page.tsx`
- `src/features/finance/actions/index.ts`
- `src/features/finance/queries/index.ts`
- `src/features/finance/queries/filters.ts`

### Admin

- `src/app/(app)/admin/page.tsx`
- `src/features/admin/actions/index.ts`
- `src/features/admin/queries/index.ts`

### Shared Infra

- `src/lib/supabase/server.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/services/employee-service.ts`
- `src/lib/services/config-service.ts`
- `src/lib/services/calculation-service.ts`
- `src/lib/utils/pagination.ts`
- `src/lib/utils/date.ts`

### Database

- `supabase/migrations/002_create_tables.sql`
- `supabase/migrations/100_*.sql` to `119_*.sql`
- `supabase/migrations/138_role_consolidation.sql`
- `supabase/migrations/152_add_role_type_flags.sql`
- `supabase/migrations/20260318123000_make_workflow_action_resolution_db_driven.sql`
- `supabase/migrations/20260318123030_make_finance_actions_transition_driven.sql`
- `supabase/migrations/20260318123130_make_claim_available_actions_transition_driven.sql`

---

## Appendix B: Sample Code Snippets

### 1) Home Redirect Logic

From `src/app/page.tsx`:

```tsx
export default async function Home() {
  const user = await getCurrentUser()
  redirect(user ? '/dashboard' : '/login')
}
```

Meaning:

- If user already authenticated, go dashboard.
- Else go login.

### 2) Approval Action RPC Call

From `src/features/approvals/actions/index.ts`:

```ts
const { error: approvalError } = await supabase.rpc(
  'submit_approval_action_atomic',
  {
    p_claim_id: claimWithOwner.claim.id,
    p_action: parsed.data.action,
    p_notes: parsed.data.notes ?? null,
    p_allow_resubmit: Boolean(parsed.data.allowResubmit),
  }
)
```

Meaning:

- All critical transition rules are executed in DB function.

### 3) Finance Action RPC Call

From `src/features/finance/actions/index.ts`:

```ts
const { error } = await supabase.rpc('submit_finance_action_atomic', {
  p_claim_id: parsed.data.claimId,
  p_action: parsed.data.action,
  p_notes: parsed.data.notes ?? null,
  p_allow_resubmit: Boolean(parsed.data.allowResubmit),
})
```

Meaning:

- Finance transition also handled atomically in DB.

### 4) Cursor Pagination Query Pattern

From `src/features/claims/queries/index.ts`:

```ts
query = query.or(
  `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
)
```

Meaning:

- Fetch next page after a stable cursor point.

### 5) Domain Gating in Callback

From `src/app/auth/callback/route.ts`:

```ts
if (!(await isAllowedCorporateEmail(supabase, user?.email))) {
  await supabase.auth.signOut()
  return NextResponse.redirect(
    new URL('/login?error=email_domain_not_allowed', requestUrl.origin)
  )
}
```

Meaning:

- Even with valid OAuth, only allowed company domains can continue.

---

## Appendix C: Testing Strategy in This Project

### Unit Tests

Primary focus:

- validations
- utils
- permissions
- action branch behavior

Configured by `vitest.config.ts`.

### End-to-End Tests

Located in `e2e/`.

Coverage includes:

- smoke login
- approval workflow chain
- rejection paths
- authorization behavior
- role/designation rules

Example:

- `e2e/approval-workflow.spec.ts` executes full SRO -> SBH -> PM -> Finance issue path.

### Why This Matters

Because this is a finance internal tool, testing verifies:

- data integrity behavior
- workflow transition correctness
- role boundary correctness

---

## Final Summary

NxtExpense is a role-aware, workflow-driven internal finance platform where:

- Next.js provides UI + server action orchestration
- Supabase provides auth, DB, and policy enforcement
- Workflow state transitions are controlled by DB tables and RPCs
- Claims lifecycle is auditable through history tables

If you remember only one thing:

The database workflow configuration (`claim_statuses` + `claim_status_transitions`) and atomic RPCs are the core engine of the system.

Everything else (pages, forms, filters, exports) is built around that engine.
