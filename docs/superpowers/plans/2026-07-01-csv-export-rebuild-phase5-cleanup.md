# CSV Export Rebuild — Phase 5: Cleanup + Final Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete every file the rebuild made obsolete, remove the now-dead `mode=page|all` machinery, and run full verification across the whole app (not just the export surface) to confirm nothing else depended on the old code.

**Prerequisite:** Phases 1–4 complete. All 6 export routes use `runCsvExport` + a `resolve*ExportContext`/`resolve*ExportPreflight` pair; `/api/exports/start` and `/api/exports/status` cover all 6 export types; every export button on every page is a `CsvExportButton`.

**Tech Stack:** Next.js, TypeScript, Vitest, ESLint, Playwright (smoke check only — no new e2e tests written in this phase).

---

### Task 1: Confirm nothing still references the files to be deleted

**Files:** none modified — this is a verification-only step gating the deletions in Task 2.

- [ ] **Step 1: Search for remaining references**

Run each of these and confirm the only hits are the files themselves (or their own test files, which are deleted alongside them in Task 2):

```bash
grep -rn "from '@/lib/utils/streaming-export'" src
grep -rn "from '@/components/ui/csv-export-actions'" src
grep -rn "from '@/features/finance/components/approved-history-export-actions'" src
grep -rn "getExportMode\|ExportMode" src/lib/utils/export-route.ts src/app
```

If any of these greps show a hit outside the expected set (i.e. a route or component this plan didn't migrate), STOP — that route was missed in Phases 2–4 and needs migrating before continuing this phase. Do not delete a file that still has a live caller.

- [ ] **Step 2: Confirm `createCsvResponse` and `createCsvErrorResponse` (the old, non-`requestId`-aware helpers) have no remaining callers**

```bash
grep -rn "createCsvResponse\b" src --include=*.ts --include=*.tsx
grep -rn "createCsvErrorResponse\b" src --include=*.ts --include=*.tsx
```

Every remaining hit should be inside `src/lib/utils/export-route.ts` (the definitions) and `src/lib/utils/__tests__/export-route.test.ts` (their tests) — every export route now uses `createCsvExportErrorResponse` and builds its success response via `runCsvExport`. If a route still calls the old `createCsvResponse`/`createCsvErrorResponse`, that route was missed in Phases 2–4.

---

### Task 2: Delete obsolete files

**Files:**

- Delete: `src/lib/utils/streaming-export.ts`
- Delete: `src/lib/utils/__tests__/streaming-export.test.ts`
- Delete: `src/components/ui/csv-export-actions.tsx`
- Delete: `src/features/finance/components/approved-history-export-actions.tsx`

- [ ] **Step 1: Delete the files**

```bash
git rm src/lib/utils/streaming-export.ts
git rm src/lib/utils/__tests__/streaming-export.test.ts
git rm src/components/ui/csv-export-actions.tsx
git rm src/features/finance/components/approved-history-export-actions.tsx
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: PASS. If any test file fails to resolve an import from one of the deleted files, that test file itself is stale and needs deleting too (it would have been testing the deleted component/module directly) — remove it and re-run.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(export): delete streaming-export.ts and the retired anchor-click export components"
```

---

### Task 3: Remove `mode=page|all` machinery from `export-route.ts`

**Files:**

- Modify: `src/lib/utils/export-route.ts`
- Modify: `src/lib/utils/__tests__/export-route.test.ts`

Removes `getExportMode`, the `ExportMode` type, and `createCsvResponse`/`createCsvErrorResponse` (confirmed dead in Task 1) — keeping `buildDatedCsvFilename` (now single-argument only), `createCsvExportErrorResponse`, and `createExportRouteHandlers`.

- [ ] **Step 1: Update the test file**

Replace the full contents of `src/lib/utils/__tests__/export-route.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import {
  buildDatedCsvFilename,
  createCsvExportErrorResponse,
  createExportRouteHandlers,
} from '@/lib/utils/export-route'

describe('export-route utilities', () => {
  it('builds a dated CSV filename with a prefix', () => {
    const filename = buildDatedCsvFilename('claims-history')

    expect(filename).toMatch(/^claims-history-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it('creates a csv export error response with an explicit status and always sets Content-Disposition', async () => {
    const response = createCsvExportErrorResponse(
      'Finance access is required.',
      403
    )

    expect(response.status).toBe(403)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
    await expect(response.text()).resolves.toBe('Finance access is required.')
  })

  it('returns GET/POST handlers that delegate to provided handler', async () => {
    const handler = vi.fn(
      async (request: Request) => new Response(request.method, { status: 200 })
    )

    const routes = createExportRouteHandlers(handler)

    const getResponse = await routes.GET(
      new Request('https://example.com', { method: 'GET' })
    )
    const postResponse = await routes.POST(
      new Request('https://example.com', { method: 'POST' })
    )

    expect(handler).toHaveBeenCalledTimes(2)
    expect(await getResponse.text()).toBe('GET')
    expect(await postResponse.text()).toBe('POST')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/__tests__/export-route.test.ts`
Expected: FAIL — `buildDatedCsvFilename` still requires a mode argument in its current signature (from Phase 2 Task 7, it's optional but still accepts one; this step is about removing `getExportMode`/`ExportMode`/`createCsvResponse`/`createCsvErrorResponse`, which the test file above no longer imports — the failure here should be a TypeScript/import error on those since they still exist in the source; proceed to Step 3).

- [ ] **Step 3: Update `export-route.ts`**

Replace the full contents of `src/lib/utils/export-route.ts`:

```ts
export function buildDatedCsvFilename(prefix: string): string {
  const dateStamp = new Date().toISOString().slice(0, 10)
  return `${prefix}-${dateStamp}.csv`
}

export function createCsvExportErrorResponse(
  message: string,
  status: number
): Response {
  return new Response(message, {
    status,
    headers: {
      'Content-Disposition': 'attachment; filename="export-error.txt"',
    },
  })
}

export function createExportRouteHandlers(
  handler: (request: Request) => Promise<Response>
): {
  GET: (request: Request) => Promise<Response>
  POST: (request: Request) => Promise<Response>
} {
  return {
    GET: handler,
    POST: handler,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/utils/__tests__/export-route.test.ts`
Expected: PASS (all 3 tests).

Run the full suite to confirm no other file depended on the removed `getExportMode`/`ExportMode`/`createCsvResponse`/`createCsvErrorResponse` exports:

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no errors. (Task 1's grep already confirmed this ahead of time — this is the final confirmation.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/export-route.ts src/lib/utils/__tests__/export-route.test.ts
git commit -m "chore(export): remove mode=page|all machinery and the retired csv response helpers"
```

---

### Task 4: Full-app verification

**Files:** none modified — this task is pure verification.

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: PASS, 0 failures.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: PASS, 0 errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS, 0 errors. (If `knip`-style unused-export warnings surface for anything besides the intentionally-deleted files, investigate before proceeding — don't suppress.)

- [ ] **Step 4: Manual smoke test of all 6 exports**

Run: `npm run dev`. For each of the 6 export buttons across `/claims`, `/approvals`, `/finance`, `/approved-history` (×3 buttons):

1. Click it — confirm real progress (percentage climbing, not an instant fake animation).
2. Confirm the downloaded CSV opens correctly and its row count roughly matches the page's displayed total.
3. Temporarily revoke the signed-in test account's access for one export type (e.g. change designation for the claims CSV block-list) and confirm clicking Export shows a toast, not a navigation, and the app is still fully usable afterward.

- [ ] **Step 5: Playwright smoke run**

Run: `npm run test:e2e:smoke`
Expected: PASS. This doesn't specifically test exports (no e2e export tests exist yet — out of scope for this rebuild per the spec, and Phase 2's design doc already flagged Playwright's interaction with the export flow as something to watch, not something this plan set out to add coverage for), but confirms the broader app still boots and logs in correctly after these changes.

- [ ] **Step 6: Final commit (if Steps 1–5 required any fixes)**

```bash
git add -A
git commit -m "chore(export): final verification pass for CSV export rebuild"
```

If Steps 1–5 required no fixes, there is nothing to commit here — the prior commits in this phase already cover the work.

---

## Phase 5 / Overall Rebuild Completion Checklist

- [ ] `streaming-export.ts`, `csv-export-actions.tsx`, `approved-history-export-actions.tsx` deleted.
- [ ] `mode=page|all`, `getExportMode`, `ExportMode`, and the old `createCsvResponse`/`createCsvErrorResponse` helpers removed.
- [ ] Every one of the 6 export routes: uses a `resolve*ExportContext`/`resolve*ExportPreflight` pair, streams via `runCsvExport`, is registered in `/api/exports/start`.
- [ ] Every export button on every page is a `CsvExportButton`: real progress, toast-based errors, no page navigation on failure, zero client-side buffering of CSV bytes in any browser.
- [ ] `bc-expense-export` confirmed at 2 queries/chunk (was 3); `finance/export` confirmed at 1 query/chunk (was 2) — both via the dedicated tests added in Phases 3–4.
- [ ] Full test suite, type check, and lint all pass.
- [ ] No new background workers, job tables, storage buckets, or application-side ID materialization were introduced anywhere in this rebuild — verified by inspection: the only new persistent-ish state is the in-process `export-progress-registry.ts` Map, which is transient (swept on a TTL) and explicitly scoped as acceptable in the design spec.
