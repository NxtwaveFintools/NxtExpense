/**
 * Auth Feature — Permissions
 *
 * This module defines authorization checks for the auth feature.
 * Corporate email domain enforcement is a foundational permission
 * re-exported here as the auth feature's public permission surface.
 *
 * Future role-based checks (e.g., "can this user approve claims?")
 * MUST be added here — NOT scattered across server actions or components.
 */
export {
  isAllowedCorporateEmail,
  getAllowedCorporateEmailHint,
} from '@/lib/auth/allowed-email-domains'
