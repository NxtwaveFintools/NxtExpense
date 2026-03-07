import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-8 w-36" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <Skeleton className="h-6 w-44" />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Skeleton className="h-18.5 rounded-lg" />
            <Skeleton className="h-18.5 rounded-lg" />
            <Skeleton className="h-18.5 rounded-lg" />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-34 rounded-2xl" />
          <Skeleton className="h-34 rounded-2xl" />
          <Skeleton className="h-34 rounded-2xl" />
        </section>
      </div>
    </main>
  )
}
