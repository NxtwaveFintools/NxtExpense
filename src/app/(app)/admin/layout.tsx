import { redirect } from 'next/navigation'
import { Shield } from 'lucide-react'

import { AdminNav } from '@/features/admin/components/admin-nav'
import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getEmployeeByEmail,
  getEmployeeRoles,
} from '@/lib/services/employee-service'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireCurrentUser('/login')
  const supabase = await createSupabaseServerClient()
  const employee = await getEmployeeByEmail(supabase, user.email ?? '')
  if (!employee) redirect('/login')

  const roles = await getEmployeeRoles(supabase, employee.id)
  const isAdmin = roles.some((role) => role.is_admin_role)
  if (!isAdmin) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
            <Shield className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">
              Manage system configuration and employees
            </p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-border bg-surface p-3 self-start md:sticky md:top-24">
            <AdminNav />
          </aside>
          <section className="animate-fade-in">{children}</section>
        </div>
      </div>
    </main>
  )
}
