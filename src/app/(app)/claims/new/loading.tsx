import { Skeleton } from '@/components/ui/skeleton'

export default function NewClaimLoading() {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-4">
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="space-y-4 rounded-lg border border-border bg-surface p-6">
            <header className="space-y-2">
              <Skeleton className="h-8 w-60" />
              <Skeleton className="h-4 w-80" />
            </header>

            <div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-10 w-full rounded-lg" />
            </div>

            <div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-10 w-full rounded-lg" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-2 h-10 w-full rounded-lg" />
              </div>
              <div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-2 h-10 w-full rounded-lg" />
              </div>
              <div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-2 h-10 w-full rounded-lg" />
              </div>
              <div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-2 h-10 w-full rounded-lg" />
              </div>
            </div>

            <div className="border-t border-border pt-2">
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
          </section>

          <aside className="rounded-lg border border-border bg-surface p-4">
            <Skeleton className="h-4 w-32" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <Skeleton className="h-5 w-full" />
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
