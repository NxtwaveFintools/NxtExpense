'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const adminLinks = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/claims', label: 'Claim Operations' },
  { href: '/admin/employees', label: 'Employees' },
  { href: '/admin/designations', label: 'Designations' },
  { href: '/admin/work-locations', label: 'Work Locations' },
  { href: '/admin/vehicle-types', label: 'Vehicle Types' },
  { href: '/admin/expense-rates', label: 'Expense Rates' },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
      {adminLinks.map((link) => {
        const isActive =
          link.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(link.href)

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-foreground/60 hover:bg-muted hover:text-foreground'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
