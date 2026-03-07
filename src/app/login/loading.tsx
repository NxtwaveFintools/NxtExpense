import { Skeleton } from '@/components/ui/skeleton'

export default function LoginLoading() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="absolute right-4 top-4 md:right-8 md:top-8">
        <Skeleton className="size-9 rounded-lg" />
      </div>

      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-7 shadow-sm">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-8 w-44" />
        <Skeleton className="mt-2 h-4 w-32" />

        <div className="mt-6 space-y-5">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-px w-full rounded-none" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-3 w-64" />
        </div>
      </section>
    </main>
  )
}
