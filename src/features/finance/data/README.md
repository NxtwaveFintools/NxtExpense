# Finance data layer — read architecture

## Bounded-memory invariant (permanent)

**No Finance read path may materialize claim-ID collections whose size grows with
claim count.**

- **Allowed:** ≤ `limit` IDs (one page), ≤ `limit + 1` IDs (page + has-next probe),
  employee-count aggregates, and other fixed-size sets.
- **Not allowed:** all matching claim IDs, cursor-collect loops that accumulate IDs,
  cross-page ID accumulation, or fanning a large ID array into chunked `.in('id', [...])`
  re-queries.

Every Finance read path is:

```
Parameters → SQL resolver → SQL RPC → Bounded enrichment
```

and never:

```
Parameters → Collect all IDs → Chunk → Merge → Re-query
```

Any future feature that needs claim filtering must compose through
`finance_filtered_claim_ids()` (the SQL resolver) or a resolver-backed RPC. It must
**not** introduce application-side claim-ID collection.

## How this is enforced

- `scripts/check-no-claim-id-collection.mjs` fails the build if the collection
  anti-pattern (e.g. `SAFE_IN_BATCH_SIZE`, `collect*ClaimIds`, `intersectClaimIds`)
  reappears in the Finance read paths. It runs as part of `npm test`.
- `src/features/finance/__tests__/finance-list-parity.test.ts` (opt-in `PARITY=1`)
  is the durable regression contract: it pages the resolver and the keyset page RPCs
  and asserts they match an independent, hand-built reference set — guarding the
  resolver against future drift.

## History

This invariant was established by the Finance DB-side filtering work (Phases 1–5).
Phases 1–4 moved all claim-scope resolution into SQL (`finance_filtered_claim_ids`
plus resolver-backed metrics/page RPCs). Phase 5 removed the transitional in-memory
collection code and added the guard above so the anti-pattern cannot return.
