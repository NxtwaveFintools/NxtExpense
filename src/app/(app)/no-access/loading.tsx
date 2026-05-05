import { Skeleton } from '@/components/ui/skeleton'

export default function NoAccessLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <Skeleton className="mx-auto size-16 rounded-2xl" />
        <Skeleton className="mx-auto h-8 w-48" />
        <Skeleton className="mx-auto h-4 w-72" />
        <Skeleton className="mx-auto h-10 w-32 rounded-md" />
      </div>
    </main>
  )
}
