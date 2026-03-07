import { ClaimList } from '@/features/claims/components/claim-list'
import { getMyClaimsAction } from '@/features/claims/actions'
import { getClaimStatusCatalog } from '@/features/claims/queries'
import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canAccessEmployeeClaims } from '@/features/employees/permissions'
import { getEmployeeByEmail } from '@/features/employees/queries'
import {
  buildCursorNavigationLinks,
  decodeCursorTrail,
} from '@/lib/utils/pagination'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type ClaimsPageProps = {
  searchParams?: Promise<{
    cursor?: string
    trail?: string
  }>
}

export default async function ClaimsPage({ searchParams }: ClaimsPageProps) {
  const user = await requireCurrentUser('/login')
  const supabase = await createSupabaseServerClient()
  const employee = await getEmployeeByEmail(supabase, user.email ?? '')

  if (!employee || !canAccessEmployeeClaims(employee)) {
    redirect('/dashboard')
  }

  const resolvedSearch = await searchParams
  const cursor = resolvedSearch?.cursor ?? null
  const trail = decodeCursorTrail(resolvedSearch?.trail ?? null)

  const [claims, statusCatalog] = await Promise.all([
    getMyClaimsAction(cursor),
    getClaimStatusCatalog(supabase),
  ])

  const claimsPagination = buildCursorNavigationLinks({
    pathname: '/claims',
    query: resolvedSearch,
    cursorKey: 'cursor',
    trailKey: 'trail',
    currentCursor: cursor,
    currentTrail: trail,
    nextCursor: claims.nextCursor,
  })

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="inline-flex rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium"
          >
            Back to Dashboard
          </Link>
        </div>
        <ClaimList
          claims={claims}
          statusCatalog={statusCatalog}
          pagination={claimsPagination}
        />
      </div>
    </main>
  )
}
