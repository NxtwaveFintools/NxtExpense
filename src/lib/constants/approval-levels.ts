// ────────────────────────────────────────────────────────────
// Approval-level model — single source of truth
//
// The expense approval chain is a fixed-arity domain model: levels 1 → 2 → 3.
// Level 3 is the FINAL approval level (the finance-facing stage). Individual
// designation flows MAY be shorter (e.g. the "Direct" flow uses fewer levels),
// but the level NUMBERS are always drawn from this set.
//
// This invariant is enforced by the data across three tables —
// `designation_approval_flow.required_approval_levels`,
// `claim_statuses.approval_level`, and `approver_selection_rules.approval_level`
// (verified 2026-06-23: only {1, 2, 3} present in all three).
//
// These constants exist so the magic numbers `3` and `[1, 2]` stop being
// duplicated as bare, unexplained literals across the admin, approvals, and
// finance features. If the business ever changes the chain depth, change it
// HERE — and the type-checker/tests will surface every dependent site.
// ────────────────────────────────────────────────────────────

export const APPROVAL_LEVELS = [1, 2, 3] as const

export type ApprovalLevel = (typeof APPROVAL_LEVELS)[number]

export const MIN_APPROVAL_LEVEL: ApprovalLevel = APPROVAL_LEVELS[0]

// The highest level is also the FINAL, finance-facing approval stage — the two
// concepts coincide by the domain invariant described above. Consumers that
// mean "the last stage" should use `isFinalApprovalLevel`; consumers that mean
// "the validation upper bound" use this constant directly.
export const MAX_APPROVAL_LEVEL: ApprovalLevel =
  APPROVAL_LEVELS[APPROVAL_LEVELS.length - 1]

/**
 * Every level that is NOT the final/finance-facing level — i.e. the stages that
 * are still handled inside the approver queue rather than at finance.
 */
export const INTERMEDIATE_APPROVAL_LEVELS: readonly number[] =
  APPROVAL_LEVELS.filter((level) => level !== MAX_APPROVAL_LEVEL)

export function isFinalApprovalLevel(
  level: number | null | undefined
): boolean {
  return level === MAX_APPROVAL_LEVEL
}

export function isIntermediateApprovalLevel(
  level: number | null | undefined
): boolean {
  return level != null && INTERMEDIATE_APPROVAL_LEVELS.includes(level)
}
