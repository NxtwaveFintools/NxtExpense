'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

import { isAdminUser } from '@/features/admin/permissions'
import { getEmployeeByEmail } from '@/lib/services/employee-service'

export async function getAdminContext() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    throw new Error('Unauthorized request.')
  }

  const employee = await getEmployeeByEmail(supabase, user.email)
  if (!employee || !(await isAdminUser(supabase, employee))) {
    throw new Error('Admin access is required.')
  }

  return { supabase, user, employee }
}
