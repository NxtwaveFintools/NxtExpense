import { Skeleton } from '@/components/ui/skeleton'

const TABLE_ROW_COUNT = 6

export default function ClaimsLoading() {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-4">
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-230 border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <th key={index} className="px-3 py-2">
                      <Skeleton className="h-4 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: TABLE_ROW_COUNT }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-border/70">
                    {Array.from({ length: 7 }).map((__, cellIndex) => (
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
      </div>
    </main>
  )
}
