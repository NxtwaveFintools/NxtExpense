import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type CursorPaginationControlsProps = {
  backHref: string | null
  nextHref: string | null
  pageNumber: number
  totalPages?: number
  totalItems?: number
  className?: string
}

function mergeClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function CursorPaginationControls({
  backHref,
  nextHref,
  pageNumber,
  totalPages,
  totalItems,
  className,
}: CursorPaginationControlsProps) {
  const btnBase =
    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-150'
  const btnActive =
    'border-border bg-surface text-foreground shadow-xs hover:bg-muted hover:shadow-sm'
  const btnDisabled =
    'border-border/60 bg-muted text-muted-foreground cursor-not-allowed'

  const hasTotalPages = typeof totalPages === 'number' && totalPages > 0
  const hasTotalItems = typeof totalItems === 'number' && totalItems >= 0

  return (
    <nav
      aria-label="Pagination"
      className={mergeClassNames(
        'mb-4 flex items-center justify-between gap-2',
        className
      )}
    >
      {backHref ? (
        <Link href={backHref} className={`${btnBase} ${btnActive}`}>
          <ChevronLeft className="size-3.5" />
          Back
        </Link>
      ) : (
        <span className={`${btnBase} ${btnDisabled}`}>
          <ChevronLeft className="size-3.5" />
          Back
        </span>
      )}

      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Page <span className="text-foreground">{pageNumber}</span>
          {hasTotalPages ? (
            <>
              {' '}
              of <span className="text-foreground">{totalPages}</span>
            </>
          ) : null}
        </p>
        {hasTotalItems ? (
          <p className="text-xs text-muted-foreground">
            {totalItems} total record{totalItems === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>

      {nextHref ? (
        <Link href={nextHref} className={`${btnBase} ${btnActive}`}>
          Next
          <ChevronRight className="size-3.5" />
        </Link>
      ) : (
        <span className={`${btnBase} ${btnDisabled}`}>
          Next
          <ChevronRight className="size-3.5" />
        </span>
      )}
    </nav>
  )
}
