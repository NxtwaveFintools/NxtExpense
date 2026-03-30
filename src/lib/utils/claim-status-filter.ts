import { getClaimStatusDisplayLabel } from '@/lib/utils/claim-status'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CLAIM_STATUS_FILTER_ALLOW_RESUBMIT_SUFFIX = 'allow_resubmit'
const CLAIM_STATUS_FILTER_SEPARATOR = ':'

export type ParsedClaimStatusFilter = {
  statusId: string
  allowResubmitOnly: boolean
}

export type ClaimStatusFilterOptionSource = {
  id: string
  status_code: string
  status_name: string
  allow_resubmit_status_name: string | null
}

export type ClaimStatusFilterOption = {
  value: string
  label: string
  statusId: string
  allowResubmitOnly: boolean
}

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

function normalizeFilterValue(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

export function buildClaimStatusFilterValue(
  statusId: string,
  allowResubmitOnly = false
): string {
  return allowResubmitOnly
    ? `${statusId}${CLAIM_STATUS_FILTER_SEPARATOR}${CLAIM_STATUS_FILTER_ALLOW_RESUBMIT_SUFFIX}`
    : statusId
}

export function parseClaimStatusFilterValue(
  value: string | null | undefined
): ParsedClaimStatusFilter | null {
  const normalized = normalizeFilterValue(value)

  if (!normalized) {
    return null
  }

  if (isUuid(normalized)) {
    return {
      statusId: normalized,
      allowResubmitOnly: false,
    }
  }

  const [statusId, suffix, ...extraParts] = normalized.split(
    CLAIM_STATUS_FILTER_SEPARATOR
  )

  if (
    extraParts.length > 0 ||
    suffix !== CLAIM_STATUS_FILTER_ALLOW_RESUBMIT_SUFFIX
  ) {
    return null
  }

  if (!isUuid(statusId)) {
    return null
  }

  return {
    statusId,
    allowResubmitOnly: true,
  }
}

export function isValidClaimStatusFilterValue(
  value: string | null | undefined
): boolean {
  return parseClaimStatusFilterValue(value) !== null
}

export function buildClaimStatusFilterOptions(
  rows: ClaimStatusFilterOptionSource[]
): ClaimStatusFilterOption[] {
  const options: ClaimStatusFilterOption[] = []

  for (const row of rows) {
    options.push({
      value: buildClaimStatusFilterValue(row.id),
      label: getClaimStatusDisplayLabel(row.status_code, row.status_name),
      statusId: row.id,
      allowResubmitOnly: false,
    })

    const allowResubmitLabel = row.allow_resubmit_status_name?.trim() ?? ''

    if (!allowResubmitLabel) {
      continue
    }

    options.push({
      value: buildClaimStatusFilterValue(row.id, true),
      label: getClaimStatusDisplayLabel(row.status_code, allowResubmitLabel),
      statusId: row.id,
      allowResubmitOnly: true,
    })
  }

  return options
}
