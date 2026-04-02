import { Skeleton } from '@/components/ui/skeleton'

const HISTORY_ROW_COUNT = 6

export default function ApprovedHistoryLoading() {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-surface p-6">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="mt-3 h-4 w-28" />
            <Skeleton className="mt-2 min-h-20 w-full rounded-lg" />
            <div className="mt-3 flex items-center gap-2">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-64" />
            </div>

            <div className="mt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <Skeleton className="h-4 w-56" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-28 rounded-lg" />
                  <Skeleton className="h-9 w-36 rounded-lg" />
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-surface p-5"
              >
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-2 h-8 w-20" />
                <Skeleton className="mt-2 h-4 w-24" />
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-border bg-surface p-6">
            <Skeleton className="mb-4 h-7 w-36" />

            <div className="overflow-x-auto">
              <table className="w-full min-w-245 border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {Array.from({ length: 9 }).map((_, index) => (
                      <th key={index} className="px-3 py-2">
                        <Skeleton className="h-4 w-20" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: HISTORY_ROW_COUNT }).map(
                    (_, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-border/70">
                        {Array.from({ length: 9 }).map((__, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-3">
                            <Skeleton className="h-4 w-full max-w-28" />
                          </td>
                        ))}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
