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
    <nav aria-label="Main navigation" className="flex items-center gap-1">
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
            className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
              isActive
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            {link.label}
            {isActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-primary" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
