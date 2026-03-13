'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

type NavLink = {
  href: string
  label: string
}

type AppNavLinksProps = {
  links: NavLink[]
}

const SOURCE_TO_HREF: Record<string, string> = {
  approvals: '/approvals',
  finance: '/finance',
}

export function AppNavLinks({ links }: AppNavLinksProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const fromSource = searchParams.get('from')

  return (
    <nav aria-label="Main navigation" className="flex items-center gap-0.5">
      {links.map((link) => {
        // When viewing a claim from another section (approvals/finance),
        // highlight that source section instead of "My Claims".
        const overrideHref = fromSource ? SOURCE_TO_HREF[fromSource] : null
        const isClaimDetailFromOtherSection =
          overrideHref &&
          pathname.startsWith('/claims/') &&
          pathname !== '/claims'

        let isActive: boolean
        if (isClaimDetailFromOtherSection) {
          isActive = link.href === overrideHref
        } else {
          isActive =
            pathname === link.href ||
            (link.href !== '/dashboard' && pathname.startsWith(link.href + '/'))
        }

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-foreground/10 text-foreground'
                : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
