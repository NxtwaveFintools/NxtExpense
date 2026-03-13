import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-500/10">
          <FileQuestion className="size-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          Page not found
        </h1>
        <p className="text-sm text-foreground/70">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
