export const STATUS_PILL_STYLE_BY_TOKEN: Record<string, string> = {
  gray: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  yellow: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  green:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  red: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  orange:
    'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
  neutral: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400',
}

const DEFAULT_STATUS_TOKEN = 'neutral'

export function getStatusPillColorClass(token: string | null | undefined) {
  return STATUS_PILL_STYLE_BY_TOKEN[token ?? DEFAULT_STATUS_TOKEN]
}
