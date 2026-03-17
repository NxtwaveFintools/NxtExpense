import { Skeleton } from '@/components/ui/skeleton'

const TABLE_ROW_COUNT = 6

export default function ClaimsLoading() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>

        <section className="rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-10 w-28 rounded-md" />
          </div>

          <div className="overflow-x-auto px-2 pb-2">
            <table className="w-full min-w-230 text-sm">
              <thead>
                <tr className="border-b border-border">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <th key={index} className="px-4 py-3">
                      <Skeleton className="h-4 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Array.from({ length: TABLE_ROW_COUNT }).map((_, rowIndex) => (
                  <tr key={rowIndex}>
                    {Array.from({ length: 6 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-3.5">
                        <Skeleton className="h-4 w-full max-w-28" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
