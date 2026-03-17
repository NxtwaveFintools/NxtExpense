'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  FileText,
  Users,
  MapPin,
  Car,
  DollarSign,
  Briefcase,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: <BarChart3 className="size-4" /> },
  {
    href: '/admin/claims',
    label: 'Claim Operations',
    icon: <FileText className="size-4" />,
  },
  {
    href: '/admin/employees',
    label: 'Employees',
    icon: <Users className="size-4" />,
  },
  {
    href: '/admin/designations',
    label: 'Designations',
    icon: <Briefcase className="size-4" />,
  },
  {
    href: '/admin/expense-rates',
    label: 'Expense Rates',
    icon: <DollarSign className="size-4" />,
  },
  {
    href: '/admin/vehicle-types',
    label: 'Vehicle Types',
    icon: <Car className="size-4" />,
  },
  {
    href: '/admin/work-locations',
    label: 'Work Locations',
    icon: <MapPin className="size-4" />,
  },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Admin navigation"
      className="flex flex-row gap-1 overflow-x-auto md:flex-col md:gap-0.5"
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/admin' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              isActive
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span
              className={isActive ? 'text-primary' : 'text-muted-foreground'}
            >
              {item.icon}
            </span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
