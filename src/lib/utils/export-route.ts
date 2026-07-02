export function buildDatedCsvFilename(prefix: string): string {
  const dateStamp = new Date().toISOString().slice(0, 10)
  return `${prefix}-${dateStamp}.csv`
}

export function createCsvExportErrorResponse(
  message: string,
  status: number
): Response {
  return new Response(message, {
    status,
    headers: {
      'Content-Disposition': 'attachment; filename="export-error.txt"',
    },
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
