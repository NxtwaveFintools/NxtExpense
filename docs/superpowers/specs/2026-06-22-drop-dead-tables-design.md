# Design: Drop Six Dead Zero-Row Tables

**Date:** 2026-06-22
**Status:** Approved
**Effort:** ~15 minutes
**Risk:** Zero — no rows, no dependencies, no application code references

---

## Problem

Six tables exist in the schema with zero rows and zero dependencies. They add
noise to schema exploration, carry unnecessary indexes in the planner's
catalogue, and have RLS grants that widen the authenticated surface area for
no purpose.

| Table                         | Rows | Purpose (historical)                       |
| ----------------------------- | ---- | ------------------------------------------ |
| `_backup_approval_history`    | 0    | Denormalised manual backup pre-migration   |
| `_backup_expense_claims`      | 0    | Denormalised manual backup pre-migration   |
| `_backup_finance_actions`     | 0    | Denormalised manual backup pre-migration   |
| `_backup_expense_claim_items` | 0    | Denormalised manual backup pre-migration   |
| `archive_claim_expenses`      | 0    | Legacy design before `expense_claim_items` |
| `archive_claim_status_audit`  | 0    | Legacy design before `approval_history`    |

---

## Dependency Audit (live DB, 2026-06-22)

Every angle queried and confirmed empty:

- Inbound FK constraints (other tables referencing these): **0**
- Outbound FK constraints (these tables referencing others): **0** — the
  `archive_*` tables carry a `claim_id uuid NOT NULL` column but it has no FK
  constraint; it is a bare UUID with no enforcement.
- DB functions / procedures: **0**
- Views: **0**
- Triggers: **0**
- RLS policies: **0**
- TypeScript application code: **0** (grep across entire `src/`)
- Other migrations: **only the initial schema dump** (`20260429080441_remote_schema.sql`)

---

## Indexes Dropped as a Side-Effect

`DROP TABLE` automatically removes all indexes. This eliminates 9 indexes total:

| Table                        | Index                                                             |
| ---------------------------- | ----------------------------------------------------------------- |
| `archive_claim_expenses`     | `archive_claim_expenses_pkey`                                     |
| `archive_claim_expenses`     | `archive_claim_expenses_claim_id_idx`                             |
| `archive_claim_expenses`     | `archive_claim_expenses_expense_type_idx`                         |
| `archive_claim_status_audit` | `archive_claim_status_audit_pkey`                                 |
| `archive_claim_status_audit` | `archive_claim_status_audit_actor_email_idx`                      |
| `archive_claim_status_audit` | `archive_claim_status_audit_claim_id_changed_at_idx`              |
| `archive_claim_status_audit` | `archive_claim_status_audit_claim_id_to_status_changed_at_idx`    |
| `archive_claim_status_audit` | `archive_claim_status_audit_claim_id_actor_scope_trigger_act_idx` |
| `_backup_*` (×4)             | implicit pkey / heap storage only                                 |

---

## Approach: Single Migration

One migration drops all six tables. Splitting into two provides no safety
benefit: all six have identical dependency profiles (zero) and zero data.

```sql
DROP TABLE IF EXISTS public._backup_approval_history;
DROP TABLE IF EXISTS public._backup_expense_claim_items;
DROP TABLE IF EXISTS public._backup_expense_claims;
DROP TABLE IF EXISTS public._backup_finance_actions;
DROP TABLE IF EXISTS public.archive_claim_expenses;
DROP TABLE IF EXISTS public.archive_claim_status_audit;
```

`IF EXISTS` makes the migration idempotent — safe to re-run on any environment
where a table was already dropped manually.

---

## What Does NOT Change

- No TypeScript files
- No other migrations
- No RLS policies (none existed on these tables)
- No application behaviour

---

## Rollback

Tables had zero rows. There is nothing to recover. If a table needs to be
recreated for any reason, the DDL is in `20260429080441_remote_schema.sql`.
