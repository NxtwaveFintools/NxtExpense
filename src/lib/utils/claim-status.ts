export const VISIBLE_CLAIM_STATUS_CODES = [
  'L1_PENDING',
  'L1_REJECTED',
  'L2_PENDING',
  'L2_REJECTED',
  'L3_PENDING_FINANCE_REVIEW',
  'L3_REJECTED_FINANCE',
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
