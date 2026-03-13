# NxtExpense — Database Migration Plan

> **Created:** 2026-03-08  
> **Related:** `hardcoded-audit-report.md`  
> **Strategy:** Additive-only approach — no destructive schema changes in Phase 1

---

## Migration Sequence

All migrations follow the project convention: numbered sequentially after `021_skip_l2_in_approval_routing.sql`.

---

## Migration 022: Create `designation_config` table

**File:** `supabase/migrations/022_create_designation_config.sql`

### Purpose

Centralizes all designation-level business rules currently scattered across:

- `src/features/employees/permissions/index.ts` — vehicle eligibility, dashboard access, L2 skip
- `src/features/finance/queries/filters.ts` — abbreviation mapping
- `src/features/approvals/utils/history-filters.ts` — actor filter code mapping

### What This Replaces

| Hardcoded Item                          | Current Location                            | New DB Column                        |
| --------------------------------------- | ------------------------------------------- | ------------------------------------ |
| `FOUR_WHEELER_ALLOWED_DESIGNATIONS` Set | `employees/permissions/index.ts` L10-13     | `allowed_vehicle_types` array column |
| `addAcronymSuffix()` function           | `finance/queries/filters.ts` L20-32         | `abbreviation` column                |
| `getDefaultApprovalActorFilter()`       | `approvals/utils/history-filters.ts` L55-67 | `actor_filter_code` column           |
| `getDashboardAccess()` Finance check    | `employees/permissions/index.ts` L57-67     | `can_view_finance_queue` column      |
| `canAccessEmployeeClaims()` exclusion   | `employees/permissions/index.ts` L71        | `can_create_claims` column           |

### Rollback Strategy

```sql
DROP TABLE IF EXISTS public.designation_config;
```

This table is additive — it doesn't modify any existing tables. Rollback is safe.

---

## Migration 023: Add `max_km` to `expense_reimbursement_rates`

**File:** `supabase/migrations/023_add_max_km_to_rates.sql`

### Purpose

Moves KM limits (150/300) from hardcoded validation into the existing rates configuration table.

### What This Replaces

| Hardcoded Item                                    | Current Location                   | New Column      |
| ------------------------------------------------- | ---------------------------------- | --------------- |
| `value.vehicleType === 'Two Wheeler' ? 150 : 300` | `claims/validations/index.ts` L106 | `max_km` column |

### Rollback Strategy

```sql
ALTER TABLE public.expense_reimbursement_rates DROP COLUMN IF EXISTS max_km;
```

---

## Migration 024: Create `transport_types` table

**File:** `supabase/migrations/024_create_transport_types.sql`

### Purpose

Moves transport type options from hardcoded arrays into a configurable table.

### What This Replaces

| Hardcoded Item           | Current Location                 | New Table              |
| ------------------------ | -------------------------------- | ---------------------- |
| `TRANSPORT_TYPE_VALUES`  | `claims/validations/index.ts` L7 | `transport_types.name` |
| `TRANSPORT_TYPE_OPTIONS` | `app/claims/new/page.tsx` L22    | `transport_types` rows |

### Rollback Strategy

```sql
DROP TABLE IF EXISTS public.transport_types;
```

---

## Migration 025: Create `allowed_email_domains` table

**File:** `supabase/migrations/025_create_allowed_email_domains.sql`

### Purpose

Moves corporate email domain validation from hardcoded array to database table.

### What This Replaces

| Hardcoded Item                | Current Location                         | New Table                    |
| ----------------------------- | ---------------------------------------- | ---------------------------- |
| `ALLOWED_EMAIL_DOMAINS` array | `lib/auth/allowed-email-domains.ts` L1-5 | `allowed_email_domains` rows |

### Rollback Strategy

```sql
DROP TABLE IF EXISTS public.allowed_email_domains;
```

---

## Migration 026: Create `system_settings` table

**File:** `supabase/migrations/026_create_system_settings.sql`

### Purpose

Centralizes global application settings into a key-value configuration table.

### What This Replaces

| Hardcoded Item              | Current Location                                            | New Key                     |
| --------------------------- | ----------------------------------------------------------- | --------------------------- |
| `.max(500)` (notes limit)   | 3 validation files                                          | `notes_max_length`          |
| `'Rs. '` (currency symbol)  | `approvals/utils/history-filters.ts` L138                   | `currency_symbol`           |
| `'Asia/Kolkata'` / `+05:30` | `lib/utils/date.ts`, `approvals/queries/history-filters.ts` | `timezone`                  |
| Pagination max (100)        | `approvals/queries/history-filters.ts`                      | `pagination_max_limit`      |
| Max date range              | Not implemented yet                                         | `max_claim_date_range_days` |

### Rollback Strategy

```sql
DROP TABLE IF EXISTS public.system_settings;
```

---

## RLS Policies Required

All new configuration tables need RLS policies:

| Table                   | Policy                             | Rule                                                  |
| ----------------------- | ---------------------------------- | ----------------------------------------------------- |
| `designation_config`    | SELECT for all authenticated users | Read-only. Only Admin can INSERT/UPDATE.              |
| `transport_types`       | SELECT for all authenticated users | Read-only. Only Admin can INSERT/UPDATE.              |
| `allowed_email_domains` | SELECT for service role only       | Used server-side during auth — not exposed to client. |
| `system_settings`       | SELECT for all authenticated users | Read-only. Only Admin can UPDATE.                     |

---

## Execution Order

```
022_create_designation_config.sql          ← Do FIRST (unblocks most refactoring)
023_add_max_km_to_rates.sql               ← Quick ALTER TABLE
024_create_transport_types.sql             ← Independent
025_create_allowed_email_domains.sql       ← Independent
026_create_system_settings.sql             ← Independent
```

Migrations 023–026 can be applied in any order. Migration 022 should go first because it unblocks the most code refactoring work.

---

## Code Refactoring After Migrations

After each migration is applied, the corresponding code changes should be made. See `refactoring-checklist.md` for file-by-file instructions.

**Rule:** Code changes should NOT be deployed until the corresponding migration has been applied to all environments (dev → staging → production).
