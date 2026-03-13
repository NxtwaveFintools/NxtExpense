import type { ClaimStatusCatalogItem } from '@/features/claims/types'
import { getClaimStatusDisplayLabel } from '@/lib/utils/claim-status'

// Keys match display_color values stored in claim_statuses.display_color
const COLOR_STYLE_BY_TOKEN: Record<string, string> = {
  gray: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  yellow: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  neutral: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
}

export function ClaimStatusBadge({
  statusName,
  statusDisplayColor,
}: {
  statusName: string
  statusDisplayColor: string
}) {
  const colorToken = statusDisplayColor

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${
        COLOR_STYLE_BY_TOKEN[colorToken] ?? COLOR_STYLE_BY_TOKEN.neutral
      }`}
    >
      {getClaimStatusDisplayLabel(null, statusName)}
    </span>
  )
}
