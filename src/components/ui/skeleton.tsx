type SkeletonProps = {
  className?: string
}

function mergeClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={mergeClassNames('skeleton-block rounded-md', className)}
    />
  )
}
