import type {
  ClaimStatus,
  ClaimStatusCatalogItem,
} from '@/features/claims/types'

const COLOR_STYLE_BY_TOKEN: Record<string, string> = {
  slate: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  red: 'bg-red-500/10 text-red-700 dark:text-red-300',
  indigo: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  teal: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  neutral: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
}

export function ClaimStatusBadge({
  status,
  statusCatalog,
}: {
  status: ClaimStatus
  statusCatalog?: ClaimStatusCatalogItem[]
}) {
  const matchedStatus = statusCatalog?.find((entry) => entry.status === status)
  const colorToken = matchedStatus?.color_token ?? 'neutral'

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        COLOR_STYLE_BY_TOKEN[colorToken] ?? COLOR_STYLE_BY_TOKEN.neutral
      }`}
    >
      {matchedStatus?.display_label ?? status.replaceAll('_', ' ')}
    </span>
  )
}
