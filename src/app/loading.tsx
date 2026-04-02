import { Skeleton } from '@/components/ui/skeleton'

export default function RootLoading() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-lg border border-border bg-surface p-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-9 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
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
          <Skeleton className="h-6 w-40" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
