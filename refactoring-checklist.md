# NxtExpense — Refactoring Checklist

> **Related:** `hardcoded-audit-report.md`, `database-migration-plan.md`, `proposed-schema.sql`

Each task below maps a hardcoded value to the DB table that replaces it, with the exact file, line, and replacement pattern.

---

## Legend

- **Status:** ⬜ Not started | 🔲 In progress | ✅ Done
- **Priority:** P0 = Critical | P1 = High | P2 = Medium

---

## Phase 1: Designation Config (Requires Migration 022)

### ⬜ P0 — Replace `FOUR_WHEELER_ALLOWED_DESIGNATIONS`

**File:** `src/features/employees/permissions/index.ts`  
**Lines:** 10–24  
**Current:**

```typescript
const FOUR_WHEELER_ALLOWED_DESIGNATIONS = new Set([
  'State Business Head',
  'Zonal Business Head',
  'Program Manager',
])
```

**Replace with:**

```typescript
// Fetch from designation_config table
export async function isVehicleAllowedForDesignation(
  designation: string,
  vehicleType: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase
    .from('designation_config')
    .select('allowed_vehicle_types')
    .eq('designation', designation)
    .single()
  return data?.allowed_vehicle_types?.includes(vehicleType) ?? false
}
```

---

### ⬜ P0 — Replace KM limits (150 / 300)

**File:** `src/features/claims/validations/index.ts`  
**Lines:** 106  
**Current:**

```typescript
value.vehicleType === 'Two Wheeler' ? 150 : 300
```

**Replace with:** Accept `maxKm` as parameter from server action, which fetches it from `expense_reimbursement_rates.max_km` column.

**Server action change (`src/features/claims/actions/index.ts`):**

```typescript
const { data: kmLimit } = await supabase
  .from('expense_reimbursement_rates')
  .select('max_km')
  .eq('vehicle_type', vehicleType)
  .eq('rate_type', 'intercity_per_km')
  .eq('designation', designation)
  .single()
```

---

### ⬜ P1 — Replace actor filter code mapping

**File:** `src/features/approvals/utils/history-filters.ts`  
**Lines:** 55–69  
**Current:**

```typescript
if (designation === 'State Business Head') return 'sbh'
if (['Program Manager', 'Zonal Business Head'].includes(designation))
  return 'hod'
if (designation === 'Finance') return 'finance'
```

**Replace with:**

```typescript
const { data } = await supabase
  .from('designation_config')
  .select('actor_filter_code')
  .eq('designation', designation)
  .single()
return data?.actor_filter_code ?? 'all'
```

---

### ⬜ P1 — Replace dashboard access check

**File:** `src/features/employees/permissions/index.ts`  
**Lines:** 57–67  
**Current:**

```typescript
if (designation === 'Finance') {
  /* redirect to finance queue */
}
```

**Replace with query on `designation_config.can_view_finance_queue`.**

---

### ⬜ P2 — Replace designation abbreviation mapping

**File:** `src/features/finance/queries/filters.ts`  
**Lines:** 20–32  
**Current:**

```typescript
function addAcronymSuffix(name: string): string {
  if (name === 'State Business Head') return 'State Business Head (SBH)'
  // ... more if/else
}
```

**Replace with:** Join on `designation_config.abbreviation` and format: `${name} (${abbreviation})`

---

### ⬜ P1 — Replace L2 approval skip logic

**File:** `src/features/employees/permissions/index.ts`  
**Lines:** 37–53  
**Current:**

```typescript
// Level 2 is skipped for all designations currently
if (currentLevel === null) return 1
if (currentLevel === 1) return 3 // skip 2
```

**Replace with:** Read `designation_config.skip_approval_levels` array. If current level + 1 is in the skip list, increment again.

---

## Phase 2: Transport & Email Config (Requires Migrations 024–025)

### ⬜ P1 — Replace `TRANSPORT_TYPE_VALUES` / `TRANSPORT_TYPE_OPTIONS`

**Files:**

- `src/features/claims/validations/index.ts` L7
- `src/app/claims/new/page.tsx` L22

**Replace with:**

```typescript
// In page.tsx (server component)
const { data: transportTypes } = await supabase
  .from('transport_types')
  .select('name')
  .eq('is_active', true)
  .order('sort_order')
const transportTypeOptions = transportTypes?.map((t) => t.name) ?? []
```

---

### ⬜ P1 — Replace `ALLOWED_EMAIL_DOMAINS`

**File:** `src/lib/auth/allowed-email-domains.ts`  
**Replace with:**

```typescript
export async function getAllowedEmailDomains(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data } = await supabase
    .from('allowed_email_domains')
    .select('domain')
    .eq('is_active', true)
  return data?.map((d) => d.domain) ?? []
}
```

**Note:** This function is called during auth flow. Use service role client since RLS restricts to service_role only.

---

## Phase 3: Work Location & Vehicle Options (Requires Migration 022)

### ⬜ P1 — Consolidate `WORK_LOCATION_*` (3 duplicated definitions)

**Files to modify:**

1. `src/lib/validations/claim.ts` L9–15 — Remove `WORK_LOCATION_VALUES`
2. `src/features/claims/types/index.ts` L9–15 — Remove `WORK_LOCATION_FILTER_VALUES`
3. `src/app/claims/new/page.tsx` L14–20 — Remove `WORK_LOCATION_OPTIONS`

**Replace with:** Single DB fetch in server components:

```typescript
// Fetch work location options from DB enum values
// Option A: Query pg_enum directly via RPC
// Option B: Use a work_locations config table (future migration)
// Option C (pragmatic): Single shared const in lib/, fetched once
```

**Pragmatic approach for now:** Since work locations are a PostgreSQL ENUM, they can't easily be queried as dropdown options without an RPC. Create a single shared constant in `src/lib/constants/work-locations.ts` and import everywhere. True DB-driven approach requires the Phase 4 ENUM-to-table migration.

---

### ⬜ P1 — Consolidate `VEHICLE_TYPE_VALUES` (2+ duplicated definitions)

**Files:**

- `src/lib/validations/claim.ts` L17
- `src/features/claims/validations/index.ts` L58, L84

**Same approach as work locations above.**

---

## Phase 4: System Settings (Requires Migration 026)

### ⬜ P2 — Replace `.max(500)` in validation schemas

**Files:**

- `src/features/approvals/validations/index.ts` L40
- `src/features/finance/validations/index.ts` L41
- `src/features/admin/validations/index.ts` L9, L28

**Replace with:** Fetch `system_settings.notes_max_length` and pass into validation factory:

```typescript
export function createNotesSchema(maxLength: number) {
  return z.string().max(maxLength).optional()
}
```

---

### ⬜ P2 — Replace `'Rs. '` currency prefix

**File:** `src/features/approvals/utils/history-filters.ts` L138  
**Replace with:** Fetch `system_settings.currency_symbol`.

---

### ⬜ P2 — Replace hardcoded timezone

**Files:**

- `src/lib/utils/date.ts` L2 (`'Asia/Kolkata'`)
- `src/features/approvals/queries/history-filters.ts` L28–29 (`+05:30`)

**Replace with:** Fetch `system_settings.timezone` and `system_settings.timezone_utc_offset`.

---

## Phase 5: Dropdown Components

### ⬜ P1 — Replace hardcoded `<option>` values in approval-filters-bar

**File:** `src/features/approvals/components/approval-filters-bar.tsx`  
**Current:** Hardcoded `<option>` elements for 'all', 'sbh', 'hod', 'finance'  
**Replace with:** Accept `actorFilterOptions` as prop from server component parent. Server component fetches distinct `actor_filter_code` values from `designation_config`.

---

### ⬜ P2 — Replace hardcoded finance action filter

**File:** `src/features/finance/components/finance-filters-bar.tsx`  
**Current:** Hardcoded `<option>` elements for 'all', 'issued', 'finance_rejected'  
**Replace with:** Derive available finance actions from `claim_transition_graph` where `actor_scope = 'finance'`.

---

## Validation Changes Summary

After all phases, Zod schemas should:

1. Accept dynamic enum values (not compile-time `z.enum()`)
2. Use `z.string().refine(val => allowedValues.includes(val))` pattern
3. Receive allowed values from server components / server actions
4. Keep type safety via TypeScript generics

---

## Testing Requirements Per Phase

| Phase   | Required Tests                                                                              |
| ------- | ------------------------------------------------------------------------------------------- |
| Phase 1 | Unit: `designation_config` query helpers; Integration: vehicle eligibility check against DB |
| Phase 2 | Unit: `getAllowedEmailDomains()`; Integration: auth flow with DB domains                    |
| Phase 3 | Unit: shared constant imports resolve; No duplicate definitions in codebase                 |
| Phase 4 | Unit: `createNotesSchema()` factory; Integration: settings fetched correctly                |
| Phase 5 | E2E: dropdown options match DB values                                                       |
