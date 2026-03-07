import { Skeleton } from '@/components/ui/skeleton'

export default function RootLoading() {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-8 w-56" />
          <Skeleton className="mt-2 h-4 w-72" />
        </section>
      </div>
    </main>
  )
}
