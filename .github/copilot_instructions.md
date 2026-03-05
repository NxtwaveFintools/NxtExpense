# 🚨 NxtExpense — Universal Development Guidelines (NON-NEGOTIABLE)

These are **mandatory engineering standards** for this repository.  
**Violation of any rule is considered a bug.**

This project prioritizes **correctness, scalability, maintainability, and long-term velocity** over short-term speed.

---

## 🔒 Locked Technology Stack (NO EXCEPTIONS)

This project uses **ONLY**:

**Fullstack Framework:**

- **Next.js** (App Router — server components, server actions, API routes)

**Database & Backend Services:**

- **Supabase** (PostgreSQL database, Row Level Security, Storage, Realtime)
- **Supabase Auth** (integrated with Microsoft Identity — primary authentication)

**Frontend:**

- **React** (via Next.js — no separate React setup)
- **Tailwind CSS** (styling only)
- **shadcn/ui** (component library built on Tailwind — if adopted)

**Authentication:**

- **Microsoft OAuth via Supabase Auth** (production)
- **Supabase Email/Password Auth** (development only)

❌ Do NOT introduce:

- Separate Express or NestJS API servers
- MongoDB, Firebase, Prisma, or any alternative database/ORM
- Alternative auth providers (Auth0, Clerk, NextAuth, etc.)
- Alternative styling systems (MUI, Chakra, Bootstrap, etc.)
- Alternative build tools (CRA, Parcel, Remix, etc.)
- Raw SQL outside of Supabase client or RPC calls

Any deviation must be **explicitly rejected**.

---

## 🧠 MCP SERVER USAGE — MANDATORY & ENFORCED

**CRITICAL RULE:**  
👉 **MCP servers MUST be used for EVERY feature, bug fix, refactor, or investigation.**

No assumptions.  
No blind coding.  
No "it should work".

---

### ✅ Required MCP Servers

---

#### 🗄️ Supabase MCP

You MUST use Supabase MCP to:

- **Inspect tables** before writing any data logic
- **Validate column types**, constraints, and nullable fields
- **Read Row Level Security policies** before touching protected data
- **Check existing indexes** for query optimization
- **Inspect foreign key relationships** before designing joins
- **Review existing migrations** before adding new schema changes
- **Verify enum types and check constraints** before inserting data
- **Understand existing data** before assuming structure

You MUST:

- Query actual table structure before writing any Supabase client code
- Verify RLS policies are in place before assuming data access
- Check existing policies before adding new ones to avoid conflicts
- Inspect migration history before creating new migrations
- Validate data after inserts, updates, or migrations

❌ Writing database queries without inspecting actual schema is **NOT allowed**.  
❌ Assuming column names, types, or relationships without verification is **NOT allowed**.  
❌ Skipping RLS inspection before writing data access code is **NOT allowed**.

---

#### ⚡ Next.js MCP

You MUST use Next.js MCP to:

- **Inspect the app router structure** before adding new routes
- **Understand existing server components and server actions**
- **Check existing API route handlers** before creating new ones
- **Review middleware** before modifying authentication flows
- **Inspect layout boundaries** before adding new pages
- **Understand data-fetching patterns** already in use
- **Verify environment variable usage** across the codebase

You MUST:

- Understand current routing before adding or modifying pages
- Check existing server actions before creating duplicate logic
- Analyze how authentication is currently handled before changing it

❌ Adding routes without understanding the existing route structure is **NOT allowed**.  
❌ Creating server actions that duplicate existing ones is **NOT allowed**.

---

#### 📁 Filesystem MCP

You MUST use Filesystem MCP to:

- **Inspect folder structure** before adding new files or modules
- **Understand module boundaries** before importing across features
- **Locate shared utilities** before writing new ones
- **Verify dependency direction** is not violated
- **Inspect configuration files** before making environment changes
- **Understand feature organization** before extending a feature

You MUST:

- Always scan the relevant folder before creating new files
- Verify no duplicate logic already exists before implementing
- Understand where feature-specific vs shared code lives

❌ Creating files without understanding where they should go is **NOT allowed**.  
❌ Assuming a utility doesn't exist without checking is **NOT allowed**.

---

### ❗ MCP Enforcement Rule

> **If MCP was not used, the change is invalid.**

Applies to:

- Features
- Bug fixes
- Refactors
- Performance work
- Security changes
- Schema changes
- New routes or pages

---

## 🧱 Code Quality (ZERO TOLERANCE)

### DRY

- No duplication anywhere in the codebase
- Shared logic must be centralized in designated shared modules
- Copy-paste with minor edits is a **violation**

### SOLID

- Single Responsibility is mandatory for every component, action, and utility
- No god components
- No god server actions that handle multiple unrelated concerns

### Clean Code

- Meaningful, domain-accurate names only
- Small, readable, single-purpose functions
- Obvious intent > clever code
- No unexplained magic values

---

## ♻️ Reusability (STRICT)

Logic MUST be reused, not duplicated.  
If logic is used more than once, it MUST be extracted.

### What MUST be reusable

- Business rule enforcement (designation limits, expense caps, vehicle eligibility)
- Supabase data access logic (queries, mutations, RPC calls)
- Permission and role checks
- Validation logic (date ranges, amount limits, vehicle rules)
- Shared UI patterns (tables, forms, approval status badges)

### What MUST NOT be reused prematurely

- Feature-specific UI state
- Feature-internal helpers that have no reuse case
- Temporary glue code

### Reuse Hierarchy (MANDATORY)

1. Feature-local reuse first
2. Shared module reuse second
3. Global utility reuse as last resort only

Premature global abstractions are **forbidden**.

---

## 🧩 Modularity & Module Boundaries (ENFORCED)

Each feature is a **self-contained module**.

### Allowed Dependency Direction

```
UI Components → Server Actions → Supabase Client → Database
```

Reverse dependencies are **NOT allowed**.

### Forbidden

- UI components calling Supabase directly (use server actions or server components)
- Validation logic inside UI components
- Cross-feature internal imports
- Feature logic leaking into shared utilities
- Circular dependencies of any kind

Violations are **architectural bugs**.

---

## 🔐 Public vs Private Feature APIs

Each feature MUST define a clear public surface.

- Only explicitly exported files and functions are public
- Internal helpers are private by default
- No deep imports into feature internals from other features

Breaking module boundaries is **NOT allowed**.

---

## 🗂️ File & Folder Structure (MANDATORY)

- **Feature-based structure ONLY**
- No type-based dumping (`utils.ts`, `helpers.ts` as garbage bins)
- Each feature module owns:
  - `components/` — UI components for this feature
  - `actions/` — Next.js server actions
  - `queries/` — Supabase read queries
  - `mutations/` — Supabase write operations
  - `validations/` — Input validation schemas (Zod)
  - `types/` — TypeScript types for this feature
  - `permissions/` — Authorization checks for this feature
- Shared logic lives in:
  - `/lib/supabase/` — Supabase client instances
  - `/lib/utils/` — Stateless, generic utilities only
  - `/lib/validations/` — Shared Zod schemas
  - `/components/ui/` — Shared UI components

❌ Cross-feature internal imports are **forbidden** unless explicitly placed in `/lib`.

---

## 🧰 Shared Utilities Discipline (STRICT)

High-risk folders:

- `/lib/utils/`
- `/lib/validations/`
- `/components/ui/`

Rules:

- No dumping-ground utilities
- Every shared function must have a clear, justified reuse case
- Feature-specific logic is **forbidden** in shared folders
- Stateless, generic utilities only in `/lib/utils/`

"Shared because convenient" is **NOT acceptable**.

---

## 🧾 Enums & Constants (STRICT)

- Work location types, expense categories, designation levels, approval statuses, vehicle types MUST be enums or constant maps
- ❌ No magic strings anywhere
- ❌ No hardcoded policy values (allowance amounts, distance limits, etc.)
- Single source of truth for all domain values
- All configurable values MUST be stored in the database — not in code

If a value can change with policy → **it must come from the database**.  
If a value is a fixed domain concept → **it must be a typed enum in code**.

---

## 🧮 Data Fetching & Filtering (HARD RULES)

🚫 **NO in-memory filtering — EVER**

All filtering MUST:

- Happen at the database level via Supabase query filters
- Use validated and sanitized inputs
- Leverage existing RLS policies where applicable

You MUST:

- Use `.select()` to fetch only required columns
- Apply `.eq()`, `.in()`, `.gte()`, `.lte()` and other Supabase filters at query time
- Use Supabase RPCs for complex multi-table aggregation logic
- Add database indexes where range or lookup queries are frequent

Fetching full tables and filtering in JavaScript is a **performance bug**.

---

## 📄 Pagination (NON-OPTIONAL)

- Pagination is **REQUIRED** for all list views (expenses, employees, approvals)
- Use Supabase's `.range()` for offset-based pagination
- Metadata MUST be returned:
  - `page` / `offset`
  - `limit`
  - `total` (via Supabase `count` option)

❌ Missing pagination on any list = ❌ invalid implementation

---

## 🔐 Security (NO SHORTCUTS)

- **Microsoft OAuth via Supabase Auth** is the only production authentication method
- **Row Level Security (RLS) is MANDATORY** on every table that holds user data
- Never bypass RLS using the service role key in client-accessible code
- Server actions MUST verify the authenticated session before any data operation
- All user inputs MUST be validated with Zod before processing
- Authorization checks MUST be server-side — never trust client-side role claims
- Use Supabase's `auth.uid()` in RLS policies, never trust client-sent user IDs
- Designation-based permissions MUST be enforced at the server action layer

Security bugs are **P0** issues.  
An RLS gap is a **critical security vulnerability**.

---

## ✅ Approval Workflow Rules (ENFORCED)

- Approval routing MUST be derived from the employee's designation, not hardcoded
- All approval state transitions MUST be validated server-side
- Approval history MUST be preserved — records must never be deleted, only transitioned
- Multi-level approval chains MUST be supported
- Approvers can be reassigned — the system must handle this gracefully
- Every approval action MUST be timestamped and attributed to the acting employee

❌ Hardcoding approval chains is **NOT allowed**.  
❌ Client-side approval state mutation is **NOT allowed**.

---

## 📅 Date & Claim Rules (ENFORCED)

- Employees submit claims for a **date range** (start date → end date)
- Each day in the range MUST be stored as an **individual database record**
- Future dates MUST be rejected at the server action layer
- Maximum allowed range length MUST be enforced
- Duplicate claims for the same employee on the same date MUST be rejected
- Taxi and fuel reimbursement for the same day are **mutually exclusive**

---

## 🚗 Vehicle & Distance Rules (ENFORCED)

- Vehicle eligibility is designation-based and MUST be read from the database
- Distance limits per vehicle type MUST be validated server-side
- If an employee uses their own vehicle, distance-based reimbursement applies
- If an employee does not use their own vehicle, only taxi/transport bills apply
- Travel cities MUST be recorded for outstation travel

❌ Reimbursement calculations without designation and vehicle validation are **invalid**.

---

## 🧪 Testing (ENFORCED)

- Unit test coverage **> 80%** for all business logic
- Mandatory coverage for:
  - Designation-based business rules
  - Reimbursement calculations
  - Permission and authorization checks
  - Approval state transitions
  - Date range and claim validations
- Critical paths (claim submission, approval flow) REQUIRE integration tests
- PRs without tests are **invalid** unless explicitly justified

"Will add tests later" is **not acceptable**.

---

## ⚠️ Edge Case Discipline (MANDATORY)

Every implementation MUST handle:

- Empty states (no expenses, no employees, no approvals)
- Large datasets (thousands of employees, years of claim history)
- Permission-denied flows (unauthorized access gracefully rejected)
- Partial failures (one day in a range failing validation)
- Concurrent approval actions (optimistic lock or conflict detection)
- Invalid or malicious input (injected values, out-of-range amounts)
- Policy edge cases (zero-distance travel, same-day taxi + fuel attempt)

Happy-path-only code is **not acceptable**.

---

## 🚀 Scalability & Performance

- Add database indexes before queries reach scale
- Avoid N+1 queries — use Supabase joins or RPCs
- Fetch only necessary columns via `.select()`
- Paginate all list queries — no unbounded fetches
- Prefer server components for read-heavy pages
- Measure query performance before assuming it's fast

---

## 🔄 DevOps & Process

- Git Flow is mandatory
- Conventional commits only (`feat:`, `fix:`, `chore:`, `refactor:`)
- PR reviews are required before merging
- ESLint + Prettier enforced — no warnings allowed in CI
- No direct pushes to `main` or `develop`
- Environment variables MUST be documented in `.env.example`

---

## ♿ Accessibility

- Semantic HTML everywhere
- Keyboard navigation must work for all interactive flows
- Sufficient color contrast (WCAG AA minimum)
- Form inputs must have associated labels
- Error messages must be screen-reader accessible

---

## 🛑 FINAL RULE

> **If something is unclear, you MUST inspect using MCP — never assume.**

This repository values:

- **correctness** over speed
- **structure** over shortcuts
- **long-term maintainability** over hacks
- **explicit business rules** over clever abstractions

---

### 🧠 Bottom Line

This document is **law**.  
If the code disagrees with this file, **the code is wrong**.
