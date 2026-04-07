export type ExportMode = 'page' | 'all'

export function getExportMode(value: string | null): ExportMode {
  return value === 'all' ? 'all' : 'page'
}

export function buildDatedCsvFilename(
  prefix: string,
  mode: ExportMode
): string {
  const dateStamp = new Date().toISOString().slice(0, 10)
  return `${prefix}-${mode}-${dateStamp}.csv`
}

export function createCsvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export function createCsvErrorResponse(
  error: unknown,
  fallback = 'Failed to export CSV.'
): Response {
  return new Response(error instanceof Error ? error.message : fallback, {
    status: 400,
  })
}

export function createExportRouteHandlers(
  handler: (request: Request) => Promise<Response>
): {
  GET: (request: Request) => Promise<Response>
  POST: (request: Request) => Promise<Response>
} {
  return {
    GET: handler,
    POST: handler,
  }
}
