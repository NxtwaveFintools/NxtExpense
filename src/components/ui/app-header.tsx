import Link from 'next/link'

import { getCurrentUser } from '@/features/auth/queries'
import {
  getEmployeeByEmail,
  getEmployeeRoles,
  hasApproverAssignments,
} from '@/lib/services/employee-service'
import { getDashboardAccessFromRoles } from '@/lib/services/approval-service'
import { LogoutButton } from '@/features/auth/components/logout-button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { AppNavLinks } from '@/components/ui/app-nav-links'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function AppHeader() {
  const user = await getCurrentUser()
  if (!user?.email) return null

  const supabase = await createSupabaseServerClient()
  const employee = await getEmployeeByEmail(supabase, user.email)
  if (!employee) return null

  const [roles, canViewApprovals] = await Promise.all([
    getEmployeeRoles(supabase, employee.id),
    hasApproverAssignments(supabase, employee.employee_email),
  ])

  const access = getDashboardAccessFromRoles(roles, canViewApprovals)

  type NavLink = { href: string; label: string }
  const navLinks: NavLink[] = [
    { href: '/dashboard', label: 'Dashboard' },
    ...(access.canViewClaims ? [{ href: '/claims', label: 'My Claims' }] : []),
    ...(access.canViewApprovals
      ? [{ href: '/approvals', label: 'Approvals' }]
      : []),
    ...(access.canViewFinanceQueue
      ? [{ href: '/finance', label: 'Finance' }]
      : []),
    ...(access.canViewAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ]

  const initials = employee.employee_name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header
      role="banner"
      className="sticky top-0 z-30 border-b border-border bg-surface shadow-xs"
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-5">
          <Link
            href="/dashboard"
            className="font-display text-base font-extrabold tracking-tight text-primary transition-colors hover:text-primary-hover"
          >
            NxtExpense
          </Link>
          <div className="hidden sm:block w-px h-6 bg-border" />
          <div className="hidden sm:block">
            <AppNavLinks links={navLinks} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            aria-label="Open profile"
            title="Profile"
            className="hidden sm:flex items-center gap-3 rounded-xl px-3 py-1.5 transition-colors hover:bg-muted group"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
              {initials}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight text-foreground group-hover:text-foreground">
                {employee.employee_name}
              </p>
              <p className="text-xs text-muted-foreground leading-tight">
                {employee.designations?.designation_name ?? ''}
              </p>
            </div>
          </Link>
          <div className="hidden sm:block w-px h-6 bg-border" />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>

      {/* Mobile nav */}
      <div className="sm:hidden border-t border-border px-4 py-2">
        <AppNavLinks links={navLinks} />
      </div>
    </header>
  )
}
