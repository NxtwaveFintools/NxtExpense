import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { getExportProgress } from '@/lib/utils/export-progress-registry'

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const requestId = url.searchParams.get('requestId')

  if (!requestId) {
    return Response.json({ error: 'requestId is required.' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return Response.json({ error: 'Unauthorized request.' }, { status: 401 })
  }

  const employee = await getEmployeeByEmail(supabase, user.email)

  if (!employee) {
    return Response.json({ error: 'Not found.' }, { status: 404 })
  }

  const entry = getExportProgress(requestId, employee.id)

  if (!entry) {
    return Response.json({ error: 'Not found.' }, { status: 404 })
  }

  return Response.json({
    status: entry.status,
    rowsSent: entry.rowsSent,
    estimatedTotalRows: entry.estimatedTotalRows,
    errorMessage: entry.errorMessage,
  })
}
