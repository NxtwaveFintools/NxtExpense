import Link from 'next/link'

type CursorPaginationControlsProps = {
  backHref: string | null
  nextHref: string | null
  pageNumber: number
  className?: string
}

function mergeClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function CursorPaginationControls({
  backHref,
  nextHref,
  pageNumber,
  className,
}: CursorPaginationControlsProps) {
  return (
    <div
      className={mergeClassNames(
        'mb-4 flex items-center justify-between gap-2',
        className
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium"
        >
          Back
        </Link>
      ) : (
        <span className="rounded-lg border border-border bg-muted px-3 py-2 text-xs font-medium text-foreground/50">
          Back
        </span>
      )}

      <p className="text-sm font-medium text-foreground/80">
        Page {pageNumber}
      </p>

      {nextHref ? (
        <Link
          href={nextHref}
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium"
        >
          Next
        </Link>
      ) : (
        <span className="rounded-lg border border-border bg-muted px-3 py-2 text-xs font-medium text-foreground/50">
          Next
        </span>
      )}
    </div>
  )
}
