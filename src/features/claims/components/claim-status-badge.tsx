import { getClaimStatusDisplayLabel } from '@/lib/utils/claim-status'
import { getStatusPillColorClass } from '@/components/ui/status-color-tokens'

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
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusPillColorClass(colorToken)}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {getClaimStatusDisplayLabel(null, statusName)}
    </span>
  )
}
