import Link from 'next/link'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAdminSummary } from '@/features/admin/queries'

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient()
  const summary = await getAdminSummary(supabase)

  const cards = [
    {
      label: 'Total Employees',
      value: summary.totalEmployees,
      href: '/admin/employees',
    },
    {
      label: 'Total Claims',
      value: summary.totalClaims,
      href: '/admin/claims',
    },
    {
      label: 'Pending Claims',
      value: summary.pendingClaims,
      href: '/admin/claims',
    },
    {
      label: 'Designations',
      value: summary.designationCount,
      href: '/admin/designations',
    },
    {
      label: 'Work Locations',
      value: summary.workLocationCount,
      href: '/admin/work-locations',
    },
    {
      label: 'Vehicle Types',
      value: summary.vehicleTypeCount,
      href: '/admin/vehicle-types',
    },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Overview</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/30 hover:bg-muted"
          >
            <p className="text-sm text-foreground/60">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {card.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/claims"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Claim Operations
          </Link>
          <Link
            href="/admin/employees"
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Manage Employees
          </Link>
          <Link
            href="/admin/expense-rates"
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Expense Rates
          </Link>
        </div>
      </div>
    </div>
  )
}
