// ────────────────────────────────────────────────────────────
// React Query cache timings — shared tiers
//
// These are operational tuning knobs, not business rules. Named tiers replace
// the scattered millisecond literals (`30_000`, `5 * 60 * 1000`, …) that were
// duplicated across query call sites, so the whole app shares one vocabulary
// for "how fresh must this data be" and "how long to retain it". Tune here.
// ────────────────────────────────────────────────────────────

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS

/** How long fetched data is treated as fresh before a background refetch. */
export const QUERY_STALE_TIME = {
  /** Frequently-changing UI data — filter options, name suggestions. */
  REALTIME: 30 * SECOND_MS,
  /** Dashboards and metrics that tolerate a short lag. */
  SHORT: 60 * SECOND_MS,
  /** Slow-moving reference data — lookup tables, rate snapshots. */
  MEDIUM: 5 * MINUTE_MS,
} as const

/** How long inactive cache entries are retained before garbage collection. */
export const QUERY_GC_TIME = {
  SHORT: 2 * MINUTE_MS,
  MEDIUM: 5 * MINUTE_MS,
  LONG: 10 * MINUTE_MS,
} as const
