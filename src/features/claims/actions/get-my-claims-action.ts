'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getEmployeeByEmail,
  getEmployeeRoles,
} from '@/lib/services/employee-service'
import { canAccessEmployeeClaimsFromRoles } from '@/lib/services/approval-service'
import { getMyClaimsPaginated } from '@/features/claims/queries'

type MyClaimsActionResult = Awaited<ReturnType<typeof getMyClaimsPaginated>>

function createEmptyClaimsPage(limit: number): MyClaimsActionResult {
  return {
    data: [],
    hasNextPage: false,
    nextCursor: null,
    limit,
  }
}

export async function getMyClaimsAction(
  cursor: string | null,
  limit = 10
): Promise<MyClaimsActionResult> {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return createEmptyClaimsPage(limit)
    }

    const employee = await getEmployeeByEmail(supabase, user.email)
    if (!employee) {
      return createEmptyClaimsPage(limit)
    }

    const roles = await getEmployeeRoles(supabase, employee.id)
    if (!canAccessEmployeeClaimsFromRoles(roles)) {
      return createEmptyClaimsPage(limit)
    }

    return await getMyClaimsPaginated(supabase, employee.id, cursor, limit)
  } catch (error) {
    console.error('getMyClaimsAction failed', error)
    return createEmptyClaimsPage(limit)
  }
}
