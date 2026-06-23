# NxtExpense — Hardcoded Value & Configuration Audit

> **Audit type:** Principal-engineer production-readiness review — hardcoded values, embedded business rules, configuration externalization, secret exposure.
> **Date:** 2026-06-23
> **Branch audited:** `new_requirements`
> **Reviewer lens:** Configuration Discovery · Hardcoded Value Detection · Architecture Review · Risk Assessment · Refactoring Strategy (applied inline, no agents spawned).

---

## Executive Summary

**Scope scanned:** 389 TS/TSX files in `src/`, 61 SQL migrations, `middleware.ts`, Next/Vitest/Playwright config, `.env.local` (keys only), `.mcp.json`, `opencode.json`, `testusers.txt`, `.gitignore`.

**The honest headline:** This is a **well-architected, config-driven** codebase. The expensive things a generic audit hunts for — pricing rules, expense rates, approval flows, claim statuses, tax/allowance values, allowed email domains, day-type rules — are **already in Postgres lookup tables** and read through a single `config-service.ts`:

- `expense_rates`, `designation_approval_flow`, `claim_statuses`, `vehicle_types`,
  `base_location_day_types`, `allowed_email_domains`, `work_locations`, `designations`, `states`, `cities`.

Notable good patterns confirmed:

- The **summer food allowance** (₹170 / ₹400 for June 2026) is correctly modeled as **time-bounded `effective_from` / `effective_to` rows** in `expense_rates` — not a hardcoded date window in code. (`grep` for `YYYY-MM-DD` literals in `src/` returns **zero** results.)
- **Secrets are env-injected** via `getSupabasePublicEnv()` with **no hardcoded fallback credentials**; missing env throws.
- `.env.local` is **gitignored** (`.env*` rule) and **not tracked**.
- Pagination options are **already centralized** in `src/lib/utils/pagination.ts`.

So the real findings are a **smaller, sharper set**: one genuine security/PII item, a handful of **business-rule magic numbers silently coupled to the DB-driven approval flow**, and ordinary operational-tuning constants.

| Bucket                                              | Count       | Highest severity                   |
| --------------------------------------------------- | ----------- | ---------------------------------- |
| Security / secret exposure                          | 2           | **High** (`testusers.txt` tracked) |
| Business-rule coupling (magic numbers / codes)      | 4 clusters  | **Medium-High**                    |
| Operational tuning (cache TTLs, timeouts, debounce) | ~5 clusters | Low-Medium                         |
| UI constants (colors, durations, formatting)        | 3           | Low (acceptable)                   |
| Infra identifiers                                   | 1           | Low                                |

**Highest-risk areas:**

1. `testusers.txt` committed to the repo (PII + workflow topology + password references).
2. The `approval_level === 3` literal scattered across admin + finance + analytics, which assumes a fixed 3-level chain even though chain length is data-driven per designation.

---

## Configuration Discovery (Agent 1 lens)

### Configuration mechanisms in use

| Mechanism               | Location                       | Notes                                                     |
| ----------------------- | ------------------------------ | --------------------------------------------------------- |
| Environment variables   | `.env.local`, `process.env.*`  | Validated in `src/lib/supabase/env.ts`; throws if missing |
| DB lookup tables        | `config-service.ts` → Supabase | Single entry point for all reference data                 |
| Feature flag (env)      | `ALLOW_PASSWORD_LOGIN_IN_PROD` | Gate in `src/lib/auth/auth-helpers.ts:32`                 |
| Feature flag (env)      | `NEXT_PUBLIC_ENABLE_LENIS`     | UI smooth-scroll toggle                                   |
| MCP/tooling config      | `.mcp.json`, `opencode.json`   | Supabase project ref (dev tooling)                        |
| Middleware route policy | `middleware.ts`                | Hardcoded route lists (see findings)                      |

### Environment variables (keys only — values not read)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_AUTH_CALLBACK_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_ENABLE_LENIS
ALLOW_PASSWORD_LOGIN_IN_PROD
```

### Externalization status

- **Already externalized (good):** rates, allowances, approval flows, statuses, vehicle types, day types, allowed email domains, pagination options.
- **Missing externalization opportunities:** React Query cache tuning (scattered), UX timings, password policy (duplicated). All Category B/C — low urgency.

---

## Findings Table

| #   | Score | Severity | File                                                                                                                                                                              | Line                  | Hardcoded Value                                                                                                                                               | Category | Reason                                                                                                 | Recommendation                                                                                         |
| --- | ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 1   | 9     | **High** | `testusers.txt`                                                                                                                                                                   | 1–end                 | Real employee emails + password refs + approval chains                                                                                                        | A        | Tracked in git (`git ls-files` confirms); PII + workflow topology in repo                              | Remove from VCS, gitignore, relocate to fixtures/secret store; purge history if it held live passwords |
| 2   | 8     | Med-High | `src/features/admin/actions/employee-actions.ts`                                                                                                                                  | 168, 247              | `row.approval_level === 3`                                                                                                                                    | A        | "Final approval level" assumed = 3, but chain length is per-designation in `designation_approval_flow` | Derive max level from the flow / an `is_final_approval` flag on `claim_statuses`                       |
| 3   | 8     | Med-High | `src/features/finance/data/queries/analytics.query.ts`                                                                                                                            | 96                    | `status.approval_level === 3`                                                                                                                                 | A        | Same magic "final level" assumption in finance analytics                                               | Resolve from DB, not literal                                                                           |
| 4   | 7     | Medium   | `src/features/approvals/data/repositories/approvals.repository.ts`                                                                                                                | 48                    | `.in('approval_level', [1, 2])`                                                                                                                               | B        | Hardcoded "intermediate levels" set; breaks if a 4-level flow is added                                 | Compute from configured flow levels                                                                    |
| 5   | 7     | Medium   | `src/features/admin/validations/index.ts`                                                                                                                                         | 54–55                 | `min(1).max(3)` — "between 1 and 3"                                                                                                                           | A        | Caps approval levels at 3 in validation while flow is data-driven                                      | Drive bound from config (max configured level)                                                         |
| 6   | 6     | Low-Med  | `pending-scope.repository.ts:36`; `claims/new/page.tsx:80,83`; claim components; `claim-expense.ts:23,27`                                                                         | various               | `'ZBH'`, `'FIELD_BASE'`, `'FIELD_OUTSTATION'`, `'OWN_VEHICLE'`, `'RENTAL_VEHICLE'`, `'TWO_WHEELER'`, `'FOUR_WHEELER'`, `'FULL_DAY'`, `'HALF_DAY'`, `'ACTIVE'` | C        | Lookup **codes** are stable contracts but referenced as bare string literals across many files         | Centralize as exported `const` enums in `src/lib/constants/`                                           |
| 7   | 5     | Low-Med  | `src/features/auth/validations/index.ts:5`; `src/features/admin/validations/index.ts:123`                                                                                         | 5 / 123               | `min(6)` password length (duplicated)                                                                                                                         | C        | Two sources of truth for password policy                                                               | Single shared `MIN_PASSWORD_LENGTH` constant                                                           |
| 8   | 5     | Low-Med  | `admin-analytics-dashboard.tsx:110-161`, `claim-operations.tsx:41-57`, `approval-filters-bar.tsx:139-140`, `employee-create-form.tsx:99-122`, `admin-analytics-filters.tsx:86-87` | various               | `staleTime: 60_000`, `gcTime: 5*60*1000`, `30_000`, `2*60*1000`, `10*60*1000`                                                                                 | B        | React Query cache tuning scattered, no central policy                                                  | Centralize in `queryConfig.ts` with named tiers (SHORT/MEDIUM/LONG)                                    |
| 9   | 4     | Low      | `middleware.ts`                                                                                                                                                                   | 12–20 **and** 153–163 | `protectedRoutes` array duplicated in `matcher` config                                                                                                        | C        | Two lists must stay in sync by hand                                                                    | Derive `matcher` from the array (DRY)                                                                  |
| 10  | 4     | Low      | `auth/mutations/index.ts:4`; `network-status-indicator.tsx:33`; `sonner-toaster.tsx:14`; `approval-filters-bar.tsx:78`; `employee-name-suggestion-input.tsx:49`                   | various               | `300`ms retry, `4000`ms, `2000`ms toast, `400`ms debounce                                                                                                     | C        | Magic UX timings                                                                                       | Named constants; acceptable to keep in code                                                            |
| 11  | 3     | Low      | `.mcp.json`, `opencode.json`                                                                                                                                                      | url                   | `project_ref=ibrvpangpuxiorspeffz`                                                                                                                            | C        | Env-coupled infra identifier (not a secret) duplicated in 2 files                                      | Acceptable for dev tooling; note duplication                                                           |
| 12  | 2     | Keep     | `admin-status-charts.tsx`                                                                                                                                                         | 20–94                 | `#2563eb`, `#0891b2`, `#0d9488`, `#15803d`, `#d97706`, `#64748b`                                                                                              | D        | Theme/UI palette                                                                                       | Keep (ideally map to design tokens)                                                                    |
| 13  | 2     | Keep     | `admin-status-charts.tsx`                                                                                                                                                         | 156–157               | `100000` (Lakh) / `1000` (K)                                                                                                                                  | D        | Indian numbering convention                                                                            | Keep                                                                                                   |
| 14  | 2     | Keep     | `employee-form-fields.tsx`                                                                                                                                                        | 73                    | placeholder `"e.g. NXT-EMP-1001"`                                                                                                                             | D        | UI hint text                                                                                           | Keep                                                                                                   |
| 15  | 1     | Keep     | `config-service.ts`, `claim-expense.ts`                                                                                                                                           | —                     | Table/column names, regex `^\d{4}-\d{2}-\d{2}$`                                                                                                               | D        | Framework/schema contract                                                                              | Keep                                                                                                   |

**Scoring formula used:** `Score = ChangeFrequency×30% + BusinessVariability×30% + EnvironmentDependency×20% + RuntimeModificationNeed×20%` (1–10).

---

## Risk Assessment (Agent 4 lens)

| #                          | Operational Risk | Change Frequency | Business Impact | Security Impact | Deployment Coupling                 |
| -------------------------- | ---------------- | ---------------- | --------------- | --------------- | ----------------------------------- |
| 1 `testusers.txt`          | High             | Rare             | Medium          | **High**        | No deployment required (VCS action) |
| 2–3 `approval_level === 3` | High             | Occasional       | High            | None            | Deployment required                 |
| 4 `[1,2]` levels           | Medium           | Occasional       | High            | None            | Deployment required                 |
| 5 `max(3)` validation      | Medium           | Occasional       | Medium          | None            | Deployment required                 |
| 6 lookup code literals     | Medium           | Rare             | Medium          | None            | Deployment recommended              |
| 7 password `min(6)`        | Low              | Rare             | Low             | Low             | Deployment required                 |
| 8 query cache TTLs         | Low              | Occasional       | Low             | None            | Deployment recommended              |
| 9 middleware lists         | Low              | Rare             | Medium          | Low             | Deployment required                 |
| 10 UX timings              | Low              | Rare             | Low             | None            | Deployment required                 |
| 11 project ref             | Low              | Static           | Low             | Low             | No deployment required              |

---

## MUST-MOVE Report (Score ≥ 8)

These are **not** "move to a config table" in the generic sense — they're **decoupling bugs waiting to happen**. The fix is to stop hardcoding what the DB already knows.

### 1. `testusers.txt` — remove from version control (Score 9)

- **Evidence:** `git ls-files --error-unmatch testusers.txt` → **tracked**. Contains live `@nxtwave.co.in` addresses, the full approver topology (SRO/BOA/ABH → SBH → Mansoor → Finance), and 2 password references.
- **Why move:** PII + internal workflow map in a repo; if it ever held real passwords, history is compromised.
- **Plan:**
  1. `git rm --cached testusers.txt`
  2. Add explicit `testusers.txt` entry to `.gitignore` (currently only `.env*` is ignored).
  3. Relocate the test matrix into `e2e/fixtures/` with **synthetic** accounts only, or document in `docs/` without credentials.
  4. If real passwords were ever committed, **rotate them** and scrub history (`git filter-repo`).

### 2–4. The `approval_level === 3` family (Score 8) + `[1,2]` + `max(3)` (Score 7)

- **Evidence:** `employee-actions.ts:168,247`, `analytics.query.ts:96`, `approvals.repository.ts:48`, `admin/validations/index.ts:54-55`.
- **Why move:** The approval chain length is **already configurable per designation** via `designation_approval_flow.required_approval_levels` (see `approval-routing.ts`, which does it correctly). These 5 literals silently assume exactly 3 levels. Add a designation needing 4 approvals and admin actions, finance analytics, the pending-approvals query, and the validation cap all break **without a single test or type error firing.**
- **No new schema needed.** The DB already supports this. Introduce a single resolver and replace the literals.

#### Suggested helper (no migration required for #2–4)

```ts
// src/features/approvals/domain/approval-routing.ts
export function getFinalApprovalLevel(
  flow: DesignationApprovalFlow
): number | null {
  const levels = flow.required_approval_levels
  return levels.length ? levels[levels.length - 1] : null
}

export function getIntermediateApprovalLevels(
  flow: DesignationApprovalFlow
): number[] {
  return flow.required_approval_levels.slice(0, -1)
}
```

---

## Suggested Configuration Schema (assessment)

The generic prompt suggests a full `ConfigCategory` / `ConfigKey` / `ConfigAudit` schema. **For this codebase that is over-engineering.** The business-rule auditing need is already met by the existing lookup tables plus their `effective_from` / `effective_to` / `is_active` / `created_at` columns, which provide temporal versioning.

- **Keep using:** existing lookup tables for all business rules.
- **Optional only:** a typed code module (`queryConfig.ts`) for operational tuning — no DB needed given this is a single-tenant internal app.

---

## Refactoring Roadmap

### Phase 1 — Security (do now)

Remove `testusers.txt` from VCS, gitignore it, rotate any real credentials, scrub history if needed.

- **Complexity:** Low · **Risk:** Low · **Effort:** ~1h · **Deps:** none
- **Testing:** confirm e2e still resolves accounts from env/fixtures.

### Phase 2 — Decouple approval-level literals (high value)

Introduce `getFinalApprovalLevel` / `getIntermediateApprovalLevels`, replace the 5 literals, drive the validation `max` from configured levels.

- **Complexity:** Medium · **Risk:** Medium (touches finance analytics + admin actions) · **Effort:** ~0.5–1d · **Deps:** `config-service`
- **Testing:** unit tests per call-site + a 4-level-flow regression test.

### Phase 3 — Centralize lookup codes & query-cache policy

Move bare code-strings (`'ZBH'`, `'OWN_VEHICLE'`, `'FIELD_BASE'`, day-type/status codes) into `src/lib/constants/` enums; create `queryConfig.ts` with named cache tiers.

- **Complexity:** Low-Med · **Risk:** Low · **Effort:** ~1d
- **Testing:** typecheck + existing suite.

### Phase 4 — Hygiene

DRY the middleware route/matcher lists; single `MIN_PASSWORD_LENGTH`; name the UX timing magic numbers.

- **Complexity:** Low · **Risk:** Low · **Effort:** ~2h

---

## What was intentionally NOT flagged as a problem

- Expense rates / food allowances / approval flows / statuses → already DB-driven with temporal versioning. ✅
- Secrets → env-injected, no hardcoded fallbacks, `.env.local` gitignored. ✅
- Pagination options `[10, 25, 50]` → already centralized in `src/lib/utils/pagination.ts`. ✅
- Chart hex colors, Lakh/K formatting, regex, table names → Category D, keep as-is.

**Net:** This codebase is in good shape. The single must-do is `testusers.txt`; the highest-_value_ engineering fix is killing the `approval_level === 3` assumption before someone configures a non-3-level approval chain.

---

## Appendix — Evidence Commands

```bash
# Confirmed testusers.txt is tracked
git ls-files --error-unmatch testusers.txt        # -> testusers.txt

# Confirmed .env.local is NOT tracked
git ls-files --error-unmatch .env.local           # -> error: did not match

# Zero hardcoded date literals in src
grep -rnE "'20[0-9]{2}-[0-9]{2}-[0-9]{2}'" src     # -> (none)

# approval_level magic numbers
grep -rn "approval_level === 3" src/features       # -> employee-actions.ts:168,247; analytics.query.ts:96
grep -rn "in('approval_level', \[1, 2\])" src      # -> approvals.repository.ts:48
```
