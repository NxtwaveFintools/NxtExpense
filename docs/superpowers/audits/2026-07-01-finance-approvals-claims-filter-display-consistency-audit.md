# Filter / Display Consistency Audit — Finance, Approvals, Claims

> **Audit type:** Cross-page consistency audit, triggered by a user-reported bug: on `/approved-history`, filtering by "Finance Approved" sometimes made records "disappear" — reported as "I can't see finance approved all the time, sometimes it was visible and sometimes it was not."
> **Date:** 2026-07-01
> **Branch audited:** `new_requirements`
> **Method:** Every page with a filter bar + summary/metrics cards + paginated list was checked for the same bug _class_: the cards, the pagination footer/total, and the row list are each backed by a **separate** Postgres RPC (or query), and nothing guarantees those separate implementations apply every filter identically. When they drift, the visible rows can be correct while the surrounding numbers lie (or vice versa), which reads as "the data keeps disappearing."
> **Verification standard:** every finding below was reproduced with a live read-only SQL query against the dev DB (Supabase project `NxtExpenseTest`, `ibrvpangpuxiorspeffz`) — not just read from source. No files were modified and no migrations were applied as part of this audit. **Nothing in this document has been implemented.**

---

## Executive summary

| #   | Page                             | Finding                                                                                                                                                                              | Severity                                           | Confirmed?                                |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ----------------------------------------- |
| 1   | `/approved-history`              | Pagination footer ("total records" / "page X of Y") ignores the action-type / action-date filter entirely                                                                            | High                                               | ✅ live-verified, multiple filter values  |
| 2   | `/approved-history` + `/finance` | "Finance Action" filter dropdown options are sourced from the 200 most-recent `finance_actions` rows, not a distinct list — options flicker in/out as unrelated activity accumulates | High (matches the reported symptom almost exactly) | ✅ live-verified, reproduced in real time |
| 3   | `/claims`                        | Summary cards ignore **every** filter (status, work location, claim date) — the metrics RPC only accepts an employee id                                                              | High                                               | ✅ live-verified                          |
| 4   | `/approvals` (Pending queue)     | Employee-name search: the list RPC escapes `%`/`_` wildcard characters, the summary/metrics RPC does not                                                                             | Medium                                             | ✅ live-verified                          |
| —   | `/finance` (queue)               | Checked thoroughly — **no discrepancy found**. Kept as a reference example of the pattern done right (see "What good looks like" below).                                             | —                                                  | N/A                                       |

Findings 1–4 are independent of each other and can be fixed one at a time in any order.

---

## Finding 1 — `/approved-history`: total-record count and page count ignore the action filter

**What the user sees:** Filter bar set to "Finance Action: Finance Approved". Summary cards correctly show "Total History Records: 105" / "Approved History: 105". The table below the cards correctly lists only Finance-Approved rows. But the pagination footer under the table says "Page 1 of 58" / "2,853 total records" — implying there's ~27x more data than actually exists for this filter, even though the rows themselves are right.

**Root cause:** Three RPCs back this one page, called independently from `src/app/(app)/approved-history/page.tsx:148-154`:

- `get_finance_history_page` (the actual row list) — **correctly** scopes to the resolved action code(s) via `p_feed_action_codes` (`src/features/finance/data/repositories/finance-history.repository.ts:281-357`, SQL in `supabase/migrations/20260701100000_rewrite_get_finance_history_page_hydrated.sql`).
- `get_finance_history_metrics` (the summary cards) — **correctly** scopes via its `action_scope`/`date_scoped` CTEs (`supabase/migrations/20260630090000_fix_finance_history_metrics_p_has_filters.sql:78-116`).
- `get_finance_history_count` (the pagination footer's total) — **does not apply the action filter at all.** Its own migration comment says so explicitly: _"the action-code/feed-date filters are NOT applied to the count, matching the current TS which counts ALL actions of matched claims"_ (`supabase/migrations/20260618092300_get_finance_history_count.sql:1-9`). It only narrows by claim-level filters (employee/designation/location/date-on-claim) via `finance_filtered_claim_ids`, then counts **every** `finance_actions` row for those claims — regardless of action type.

Called from `getFinanceHistoryTotalCount()` (`finance-history.repository.ts:359-373`), which feeds `historyTotalCount` → `pagination.totalItems`/`totalPages` in `approved-history/page.tsx:166-169,272-273`.

**Live evidence** (project `ibrvpangpuxiorspeffz`):

| Filter (`p_action_filter`)                                              | `get_finance_history_metrics(...).total_count` (correct) | `get_finance_history_count(...)` (wrong)   |
| ----------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| `finance_approved`                                                      | 505                                                      | 3253                                       |
| `payment_released`                                                      | 2727                                                     | 3253                                       |
| `finance_rejected`                                                      | 21                                                       | 3253                                       |
| `rejected_allow_reclaim`                                                | 20                                                       | 20 _(coincidentally correct — see below)_  |
| _(no filter)_                                                           | 3273                                                     | 3273 _(correct — nothing to scope)_        |
| `dateFilterField='payment_released_date'`, range 2026-01-01..12-31      | 540                                                      | 940                                        |
| `dateFilterField='finance_approved_date'`, range 2026-01-01..12-31      | 105                                                      | 105 _(coincidentally correct — see below)_ |
| `workLocation` filter only (pure claim-level filter, no action scoping) | 4                                                        | 4 _(correct — no action scoping needed)_   |

Every value of `p_action_filter` produces the **same** wrong number (3253) from `get_finance_history_count` — because it isn't reading the argument for scoping at all, it's just "all actions of matched claims" regardless of which action was requested. The two "coincidentally correct" rows aren't evidence the bug is narrower than it looks — they happen to match because of the specific data shape:

- `rejected_allow_reclaim` narrows `finance_filtered_claim_ids` down to `allow_resubmit = true` claims, which are a small set that (currently) each have exactly one finance action.
- `finance_approved_date` narrows to claims whose **current status** is still finance-approved (not yet paid), which (currently) also tend to have exactly one finance action each.

Both are incidental to the current data, not guarantees — `payment_released_date` (154 vs 940 above) shows the general case where a claim has multiple finance actions and the miscount is obvious.

**Suggested fix direction:** Have `get_finance_history_count` delegate to `get_finance_history_metrics`'s `total_count` instead of re-implementing (wrongly) its own count. Both functions already receive byte-for-byte identical arguments from the TS layer (`buildHistoryResolverArgs()`), so this is a body-only change with no TS changes required. Verified live that this produces the correct number in every case tested above, including the no-filter case (3273 unchanged).

---

## Finding 2 — Finance Action filter dropdown options are a flickering recency sample, not a stable list

**What the user sees (most literal match to the reported symptom):** The "Finance Action" dropdown sometimes has 4 options (Finance Approved / Payment Released / Finance Rejected / Rejected & Allow Reclaim, as in the screenshot) and sometimes has fewer — an option can simply not be there to select.

**Root cause:** `getFinanceFilterOptions()` (`src/features/finance/data/repositories/finance-filter-options.repository.ts:34-142`, shared by both `/approved-history` and `/finance`) builds the dropdown's action options from:

```ts
supabase
  .from('finance_actions')
  .select('action')
  .order('acted_at', { ascending: false })
  .limit(200)
```

— i.e. **the 200 most recently acted-on finance actions**, deduplicated (line 57-61, 131-135). It is not a `select distinct action`. Whichever action types happen to be in that rolling window of the 200 most recent rows are the only ones offered; anything that isn't in that window (e.g. a less-frequent action type, or one that hasn't happened in a while relative to other, higher-volume action types) silently disappears from the dropdown. `hasRejectFinanceActionCode()` (line 144-149), which decides whether "Rejected & Allow Reclaim" is even offered, depends on the same 200-row sample.

**Live evidence** (project `ibrvpangpuxiorspeffz`), reproduced twice a few minutes apart during this audit:

- Whole-table action volume: `payment_released` = 2,727 rows, `finance_approved` = 505 rows, `finance_rejected` = 41 rows (all-time). `finance_rejected`'s most recent row is from **2026-07-01 08:27:42** — i.e. very close to "now" but clearly low-volume relative to `payment_released`.
- First sample of the last 200 rows (taken early in this audit): 130 `payment_released` + 70 `finance_approved` = 200. **Zero** `finance_rejected` rows in the window.
- Re-querying the exact same `order by acted_at desc limit 200` moments later showed the same shape — `finance_rejected` was out of the window both times.

Concretely: **at the time of this audit, reloading either `/approved-history` or `/finance` would render a "Finance Action" dropdown with "Finance Rejected" and "Rejected & Allow Reclaim" missing**, even though 41 finance-rejected actions genuinely exist and are fully queryable. As more `payment_released`/`finance_approved` actions accumulate (which happen at much higher volume), any lower-volume action type — plausibly `finance_approved` itself on a day with a burst of `payment_released` activity — can be pushed out of the top-200 window and vanish from the filter dropdown, then reappear later once a run of matching actions ages back into the window. This is a plausible literal explanation for "sometimes visible, sometimes not."

**Suggested fix direction:** Replace the recency-limited sample with either `select distinct action from finance_actions` (bounded by the small number of distinct action codes, not by recency) or derive the option list from the fixed domain of action codes in `claim_status_transitions`/`finance_action_buckets()` (the same "layer 0" source of truth already used for classification elsewhere in this codebase). Either removes the `.limit(200)` recency dependency entirely.

---

## Finding 3 — `/claims`: summary cards ignore every filter

**What the user sees:** Selecting any claim-status, work-location, or date filter changes the table and the pagination total correctly, but "Total Claims / Pending / Rejected / Rejected – Allow Reclaim" cards never move.

**Root cause:** The cards come from `getMyClaimsStats(supabase, employee.id)` (`src/features/claims/data/rpc/claim-metrics.rpc.ts:49-73`) → RPC `get_employee_claim_metrics(p_employee_id uuid)` (`supabase/migrations/20260429080441_remote_schema.sql:2695-2743`). **The SQL function's signature only takes an employee id — there is no status/location/date parameter to plumb filters through at all.** Called at `src/app/(app)/claims/page.tsx:130` as `getMyClaimsStats(supabase, employee.id)` — `normalizedFilters` is sitting right there in scope (used by the two calls next to it) but is never passed to this one.

By contrast, `getMyClaimsPaginated` and `getMyClaimsTotalCount` (`src/features/claims/data/repositories/claims.repository.ts:151-204, 305-326`) both route through the shared `applyMyClaimsFilters` helper (`:125-149`), so the list and the pagination total always agree with each other — only the cards are the odd one out. The CSV export (`src/app/(app)/claims/export/route.ts`) also reuses `getMyClaimsPaginated`, so the export is unaffected.

**Live evidence** (project `ibrvpangpuxiorspeffz`, employee `64694f0a-ecf6-41e2-a492-9ba21f834e99`, 361 total claims across 3 work locations):

| Scenario                                   | Cards (`get_employee_claim_metrics`)                          | List + pagination total (`applyMyClaimsFilters`)                                                                   |
| ------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| No filter                                  | total=361, pending=157, rejected=1, rejected-allow-reclaim=41 | 361                                                                                                                |
| Work-location filter applied               | **same as above, unchanged**                                  | 146 rows (pending=53, rejected=1, rejected-allow-reclaim=27 when the same bucket logic is scoped to that location) |
| Claim-status filter applied (`L1_PENDING`) | **same as above, unchanged**                                  | 92 rows                                                                                                            |

This is a total mismatch, not a partial one — the cards are simply disconnected from the filter bar.

**Suggested fix direction:** Extend `get_employee_claim_metrics` to accept the same status/work-location/date-range parameters `applyMyClaimsFilters` already resolves, and pass `normalizedFilters` into the `getMyClaimsStats` call at `claims/page.tsx:130`.

---

## Finding 4 — `/approvals` Pending queue: employee-name wildcard escaping mismatch

**What the user sees:** Searching Pending Approvals by an employee name containing `_` or `%` can show an empty table while the "Pending Approvals" card and the pagination total both report a non-zero count.

**Root cause:** Two RPCs back the Pending Approvals view:

- `get_pending_approvals` (the row list; `supabase/migrations/20260622092000_fix_get_pending_approvals_plan_degradation.sql:101-102`) — escapes wildcard metacharacters before the `ILIKE`: `e.employee_name ILIKE '%' || replace(replace(p_employee_name, '%', '\%'), '_', '\_') || '%'`.
- `get_pending_approval_scope_summary` (the card + pagination total; `supabase/migrations/20260429080441_remote_schema.sql:4025-4080`, line 4052) — does **not** escape: `e.employee_name ILIKE '%' || p_employee_name || '%'`.

An unescaped `_` in ILIKE matches _any single character_, so it over-matches; the escaped version only matches a literal underscore.

**Live evidence** (approver `mansoor@nxtwave.co.in`, real scope — 105 subordinates, no other filters), searching for employee name `Ankur_Hemant_Akre` (the real name is "Ankur Hemant Akre" — a space, not an underscore):

- `get_pending_approvals(...)` → **0 rows** (escaped `_` doesn't match the space; correctly, this exact string isn't anyone's name).
- `get_pending_approval_scope_summary(...)` with the identical scope → **`claim_count: 40, total_amount: 127800.00`** (the unescaped `_` silently matched 40 unrelated claims as a single-character wildcard).

**Suggested fix direction:** Apply the same `replace(replace(p_employee_name,'%','\%'),'_','\_')` escaping to `get_pending_approval_scope_summary`'s `ILIKE` clause that `get_pending_approvals` already uses.

**Also re-verified while here (not a new finding):** the previously-known `get_filtered_approval_history` stale 14-arg overload (`PGRST203` risk) is still fixed — exactly one 17-arg overload exists in the dev DB, confirming `20260622090000_drop_stale_approval_history_overload.sql` took effect and hasn't regressed.

---

## What good looks like — `/finance` (Finance Queue) has no equivalent bug

For completeness/contrast: the Finance Queue page's three RPCs (`get_finance_queue_page`, `get_finance_queue_count`, `get_finance_queue_metrics`) were checked with the same live-parity method across 8 filter combinations (none, employee-name substring, claim-date range, hod-approved-date range (IST), work location, owner designation, designation+submitted_at range, exact claim number) and **matched exactly in every case**. The reason: `get_finance_queue_page` and `get_finance_queue_count` both build their RPC args through one shared helper, `buildQueueRpcArgs()` (`src/features/finance/data/repositories/finance-queue.repository.ts:41-61`), so they're structurally incapable of drifting — and `get_finance_queue_metrics`'s "pending" bucket re-derives its status set with the exact same predicate used elsewhere (`getFinanceReviewStatusId()`), which was confirmed to currently resolve to exactly one status row. Also, `/finance` never sends an action-type filter at all (the action filter is disabled on this page — `showActionFilter={false}`), so Finding 1's failure mode structurally cannot occur here.

This is the pattern worth generalizing when fixing Findings 1, 3, and 4: **one shared arg-builder feeding every RPC that's supposed to represent the same filtered dataset**, rather than three independent re-implementations of "apply the filters."

---

## Out of scope / lower-confidence items not fully verified in this pass

- **Admin analytics dashboard / main Dashboard** (`admin-analytics-dashboard.tsx`, `dashboard-content.tsx`): these show summary cards but not a `totalItems`/`totalPages` paginated list on the same page, so the specific "list vs. count vs. metrics" triple-query bug class doesn't apply the same way. Not deeply audited — flag as a candidate for a follow-up pass if desired.
- **Admin analytics employee-name/id search** (`src/features/admin/data/queries/analytics-claims.query.ts:95`, `getEmployeeSearchIds`): caps matches at `.limit(200)` when resolving a name/id search to employee ids for filtering. A search term matching more than 200 employees would silently drop the rest from the analytics scope. Different bug class (truncation, not cross-query drift) and not confirmed against real data volumes — noted for awareness, not sized as a finding.
- **`/approvals` location-type resolution** (flagged by the approvals audit as theoretically possible but unconfirmed): `get_pending_approvals`'s inline location-type CTE doesn't filter `is_active`, while `getLocationIdsByApprovalLocationType` (used by the summary RPC) does. Currently there are zero inactive `work_locations` rows in dev, so this couldn't be empirically triggered — worth a quick recheck if/when an inactive work location ever exists.

---

## Next steps

This document is a findings report only — nothing has been implemented or applied. Suggested order if you want to proceed: Finding 1 (single SQL body change, already verified), Finding 4 (single SQL body change, already verified), Finding 3 (needs a new RPC signature + one call-site change), Finding 2 (needs a small RPC/query rewrite to drop the `.limit(200)` sampling). Let me know which to implement and I'll write the migrations/tests for review before anything is applied.
