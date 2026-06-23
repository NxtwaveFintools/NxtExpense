// ────────────────────────────────────────────────────────────
// Authentication policy constants
//
// The password length bounds are shared by every schema that validates a
// password (login + admin employee provisioning) so the policy lives in one
// place instead of being repeated as bare `min(6)` / `max(72)` literals.
// ────────────────────────────────────────────────────────────

export const MIN_PASSWORD_LENGTH = 6

// bcrypt only hashes the first 72 bytes of input; anything longer is silently
// truncated, so we reject it up front rather than accept a misleading password.
export const MAX_PASSWORD_LENGTH = 72
