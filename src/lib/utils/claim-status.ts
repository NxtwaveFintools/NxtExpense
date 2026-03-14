export const VISIBLE_CLAIM_STATUS_CODES = [
  'L1_PENDING',
  'L2_PENDING',
  'L3_PENDING_FINANCE_REVIEW',
  'REJECTED',
  'APPROVED',
] as const

export function getClaimStatusDisplayLabel(
  statusCode: string | null | undefined,
  statusName: string | null | undefined
): string {
  if (statusCode === 'APPROVED' || statusName === 'Approved') {
    return 'Finance Approved'
  }

  if (statusName && statusName.trim()) {
    return statusName
  }

  return statusCode ?? ''
}
