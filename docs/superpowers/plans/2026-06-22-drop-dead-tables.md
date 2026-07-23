# Drop Dead Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop six zero-row, zero-dependency tables and their associated indexes from the schema.

**Architecture:** Single migration file — six `DROP TABLE IF EXISTS` statements. No application code changes, no TypeScript changes, no RLS changes. The `IF EXISTS` guard makes the migration idempotent across environments.

**Tech Stack:** PostgreSQL DDL, Supabase migrations.

---

## File Map

| File                                                           | Action                   |
| -------------------------------------------------------------- | ------------------------ |
| `supabase/migrations/20260622130000_drop_dead_tables.sql`      | Create                   |
| `docs/superpowers/specs/2026-06-22-drop-dead-tables-design.md` | Commit (already written) |
| `docs/superpowers/plans/2026-06-22-drop-dead-tables.md`        | Commit (this file)       |

---

## Task 1: Create and commit the migration

**Files:**

- Create: `supabase/migrations/20260622130000_drop_dead_tables.sql`

- [ ] **Step 1.1: Create the migration file**

Create `supabase/migrations/20260622130000_drop_dead_tables.sql` with exactly this content:

```sql
-- Drop six zero-row, zero-dependency tables that exist only as schema noise.
-- Dependency audit (2026-06-22): 0 FK refs in/out, 0 function refs, 0 view refs,
-- 0 triggers, 0 RLS policies, 0 application code references.
-- IF EXISTS makes this idempotent across environments.

-- _backup_* tables: denormalised manual backups created before a past migration,
-- never populated on this database.
DROP TABLE IF EXISTS public._backup_approval_history;
DROP TABLE IF EXISTS public._backup_expense_claim_items;
DROP TABLE IF EXISTS public._backup_expense_claims;
DROP TABLE IF EXISTS public._backup_finance_actions;

-- archive_* tables: legacy design predating expense_claim_items and
-- approval_history; never populated, and have no FK constraints despite
-- carrying claim_id columns.
DROP TABLE IF EXISTS public.archive_claim_expenses;
DROP TABLE IF EXISTS public.archive_claim_status_audit;
```

- [ ] **Step 1.2: Verify the migration file looks correct**

```
cat supabase/migrations/20260622130000_drop_dead_tables.sql
```

Expected: the file prints the six `DROP TABLE IF EXISTS` statements with no typos in the table names. Cross-check the six names against the spec:

- `_backup_approval_history` ✓
- `_backup_expense_claim_items` ✓
- `_backup_expense_claims` ✓
- `_backup_finance_actions` ✓
- `archive_claim_expenses` ✓
- `archive_claim_status_audit` ✓

- [ ] **Step 1.3: Run the full unit test suite to confirm nothing is broken**

```
npm test
```

Expected: all tests pass. There are no application code references to any of these tables, so this is a pure sanity check.

- [ ] **Step 1.4: Commit**

```bash
git add \
  supabase/migrations/20260622130000_drop_dead_tables.sql \
  docs/superpowers/specs/2026-06-22-drop-dead-tables-design.md \
  docs/superpowers/plans/2026-06-22-drop-dead-tables.md
```

```bash
git commit -m "chore: drop six zero-row dead tables

Removes four _backup_* tables (denormalised manual backups never populated)
and two archive_* tables (legacy design predating expense_claim_items and
approval_history). Full dependency audit confirmed zero FK refs, zero function
refs, zero view refs, zero triggers, zero RLS policies, zero application code
references. Eliminates 9 unnecessary indexes from the planner catalogue."
```
