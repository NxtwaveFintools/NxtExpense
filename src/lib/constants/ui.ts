// ────────────────────────────────────────────────────────────
// Shared UI timing constants
//
// Operational UX knobs that are shared across components. Single-use timings
// (a toast duration, an offline-notice delay) stay co-located in their own
// component; only values reused across multiple components live here.
// ────────────────────────────────────────────────────────────

/**
 * Debounce applied to free-text filter inputs (employee name, claim number)
 * before they trigger a query, so typing doesn't fire a request per keystroke.
 */
export const INPUT_DEBOUNCE_MS = 400
