import { Skeleton } from '@/components/ui/skeleton'

type TableSkeletonProps = {
  columns?: number
  rows?: number
  minWidthClassName?: string
}

/**
 * Skeleton placeholder for a results table. Mirrors the table markup used in
 * the route `loading.tsx` files so the shimmer matches the real layout.
 */
export function TableSkeleton({
  columns = 8,
  rows = 5,
  minWidthClassName = 'min-w-215',
}: TableSkeletonProps) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <Skeleton className="mb-4 h-7 w-36" />
      <div className="overflow-x-auto">
        <table
          className={`w-full ${minWidthClassName} border-collapse text-sm`}
        >
          <thead>
            <tr className="border-b border-border text-left">
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index} className="px-3 py-2">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/70">
                {Array.from({ length: columns }).map((__, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-3">
                    <Skeleton className="h-4 w-full max-w-28" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-end">
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </section>
  )
}

type AnalyticsCardsSkeletonProps = {
  count?: number
  columnsClassName?: string
}

/**
 * Skeleton placeholder for the `ClaimAnalyticsCards` strip.
 */
export function AnalyticsCardsSkeleton({
  count = 4,
  columnsClassName = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4',
}: AnalyticsCardsSkeletonProps) {
  return (
    <div className={columnsClassName}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-border bg-surface p-5"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-4 w-20" />
        </div>
      ))}
    </div>
  )
}
