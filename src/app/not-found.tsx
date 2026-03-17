import Link from 'next/link'
import { FileQuestion, ArrowRight } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md space-y-6 text-center animate-scale-in">
        <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-amber-500/10">
          <FileQuestion className="size-9 text-amber-500" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Page not found
          </h1>
          <p className="text-sm text-muted-foreground">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md active:scale-[0.98]"
        >
          Go to Dashboard
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}
