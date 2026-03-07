import { Skeleton } from '@/components/ui/skeleton'

const HISTORY_ROW_COUNT = 5

export default function ClaimDetailLoading() {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <Skeleton className="h-7 w-32" />
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-[74px] rounded-lg" />
              ))}
            </div>
            <Skeleton className="mt-5 h-4 w-24" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-[46px] rounded-lg" />
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="mt-3 h-7 w-32 rounded-full" />
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <Skeleton className="h-6 w-28" />
              <div className="mt-3 space-y-3">
                {Array.from({ length: HISTORY_ROW_COUNT }).map((_, index) => (
                  <Skeleton key={index} className="h-[104px] rounded-lg" />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
