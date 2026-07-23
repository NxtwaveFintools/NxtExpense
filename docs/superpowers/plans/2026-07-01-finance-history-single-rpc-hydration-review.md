# Review — Finance Approved History Single-RPC Hydration Plan

> Adversarial Principal/Staff-level review of `2026-07-01-finance-history-single-rpc-hydration.md`, performed before any implementation started. Findings are already folded into that plan; this doc is the record of _why_.

## 1. Join-type mismatches — real bugs, found in the first SQL draft

Re-grepped the actual embed syntax in `finance-history.repository.ts`, `claim-columns.ts`, `finance-shared.repository.ts` instead of trusting memory:

| Relation                                             | Actual PostgREST syntax today                          | Join semantics     | First draft used |
| ---------------------------------------------------- | ------------------------------------------------------ | ------------------ | ---------------- |
| owner `employees`                                    | `employees!employee_id!inner(...)`                     | INNER (explicit)   | INNER — correct  |
| `designations`                                       | `designations!designation_id(...)`                     | LEFT (no `!inner`) | LEFT — correct   |
| `work_locations`/`expense_locations`/`vehicle_types` | no `!inner`                                            | LEFT               | LEFT — correct   |
| `claim_statuses`                                     | `claim_statuses!status_id(...)` — no `!inner`          | LEFT               | **INNER — bug**  |
| actor `employees`                                    | `actor:employees!actor_employee_id(...)` — no `!inner` | LEFT               | **INNER — bug**  |

Two joins in the first draft would have silently _dropped_ an entire history row if a claim's status or an action's actor employee ever failed to resolve (soft-deleted employee, orphaned reference), where today's code returns the row with `null` in that slot instead. This is exactly the class of bug the plan's parity gate exists to catch — but it's cheaper to get right by audit than to discover via a failing parity test after writing 40 columns of SQL. Folded into the plan as Task 1 Step 0 (mandatory join-type audit table, done _before_ writing SQL).

## 2. RLS — checked live, not assumed

Queried `pg_policies` on the five newly-joined reference tables (`designations`, `work_locations`, `expense_locations`, `vehicle_types`, `claim_statuses`) plus `employees`:

```
claim_statuses     : SELECT USING (true) for authenticated
designations       : SELECT USING (true) for authenticated
expense_locations   : SELECT USING (true) for authenticated
vehicle_types       : SELECT USING (true) for authenticated
work_locations      : SELECT USING (true) for authenticated
employees           : SELECT for authenticated ("authenticated users can read employees")
```

All unconditionally readable — no current RLS-driven gap from the new joins in this specific schema.

However, the **validation method has a structural blind spot regardless**: both `finance-list-parity.test.ts` and `finance-export-parity.test.ts` connect via `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely. If any of these tables (or one added to this query later) ever gets a restrictive policy, the parity tests would keep passing green while a real Finance user's `authenticated` session silently received fewer rows or nulled fields. Nothing in the current test suite would catch that class of regression except the live e2e run against a real test account. Folded into the plan: Task 4 states this limitation explicitly in the parity test's header comment; Task 5's e2e re-verification is promoted from "nice to have" to the thing that actually covers this risk.

## 3. Flat columns vs. hydrated JSON — reversed the original design choice

The plan's first draft proposed `jsonb` columns shaped to mimic PostgREST's own embed output, specifically so `mapClaimRow`/`normalizeFinanceOwner` could be reused with zero changes. On reflection this is a mistake:

- Those two mappers exist to unwrap a PostgREST-specific quirk (a related row arrives as either a bare object or a single-element array). That's an artifact of REST embedding, not a contract hand-written SQL should deliberately reproduce.
- `jsonb` return columns generate as opaque `Json` in Supabase's typegen; flat columns generate real per-field types. This throws away type safety at exactly the boundary where it matters most.
- `jsonb_build_object` per row is a real (if small at this scale) executor-side serialization cost that flat columns don't pay.

**Changed:** the function returns flat columns; a new purpose-built mapper (`mapHydratedHistoryRow`) assembles the `Claim`/`FinanceOwner`/`action` shapes. Slightly more code than reusing the existing mappers, but it's honest about the two paths (queue vs. history) now being genuinely different mechanisms rather than papering over that with a shared-looking call (see finding 6).

## 4. Cursor/keyset correctness after adding joins — verified safe

Checked every added join's cardinality: all eight (`expense_claims`, owner `employees`, `designations`, `work_locations`, `expense_locations`, `vehicle_types`, `claim_statuses`, actor `employees`) are to-one lookups by primary key — none can multiply rows. The `page` CTE's `ORDER BY ... LIMIT p_limit + 1` executes _before_ any enrichment join, so the keyset math (`hasNextPage`, the `id` tie-breaker) cannot be affected by the joins — they physically can't see or alter a CTE that already decided page membership.

This is also the hard constraint for future extension: any field added later must stay a to-one join. A one-to-many addition (e.g. a nested array of attachments) needs `json_agg`/`GROUP BY` and a fresh review of this invariant — folded into the plan as an explicit SQL comment (Task 1 Step 2) so it isn't rediscovered the hard way.

## 5. Memory — bounded, but heavier per row than the current shape

Total memory stays bounded by page size (doesn't grow with dataset size) — that invariant holds. But per-row memory goes up: today's keyset RPC returns `{id, claim_id, acted_at}` (~100 bytes/row); the new design returns a fully hydrated row (~1-2KB/row). At a re-tuned chunk size around 500, that's roughly 0.5-1MB parsed per call — trivial for a serverless function, but the re-tuned chunk size (Task 5) should be picked against an explicit byte budget, not just the `db-max-rows` row-count cap, so a future PR bumping the constant doesn't have to rediscover this by reading a comment.

## 6. The 5-year concern: two parallel data-shaping mechanisms

This change leaves the codebase with two different mechanisms producing conceptually the same `Claim` + owner shape: the queue repo stays on PostgREST embeds (`CLAIM_COLUMNS`); the history repo moves to hand-written SQL + `mapHydratedHistoryRow`. A field added to one won't automatically appear in the other. Mitigated, not eliminated, via:

- A drift-detector test (Task 4) asserting the RPC's returned columns are a superset of `CLAIM_COLUMNS`/`FINANCE_OWNER_COLUMNS`'s field list.
- Explicitly naming "extend this pattern to the queue repo" as a tracked future decision rather than a silent omission (plan's "out of scope" section).

## What was checked and is genuinely fine, no change needed

- **Locking/concurrency**: read-only `stable` function, no long-lived transaction or cursor, no new lock contention. Keyset pagination's "might miss a row inserted mid-export" property is pre-existing and unrelated to this change.
- **Query planner**: the `LIMIT` inside the `page` CTE is a real barrier — the 6-8 enrichment joins only ever run against ≤ `limit+1` rows, not the full filtered set.
- **Total network bytes**: likely flat-to-improved despite bigger per-call payloads — no duplicated framing/headers across what used to be 3 separate HTTP responses.

## Verdict

Not production-ready as first drafted. Two concrete fixes were required before Task 1 (join-type audit; explicit RLS-blind-spot note in the parity tests), one design change made while it was still cheap (flat columns + dedicated mapper over jsonb mimicking PostgREST), and one structural trade-off accepted and tracked rather than silently shipped (queue/history divergence). None of these invalidate Option C as the target architecture — they sharpen its implementation. All findings are folded into the current version of the implementation plan.
