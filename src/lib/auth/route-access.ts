// ────────────────────────────────────────────────────────────
// Route-access policy — single source of truth for middleware routing
//
// `middleware.ts` previously maintained these route lists twice: once as the
// runtime `protectedRoutes` / `publicAuthRoutes` arrays and again as the static
// `config.matcher`. Next.js requires `config.matcher` to be a statically
// analysable literal, so it still lives inline in middleware.ts — but the route
// lists and matching logic now live here, and `buildMiddlewareMatcher()` lets a
// test assert the inline matcher never drifts from these lists.
// ────────────────────────────────────────────────────────────

export const PROTECTED_ROUTES = [
  '/dashboard',
  '/claims',
  '/approvals',
  '/finance',
  '/approved-history',
  '/no-access',
  '/admin',
] as const

export const PUBLIC_AUTH_ROUTES = ['/login'] as const

// Routes that gate middleware on an exact path only (no nested sub-paths).
const EXACT_MATCH_ROUTES = new Set<string>(['/no-access'])

export function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => matchesRoute(pathname, route))
}

export function isPublicAuthRoute(pathname: string): boolean {
  return PUBLIC_AUTH_ROUTES.some((route) => matchesRoute(pathname, route))
}

/**
 * Derives the Next.js middleware matcher from the route lists. Protected routes
 * gate their whole sub-tree (`/route/:path*`) except those that are exact-only;
 * public auth routes are matched exactly. Kept in sync with the literal in
 * `middleware.ts` via `route-access.test.ts`.
 */
export function buildMiddlewareMatcher(): string[] {
  const protectedMatchers = PROTECTED_ROUTES.map((route) =>
    EXACT_MATCH_ROUTES.has(route) ? route : `${route}/:path*`
  )

  return [...protectedMatchers, ...PUBLIC_AUTH_ROUTES]
}
