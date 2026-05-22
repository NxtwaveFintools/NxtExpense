import type { BulkImportSummary } from '@/features/admin/components/state-city-types'

type Props = {
  summary: BulkImportSummary
}

function preview(items: string[] | undefined, max = 8): string {
  const values = (items ?? []).slice(0, max)
  if (values.length === 0) {
    return 'None'
  }

  return values.join(', ')
}

export function CityBulkImportSummary({ summary }: Props) {
  return (
    <div
      className="space-y-1 rounded-md border border-border bg-background p-3 text-xs"
      data-testid="admin-bulk-city-summary"
    >
      <p className="font-semibold text-foreground">
        Last import for {summary.stateName}: {summary.insertedCount} inserted,{' '}
        {summary.duplicateCount} duplicates, {summary.invalidCount} invalid.
      </p>
      <p className="text-muted-foreground">
        Inserted: {preview(summary.insertedCities)}
      </p>
      <p className="text-muted-foreground">
        Duplicates: {preview(summary.duplicateCities)}
      </p>
      <p className="text-muted-foreground">
        Invalid: {preview(summary.invalidCities)}
      </p>
    </div>
  )
}
