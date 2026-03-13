import { redirect } from 'next/navigation'

import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { isAdminUser } from '@/features/admin/permissions'
import { AdminNav } from '@/features/admin/components/admin-nav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireCurrentUser()
  const supabase = await createSupabaseServerClient()
  const employee = await getEmployeeByEmail(supabase, user.email!)

  if (!employee || !(await isAdminUser(supabase, employee))) {
    redirect('/dashboard')
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Manage system configuration, employee data, and claim operations.
        </p>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-56">
          <AdminNav />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
