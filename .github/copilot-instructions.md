# 🚨 NxtExpense — Universal Development Guidelines (NON-NEGOTIABLE)

These are **mandatory engineering standards** for this repository.  
**Violation of any rule is considered a bug.**

This project prioritizes **correctness, scalability, maintainability, and long-term velocity** over short-term speed.

---

## 🏦 Product Context (READ FIRST)

**NxtExpense is a Finance Internal Tool.**

- It is used exclusively by internal finance, HR, and management teams — NOT end consumers
- Every feature must reflect the precision, audit compliance, and accountability expected in a financial system
- Data integrity is non-negotiable: every record must be traceable, timestamped, and attributed
- Financial figures, approval chains, and claim records must be treated with the same rigor as accounting ledgers
- UI/UX must be optimized for finance workflows: clear tables, exportable data, accurate date/amount display
- Always assume the user of this system is accountable for money — treat all data accordingly

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

### ⚙️ MCP Server Configuration (USE EXACTLY AS DEFINED)

The following MCP servers are configured for this project. Use them as the **primary source of truth** for all actions:

```json
{
  "servers": {
    "File System": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=acbgmixcdtfgurgbkqgh"
    },
    "Nextjs": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"]
    },
    "Playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@playwright/mcp"]
    },
    "Git": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    },
    "memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "Everything": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"]
    }
  },
  "inputs": []
}
```

**Each server has a designated role:**

| Server        | Role                                                 |
| ------------- | ---------------------------------------------------- |
| `File System` | Inspect folder/file structure before any code change |
| `supabase`    | Inspect schema, RLS, indexes, migrations, data       |
| `Nextjs`      | Inspect routes, server actions, middleware, layouts  |
| `Playwright`  | Browser automation, E2E test validation              |
| `Git`         | Branch management, PRs, commit history               |
| `memory`      | Persistent session context, cross-step reasoning     |
| `Everything`  | Full-text and semantic workspace search              |

❌ Skipping MCP calls and writing code from memory is **NOT allowed**.

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

#### 🎭 Playwright MCP

You MUST use Playwright MCP to:

- **Validate UI flows** after implementing new features
- **Test approval workflows** end-to-end
- **Verify form validation** behaves correctly in the browser
- **Confirm date formatting** renders correctly in the UI

---

#### 🐙 Git MCP

You MUST use Git MCP to:

- **Check existing branches** before creating new ones
- **Review PR status** before merging
- **Validate commit history** on feature branches

---

#### 🧠 Memory MCP

You MUST use Memory MCP to:

- **Persist investigation context** across multi-step tasks
- **Store schema findings** discovered via Supabase MCP for reuse within the session
- **Track in-progress decisions** to avoid re-investigation

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

## 🏗️ Production-Grade Engineering Standards (NON-NEGOTIABLE)

Every piece of code in this repository MUST be written as **production-grade** from day one.

### What Production-Grade Means Here

- **Reusable** — Logic written once, referenced everywhere it's needed. No duplication.
- **Scalable** — Handles growth in data volume, users, and features without rewrites.
- **Re-architecturable** — Code is organized so any layer can be swapped or extended independently.
- **Modifiable** — Changing one thing does not cascade breaks across unrelated features.
- **Independent** — Feature modules are self-contained. They do not reach into each other's internals.
- **Integrity-preserving** — Every operation that touches financial data must leave the system in a consistent, auditable state.

### ❗ File Size Limit (HARD RULE)

**Every file MUST be 200–300 lines maximum.**

- If a file exceeds 300 lines, it MUST be split before a PR can be approved
- Splitting must follow logical boundaries (one responsibility per file)
- Never split arbitrarily — split along domain or responsibility seams
- Large files are an indicator of a Single Responsibility violation

Applies to:

- React components (split into sub-components)
- Server actions (split by domain operation)
- Query files (split by entity or query type)
- Validation schemas (split by feature domain)
- Type definition files (split by domain boundary)

❌ "It's only a few lines over" is **NOT an acceptable justification**.

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

## 📄 Pagination (NON-OPTIONAL — CURSOR-BASED ONLY)

- Pagination is **REQUIRED** for all list views (expenses, employees, approvals)
- **ONLY cursor-based pagination is allowed** — offset-based pagination is **FORBIDDEN**
- Offset pagination degrades at scale and produces inconsistent results on real-time financial data

### Cursor Pagination Rules

- Use a stable, sortable cursor field — prefer `created_at` + `id` composite cursor
- The cursor MUST be opaque to the client (base64-encoded or similar)
- Every paginated query MUST accept: `cursor` (nullable), `limit`
- Every paginated response MUST return:
  - `data` — the records for this page
  - `nextCursor` — cursor for the next page (`null` if last page)
  - `hasNextPage` — boolean
  - `limit` — echoed back for client reference

### Implementation Pattern

```typescript
// Query pattern using cursor
const query = supabase
  .from('expenses')
  .select('id, created_at, ...')
  .order('created_at', { ascending: false })
  .order('id', { ascending: false })
  .limit(limit + 1) // fetch one extra to determine hasNextPage

if (cursor) {
  // decode cursor → { created_at, id }
  query.or(
    `created_at.lt.${cursorDate},and(created_at.eq.${cursorDate},id.lt.${cursorId})`
  )
}
```

- The extra record fetched (limit + 1) determines `hasNextPage` — it is NEVER returned to the client
- Cursor encoding/decoding MUST live in `/lib/utils/pagination.ts` — not duplicated per feature
- ❌ `.range()` offset pagination is **NOT allowed** anywhere in the codebase
- ❌ `page` / `offset` / `total` patterns are **NOT allowed**

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

## 📅 Date Format & Claim Rules (ENFORCED)

### ⚠️ Date Format — MANDATORY STANDARD

**The standard date format across the ENTIRE system is `DD/MM/YYYY`.**

This applies to:

- All **database `date` columns** — store as ISO `YYYY-MM-DD` internally, but ALWAYS display as `DD/MM/YYYY`
- All **frontend displays** — every date shown to a user MUST render as `DD/MM/YYYY`
- All **form inputs** — date pickers and text inputs MUST accept and display `DD/MM/YYYY`
- All **export files** (CSV, PDF, Excel) — date columns MUST use `DD/MM/YYYY`
- All **API responses** — dates returned to the client MUST be formatted as `DD/MM/YYYY` strings (not ISO strings)
- All **filter inputs** — date range filters MUST display and accept `DD/MM/YYYY`

### Date Format Rules

- Database stores dates as `DATE` (PostgreSQL) in ISO format — this is the internal representation only
- A shared formatter `formatDate(date: Date | string): string` MUST exist in `/lib/utils/date.ts`
- This formatter is the **single source of truth** for `DD/MM/YYYY` conversion — never inline format dates
- For `TIMESTAMP` columns (e.g. `created_at`), display as `DD/MM/YYYY HH:MM` in 24-hour format
- Never display raw ISO strings (`2024-01-15`) to users — always pass through the formatter
- Date validation in Zod schemas MUST parse `DD/MM/YYYY` input and convert to ISO before DB operations

❌ Displaying `YYYY-MM-DD` or ISO timestamps directly in the UI is a **formatting bug**.  
❌ Inconsistent date formats across different screens is **NOT acceptable**.

### Claim Rules

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
- **financial data integrity** over convenience
- **modular, bounded files** over monolithic "god files"

---

## ✅ Pre-Feature Checklist (MANDATORY BEFORE WRITING ANY CODE)

Before adding **any** feature or code change, you MUST complete all of the following:

- [ ] Used **Filesystem MCP** to inspect existing folder structure and locate relevant modules
- [ ] Used **Supabase MCP** to inspect all tables, columns, RLS policies, and indexes involved
- [ ] Used **Next.js MCP** to inspect existing routes, server actions, and layouts
- [ ] Confirmed **no duplicate logic** already exists in the codebase
- [ ] Confirmed the planned files will each stay **under 300 lines**
- [ ] Confirmed date handling uses `DD/MM/YYYY` format in all display surfaces
- [ ] Confirmed pagination uses **cursor-based** approach only
- [ ] Confirmed all business rules are read from the database, not hardcoded
- [ ] Confirmed RLS policies cover all new tables or queries
- [ ] Confirmed Zod validation covers all new inputs

❌ Skipping this checklist and diving straight into code is **NOT allowed**.

---

### 🧠 Bottom Line

This document is **law**.  
If the code disagrees with this file, **the code is wrong**.

This is a **finance internal tool**. Treat every record like money — because it is.

---

## 📚 Knowledge Base — Business Rules & Reference Data

All domain knowledge for NxtExpense is stored under `.github/knowledge/`.  
**Always read these files before implementing any expense logic, approval routing, or employee-related feature.**

### Knowledge Files

| File                                   | Purpose                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `.github/knowledge/expense_rules.json` | Core business rules — date constraints, location flows, designation limits, taxi rules, approval workflow, validations |
| `.github/knowledge/employees.json`     | Employee master data — IDs, names, emails, states, designations, approval chains (levels 1–3)                          |
| `.github/knowledge/state_mapping.json` | State → State Business Head (SBH) and Zonal Business Head (ZBH) email mapping                                          |

---

### Key Rules Quick Reference

#### Work Location Options

- `Office / WFH` · `Field – Base Location` · `Field – Outstation` · `Leave` · `Week-off`

#### Field – Base Location

| Vehicle      | Food/day | Fuel/day | Total/day |
| ------------ | -------- | -------- | --------- |
| Two Wheeler  | ₹120     | ₹180     | ₹300      |
| Four Wheeler | ₹120     | ₹300     | ₹420      |

> Four Wheeler only allowed for: **State Business Head**, **Zonal Business Head**, **Program Manager**

#### Field – Outstation

| Scenario                       | Food/day | Fuel  | Total             |
| ------------------------------ | -------- | ----- | ----------------- |
| Own vehicle = No               | ₹350     | ❌    | ₹350 + taxi bills |
| Own vehicle = Yes (2W, 100 km) | ₹350     | ₹5/km | ₹850              |
| Own vehicle = Yes (4W, 100 km) | ₹350     | ₹8/km | ₹1,150            |

#### KM Limits (Own Vehicle, Outstation)

- Two Wheeler: max **150 km** round trip
- Four Wheeler: max **300 km** round trip

#### Accommodation Limits

- SRO / BOA / ABH → ₹1,000/night
- SBH / ZBH / PM → ₹2,000/night

#### Taxi Rule

- Multiple taxi bills per day: ✅ allowed
- Fuel on same day as taxi: ❌ blocked
- Only 1 fuel entry per day

#### Date Rules

- Future dates: ❌ not allowed
- Max range: **7 days**
- Storage: **1 record per day**

#### Approval Routing

| Designation     | Level 1             | Final   |
| --------------- | ------------------- | ------- |
| SRO / BOA / ABH | State Business Head | Mansoor |
| SBH / ZBH / PM  | —                   | Mansoor |

---

### Designations (Exhaustive List)

1. Student Relationship Officer
2. Business Operation Associate
3. Area Business Head
4. State Business Head
5. Zonal Business Head
6. Program Manager

---

> ❗ **Rule:** Any feature that computes expense amounts, routes approvals, or filters by designation MUST reference the knowledge files above — not hardcoded values in application code.
