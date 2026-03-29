import { canAccessEmployeeClaims } from '@/features/employees/permissions'
import { getEmployeeByEmail } from '@/lib/services/employee-service'
import {
  getAllFilteredMyClaims,
  getMyClaimsPaginated,
} from '@/features/claims/queries'
import {
  buildMyClaimsCsv,
  normalizeMyClaimsFilters,
} from '@/features/claims/utils/filters'
import { canDownloadClaimsCsv } from '@/features/claims/utils/export-permissions'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const PAGE_EXPORT_LIMIT = 10

type ExportMode = 'page' | 'all'

function getExportMode(value: string | null): ExportMode {
  return value === 'all' ? 'all' : 'page'
}

async function handleExportRequest(request: Request) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams

    const mode = getExportMode(searchParams.get('mode'))
    const cursor = searchParams.get('cursor')
    const filters = normalizeMyClaimsFilters({
      claimStatus: searchParams.get('claimStatus') ?? undefined,
      workLocation: searchParams.get('workLocation') ?? undefined,
      claimDateFrom: searchParams.get('claimDateFrom') ?? undefined,
      claimDateTo: searchParams.get('claimDateTo') ?? undefined,
    })

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return new Response('Unauthorized request.', { status: 401 })
    }

    const employee = await getEmployeeByEmail(supabase, user.email)
    if (!employee || !(await canAccessEmployeeClaims(supabase, employee))) {
      return new Response('Claims access is required.', { status: 403 })
    }

    if (!canDownloadClaimsCsv(employee.designations?.designation_name)) {
      return new Response('CSV export is not available for your designation.', {
        status: 403,
      })
    }

    const rows =
      mode === 'all'
        ? await getAllFilteredMyClaims(supabase, employee.id, filters)
        : (
            await getMyClaimsPaginated(
              supabase,
              employee.id,
              cursor,
              PAGE_EXPORT_LIMIT,
              filters
            )
          ).data

    const csv = buildMyClaimsCsv(rows)
    const dateStamp = new Date().toISOString().slice(0, 10)
    const filename = `my-claims-${mode}-${dateStamp}.csv`

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : 'Failed to export CSV.',
      { status: 400 }
    )
  }
}

export async function GET(request: Request) {
  return handleExportRequest(request)
}

export async function POST(request: Request) {
  return handleExportRequest(request)
}
