export function getClaimStatusDisplayLabel(
  statusCode: string | null | undefined,
  statusName: string | null | undefined
): string {
  if (statusName && statusName.trim()) {
    return statusName
  }

  return statusCode ?? ''
}

type ClaimStatusDisplayInput = {
  statusCode: string | null | undefined
  statusName: string | null | undefined
  statusDisplayColor?: string | null
  allowResubmit?: boolean | null
  allowResubmitStatusName?: string | null
  allowResubmitDisplayColor?: string | null
}

type ClaimStatusDisplay = {
  label: string
  colorToken: string
}

function normalizeColorToken(
  colorToken: string | null | undefined,
  fallback = 'neutral'
) {
  const normalized = colorToken?.trim()
  return normalized && normalized.length > 0 ? normalized : fallback
}

export function getClaimStatusDisplay({
  statusCode,
  statusName,
  statusDisplayColor,
  allowResubmit,
  allowResubmitStatusName,
  allowResubmitDisplayColor,
}: ClaimStatusDisplayInput): ClaimStatusDisplay {
  const defaultDisplay: ClaimStatusDisplay = {
    label: getClaimStatusDisplayLabel(statusCode, statusName),
    colorToken: normalizeColorToken(statusDisplayColor),
  }

  if (!allowResubmit) {
    return defaultDisplay
  }

  return {
    label: getClaimStatusDisplayLabel(
      statusCode,
      allowResubmitStatusName ?? statusName
    ),
    colorToken: normalizeColorToken(
      allowResubmitDisplayColor,
      defaultDisplay.colorToken
    ),
  }
}
