export function getClaimStatusDisplayLabel(
  statusCode: string | null | undefined,
  statusName: string | null | undefined
): string {
  if (statusName && statusName.trim()) {
    return statusName
  }

  return statusCode ?? ''
}
