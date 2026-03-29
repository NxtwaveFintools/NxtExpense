const CSV_EXPORT_BLOCKED_DESIGNATIONS = new Set([
  'student relationship officer',
  'area business head',
  'sro',
  'abh',
])

export function canDownloadClaimsCsv(
  designationName: string | null | undefined
): boolean {
  const normalized = designationName?.trim().toLowerCase()

  if (!normalized) {
    return true
  }

  return !CSV_EXPORT_BLOCKED_DESIGNATIONS.has(normalized)
}
