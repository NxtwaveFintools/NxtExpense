export type AdminActionResult = {
  ok: boolean
  error: string | null
}

export type AdminRollbackResult = AdminActionResult & {
  claimId?: string
  rolledBackTo?: string
}

export type AdminReassignResult = AdminActionResult & {
  impactedClaims?: number
}
