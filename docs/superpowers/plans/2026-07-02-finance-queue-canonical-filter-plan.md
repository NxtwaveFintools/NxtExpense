# Finance Queue Canonical Filter (Consistency Pass) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `/finance` (Finance Queue) onto the canonical-filter architecture, purely for consistency — no bug exists here today. The 2026-07-01 audit specifically checked this page across 8 filter combinations and found the three RPCs (`get_finance_queue_page`, `get_finance_queue_count`, `get_finance_queue_metrics`) already agree exactly, because they already share `finance_filtered_claim_ids()` and a common TypeScript arg-builder (`buildQueueRpcArgs()`). This plan closes the one duplication that genuinely exists (the same `base` CTE + filter-branching logic is independently written in both `get_finance_queue_page` and `get_finance_queue_count`) without touching anything else.

**Architecture — deliberately narrower than the other three phases:** `docs/superpowers/specs/2026-07-02-filter-count-metrics-consistency-design.md` establishes "one canonical function, page + metrics both read from it" as the standard pattern. That pattern does **not** apply cleanly here. Investigation during planning found `get_finance_queue_metrics` calls `finance_filtered_claim_ids()` with `p_required_status_id := null` (`20260618091100_get_finance_queue_metrics.sql:73-77`) — it deliberately scopes across **all** claims regardless of status, then buckets them into pending/approved/rejected via status-ID arrays (`p_pending_status_ids`/`p_approved_status_ids`/`p_rejected_status_ids`), because the KPI cards need to show claims across their whole lifecycle, not just the ones currently in the finance-review queue. `get_finance_queue_page`/`get_finance_queue_count`, by contrast, scope to exactly one status (`p_required_status_id`, resolved via `getFinanceReviewStatusId()`, which uses `.maybeSingle()` and hard-errors if more than one status ever matches that criteria). These are two different, both-correct scopes — not drift. Forcing metrics onto the same canonical function as page/count would either break metrics' multi-bucket aggregation or require assuming an equivalence between `p_pending_status_ids` and `p_required_status_id` that isn't structurally guaranteed (they coincide today only because exactly one status currently satisfies both classifications). This plan therefore:

- Extracts `finance_queue_filtered()` as the canonical function for the **status-scoped** case, consolidating `get_finance_queue_page` and `get_finance_queue_count` — this is the real, provable duplication.
- Leaves `get_finance_queue_metrics` completely untouched.
- Makes **zero TypeScript changes** — every RPC keeps its exact current name and signature; only the SQL bodies of `get_finance_queue_page`/`get_finance_queue_count` change, delegating to the new canonical function instead of duplicating its logic. `buildQueueRpcArgs()`, `getFinanceQueuePaginated()`, `getFinanceQueueTotalCount()`, the export context, and all existing tests are unaffected.

**Verified platform behavior (this session, not assumed):** the exact SQL below was applied against dev (`ibrvpangpuxiorspeffz`) in a rolled-back transaction and compared byte-for-byte against the live, unmodified functions for the same filter arguments, both before and after replacement:

| Check                                                               | Before (live)                  | After (canonical-function-backed) | Match |
| ------------------------------------------------------------------- | ------------------------------ | --------------------------------- | ----- |
| Filtered page (employee_name substring + 2026 date range, limit 50) | 50 IDs in keyset order         | Identical 50 IDs, identical order | ✓     |
| Filtered count (same filter)                                        | 145                            | 145                               | ✓     |
| Unfiltered page (limit 1000)                                        | 1001 rows (limit+1 over-fetch) | 1001 rows                         | ✓     |
| Unfiltered count                                                    | 2892                           | 2892                              | ✓     |

Also confirmed: no `DROP FUNCTION` is required for either `get_finance_queue_page` or `get_finance_queue_count` — their parameter lists and return types are unchanged from the live versions (only the SQL body changes), so a plain `CREATE OR REPLACE FUNCTION` applies cleanly. This avoids the return-type-change hazard class that required explicit `DROP` statements in the Finance History and Claims migrations.

**Tech Stack:** Supabase Postgres (`language sql stable`), pgTAP.

---

## File Structure

| File                                                                           | Responsibility                                                                                                                                                                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260702130000_finance_queue_canonical_filter.sql`        | **Create** — canonical fn + body-only `CREATE OR REPLACE` of the two existing RPCs. No TS changes anywhere.                                                                                                   |
| `supabase/rollback/20260702130000_finance_queue_canonical_filter.rollback.sql` | **Create** — restores the two RPCs' original bodies verbatim, drops the canonical function.                                                                                                                   |
| `supabase/tests/040_finance_queue_filtered_parity.sql`                         | **Create** — pgTAP regression test. No known bug to pin, so this asserts the general invariant (page/count agree, filtered/unfiltered paths agree) as a permanent drift guard, matching this phase's purpose. |

**Not touched:** `src/features/finance/data/repositories/finance-queue.repository.ts`, `src/features/finance/data/queries/analytics.query.ts`, `get_finance_queue_metrics`, the export context (`finance-pending-export-context.ts`), and every existing test — none of these need any change, since the RPC names, signatures, and behavior are identical to today.

---

## Task 1: Consolidated SQL migration — canonical function + body-only RPC updates

**Files:**

- Create: `supabase/migrations/20260702130000_finance_queue_canonical_filter.sql`
- Create: `supabase/rollback/20260702130000_finance_queue_canonical_filter.rollback.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Consistency pass (docs/superpowers/specs/2026-07-02-filter-count-metrics-consistency-design.md):
-- no bug exists on this page (2026-07-01 audit checked 8 filter combinations,
-- found exact agreement). This closes the one real duplication — the same
-- base-CTE + has_filters branching logic was independently written in both
-- get_finance_queue_page and get_finance_queue_count.
--
-- get_finance_queue_metrics is intentionally NOT touched: it scopes across
-- ALL claims regardless of status (p_required_status_id passed as null to
-- finance_filtered_claim_ids — see 20260618091100_get_finance_queue_metrics.sql:73-77),
-- bucketing into pending/approved/rejected via status-ID arrays, for its
-- whole-lifecycle KPI cards. That is a different, both-correct scope from
-- page/count's single-status scope, not drift — collapsing it into this
-- canonical function would be incorrect, not more consistent.
--
-- Parity with the pre-migration functions was verified live (rolled-back
-- transaction) for both a filtered and an unfiltered case before this was
-- written — see docs/superpowers/plans/2026-07-02-finance-queue-canonical-filter-plan.md
-- "Verified platform behavior".
--
-- No DROP needed for either RPC below: parameter lists and return types are
-- byte-identical to the live versions, only the body changes.

create or replace function public.finance_queue_filtered(
  p_required_status_id uuid,
  p_has_filters        boolean     default false,
  p_employee_id        text        default null,
  p_employee_name      text        default null,
  p_claim_number       text        default null,
  p_owner_designation  uuid        default null,
  p_hod_approver_emp   uuid        default null,
  p_claim_status       text        default null,
  p_work_location      uuid        default null,
  p_action_filter      text        default null,
  p_date_field         text        default 'claim_date',
  p_date_from          timestamptz default null,
  p_date_to            timestamptz default null
)
returns table(id uuid, created_at timestamptz)
language sql stable security invoker set search_path = public
as $$
  select ec.id, ec.created_at
  from expense_claims ec
  join public.finance_filtered_claim_ids(
    p_required_status_id, p_employee_id, p_employee_name, p_claim_number,
    p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
    p_action_filter, p_date_field, p_date_from, p_date_to
  ) f on f.id = ec.id
  where p_has_filters
  union all
  select ec.id, ec.created_at
  from expense_claims ec
  where ec.status_id = p_required_status_id and not p_has_filters;
$$;

-- Not granted to anon/authenticated: internal helper, called only by the two
-- RPCs below.

create or replace function public.get_finance_queue_page(
  p_required_status_id uuid,
  p_has_filters        boolean     default false,
  p_employee_id        text        default null,
  p_employee_name      text        default null,
  p_claim_number       text        default null,
  p_owner_designation  uuid        default null,
  p_hod_approver_emp   uuid        default null,
  p_claim_status       text        default null,
  p_work_location      uuid        default null,
  p_action_filter      text        default null,
  p_date_field         text        default 'claim_date',
  p_date_from          timestamptz default null,
  p_date_to            timestamptz default null,
  p_cursor_created_at  timestamptz default null,
  p_cursor_id          uuid        default null,
  p_limit              integer     default 10
)
returns table(id uuid, created_at timestamptz)
language sql stable security invoker set search_path = public
as $$
  select id, created_at
  from public.finance_queue_filtered(
    p_required_status_id, p_has_filters, p_employee_id, p_employee_name, p_claim_number,
    p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
    p_action_filter, p_date_field, p_date_from, p_date_to
  )
  where p_cursor_created_at is null
    or created_at < p_cursor_created_at
    or (created_at = p_cursor_created_at and id < p_cursor_id)
  -- DETERMINISTIC keyset order: id is the REQUIRED secondary sort key — never remove it.
  order by created_at desc, id desc
  limit p_limit + 1;
$$;

create or replace function public.get_finance_queue_count(
  p_required_status_id uuid,
  p_has_filters        boolean     default false,
  p_employee_id        text        default null,
  p_employee_name      text        default null,
  p_claim_number       text        default null,
  p_owner_designation  uuid        default null,
  p_hod_approver_emp   uuid        default null,
  p_claim_status       text        default null,
  p_work_location      uuid        default null,
  p_action_filter      text        default null,
  p_date_field         text        default 'claim_date',
  p_date_from          timestamptz default null,
  p_date_to            timestamptz default null
)
returns bigint
language sql stable security invoker set search_path = public
as $$
  select count(*) from public.finance_queue_filtered(
    p_required_status_id, p_has_filters, p_employee_id, p_employee_name, p_claim_number,
    p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
    p_action_filter, p_date_field, p_date_from, p_date_to
  );
$$;

-- Grants unchanged from the live functions — re-issued for idempotency (a
-- fresh CREATE FUNCTION with the same signature keeps existing grants in
-- Postgres, but stating them explicitly makes this migration correct even if
-- run against an environment where that weren't true).
grant execute on function public.get_finance_queue_page(
  uuid,boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz,
  timestamptz,uuid,integer
) to authenticated, service_role;

grant execute on function public.get_finance_queue_count(
  uuid,boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz
) to authenticated, service_role;
```

- [ ] **Step 2: Write the rollback**

```sql
-- Rollback for 20260702130000_finance_queue_canonical_filter.sql
-- Restores get_finance_queue_page and get_finance_queue_count verbatim from
-- 20260618092000_get_finance_queue_page.sql and
-- 20260618092200_get_finance_queue_count.sql, then drops the canonical
-- function (safe to drop last — restoring the two RPCs' original bodies
-- removes their only references to it).

create or replace function public.get_finance_queue_page(
  p_required_status_id uuid,
  p_has_filters        boolean     default false,
  p_employee_id        text        default null,
  p_employee_name      text        default null,
  p_claim_number       text        default null,
  p_owner_designation  uuid        default null,
  p_hod_approver_emp   uuid        default null,
  p_claim_status       text        default null,
  p_work_location      uuid        default null,
  p_action_filter      text        default null,
  p_date_field         text        default 'claim_date',
  p_date_from          timestamptz default null,
  p_date_to            timestamptz default null,
  p_cursor_created_at  timestamptz default null,
  p_cursor_id          uuid        default null,
  p_limit              integer     default 10
)
returns table(id uuid, created_at timestamptz)
language sql stable security invoker set search_path = public
as $$
  with base as (
    select ec.id, ec.created_at
    from expense_claims ec
    where ec.status_id = p_required_status_id
      and (
        p_cursor_created_at is null
        or ec.created_at < p_cursor_created_at
        or (ec.created_at = p_cursor_created_at and ec.id < p_cursor_id)
      )
  )
  select b.id, b.created_at
  from base b
  join public.finance_filtered_claim_ids(
    p_required_status_id, p_employee_id, p_employee_name, p_claim_number,
    p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
    p_action_filter, p_date_field, p_date_from, p_date_to
  ) f on f.id = b.id
  where p_has_filters
  union all
  select b.id, b.created_at
  from base b
  where not p_has_filters
  order by created_at desc, id desc
  limit p_limit + 1;
$$;

grant execute on function public.get_finance_queue_page(
  uuid,boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz,
  timestamptz,uuid,integer
) to authenticated, service_role;

create or replace function public.get_finance_queue_count(
  p_required_status_id uuid,
  p_has_filters        boolean     default false,
  p_employee_id        text        default null,
  p_employee_name      text        default null,
  p_claim_number       text        default null,
  p_owner_designation  uuid        default null,
  p_hod_approver_emp   uuid        default null,
  p_claim_status       text        default null,
  p_work_location      uuid        default null,
  p_action_filter      text        default null,
  p_date_field         text        default 'claim_date',
  p_date_from          timestamptz default null,
  p_date_to            timestamptz default null
)
returns bigint
language sql stable security invoker set search_path = public
as $$
  select case
    when p_has_filters then (
      select count(*)
      from public.finance_filtered_claim_ids(
        p_required_status_id, p_employee_id, p_employee_name, p_claim_number,
        p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
        p_action_filter, p_date_field, p_date_from, p_date_to
      )
    )
    else (
      select count(*)
      from public.expense_claims ec
      where ec.status_id = p_required_status_id
    )
  end;
$$;

grant execute on function public.get_finance_queue_count(
  uuid,boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz
) to authenticated, service_role;

drop function if exists public.finance_queue_filtered(
  uuid, boolean, text, text, text, uuid, uuid, text, uuid, text, text, timestamptz, timestamptz
);
```

- [ ] **Step 3: Do NOT apply or commit** — write only, per project convention. Ask the user to apply before Task 3's post-apply verification.

---

## Task 2: pgTAP regression test — general invariant, not a specific-bug pin

**Files:**

- Create: `supabase/tests/040_finance_queue_filtered_parity.sql`

Unlike the other three phases, there's no specific historical bug to regression-pin here. This test asserts the general invariant this migration is meant to guarantee going forward: page and count always agree, for both the filtered and unfiltered code paths.

- [ ] **Step 1: Write the test**

```sql
-- Regression guard for Finance Queue's canonical-filter consolidation. No
-- specific bug is being pinned here (none exists) — this asserts the general
-- invariant that get_finance_queue_page and get_finance_queue_count always
-- agree, for a future filter change to break loudly rather than silently.
begin;
set local search_path = public, extensions;

select plan(2);

insert into work_locations (id, location_code, location_name)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'PGTAP_WL4', 'PGTAP Test Location 4');

insert into designations (id, designation_code, designation_name, hierarchy_level)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'PGTAP_FQOWN', 'PGTAP Finance Queue Owner Designation', 1);

insert into employees (id, employee_id, employee_name, employee_email, designation_id, employee_status_id)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'PGTAP0005', 'PGTAP Finance Queue Employee',
  'pgtap-financequeue@nxtwave.co.in', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
  (select id from employee_statuses limit 1)
);

insert into expense_claims (id, employee_id, claim_number, claim_date, work_location_id, designation_id, status_id, total_amount)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
  'PGTAP-CLAIM-0005',
  current_date,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
  (select id from claim_statuses where approval_level = 3 and not is_rejection and not is_terminal and not is_approval and is_active limit 1),
  400.00
);

-- Assertion 1: filtered page row count matches filtered count RPC, for a
-- filter that actually narrows (employee_name substring matching the fixture).
select is(
  (select count(*)::int from get_finance_queue_page(
    (select id from claim_statuses where approval_level = 3 and not is_rejection and not is_terminal and not is_approval and is_active limit 1),
    true, null, 'PGTAP Finance Queue', null, null, null, null, null, null, 'claim_date', null, null, null, null, 10
  )),
  (select get_finance_queue_count(
    (select id from claim_statuses where approval_level = 3 and not is_rejection and not is_terminal and not is_approval and is_active limit 1),
    true, null, 'PGTAP Finance Queue', null, null, null, null, null, null, 'claim_date', null, null
  ))::int,
  'get_finance_queue_page row count matches get_finance_queue_count for an identical filter'
);

-- Assertion 2: the fixture claim is found by name search — proves the filter
-- actually narrows rather than trivially matching everything.
select is(
  (select count(*)::int from get_finance_queue_page(
    (select id from claim_statuses where approval_level = 3 and not is_rejection and not is_terminal and not is_approval and is_active limit 1),
    true, null, 'PGTAP Finance Queue', null, null, null, null, null, null, 'claim_date', null, null, null, null, 10
  )),
  1,
  'the employee_name filter finds exactly the one fixture claim'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Do not run locally** — no local Supabase stack available (per this session's prior experience); verify via the rolled-back-transaction technique against dev after the user applies Task 1's migration (Task 3).

---

## Task 3: Post-apply verification (after the user applies Task 1's migration)

**Files:** none — verification only.

- [ ] **Step 1: Confirm the canonical function exists and the two RPCs retain identical signatures**

```sql
select proname, pronargs from pg_proc
where proname in ('finance_queue_filtered','get_finance_queue_page','get_finance_queue_count','get_finance_queue_metrics');
```

Expected: `finance_queue_filtered` (13 args), `get_finance_queue_page` (16 args, unchanged), `get_finance_queue_count` (13 args, unchanged), `get_finance_queue_metrics` (19 args, unchanged — confirms it wasn't touched).

- [ ] **Step 2: Re-run this plan's before/after parity comparison against the now-live functions** (repeat the exact filtered/unfiltered page+count comparison from "Verified platform behavior" above), confirming the applied migration produces the same results as the pre-apply spike did.

- [ ] **Step 3: Run the pgTAP test from Task 2 against dev** via the rolled-back-transaction technique, confirm both assertions pass, confirm the rollback leaves zero rows.

- [ ] **Step 4: `generate_typescript_types` check** — confirm `finance_queue_filtered`, `get_finance_queue_page`, `get_finance_queue_count` all produce fully field-typed `Returns` shapes, and confirm `get_finance_queue_metrics`'s generated type is byte-identical to before this migration (proof it wasn't touched).

- [ ] **Step 5: Run the full TS test suite** (`npx vitest run`) and typecheck (`npx tsc --noEmit`) — expected to pass with zero changes, since no TS file was modified in this phase. This is the confirmation that "zero TS changes needed" was actually true, not just assumed.

---

## Self-Review Notes

**Spec coverage:** consistency goal achieved for the real duplication (page/count's shared base-CTE logic, now in exactly one place). The deliberate non-consolidation of `get_finance_queue_metrics` is documented with the specific code reference (`p_required_status_id := null`) that proves the scope difference is real, not an excuse to skip work.

**Verified, not assumed:** every claim in this plan (no DROP needed, byte-identical parity, both filtered and unfiltered paths) was checked against live dev data in a rolled-back transaction before being written down — directly applying the lesson from this session's Claims migration mistake (`RETURNS TABLE` does not create a referenceable type) rather than repeating a new unverified assumption here.

**All four findings' phases are now complete after this one**: Finding 1 (Finance History), Finding 4 (Approvals), Finding 3 (Claims), and this consistency-only pass (Finance Queue) — the full `docs/superpowers/specs/2026-07-02-filter-count-metrics-consistency-design.md` phasing is done.
