import { describe, expect, it } from 'vitest'

import {
  PROTECTED_ROUTES,
  PUBLIC_AUTH_ROUTES,
  buildMiddlewareMatcher,
  isProtectedRoute,
  isPublicAuthRoute,
  matchesRoute,
} from '../route-access'

describe('matchesRoute', () => {
  it('matches an exact path', () => {
    expect(matchesRoute('/admin', '/admin')).toBe(true)
  })

  it('matches a nested sub-path', () => {
    expect(matchesRoute('/admin/employees', '/admin')).toBe(true)
  })

  it('does NOT match a path that merely shares a prefix segment', () => {
    expect(matchesRoute('/administrator', '/admin')).toBe(false)
  })

  it('does not match an unrelated path', () => {
    expect(matchesRoute('/login', '/admin')).toBe(false)
  })
})

describe('isProtectedRoute', () => {
  it.each([...PROTECTED_ROUTES])('treats %s as protected', (route) => {
    expect(isProtectedRoute(route)).toBe(true)
    expect(isProtectedRoute(`${route}/something`)).toBe(true)
  })

  it('does not protect the login route', () => {
    expect(isProtectedRoute('/login')).toBe(false)
  })
})

describe('isPublicAuthRoute', () => {
  it('treats /login as a public auth route', () => {
    expect(isPublicAuthRoute('/login')).toBe(true)
  })

  it('does not treat a protected route as public', () => {
    expect(isPublicAuthRoute('/dashboard')).toBe(false)
  })
})

describe('buildMiddlewareMatcher', () => {
  it('builds path-scoped matchers for protected routes plus exact public routes', () => {
    expect(buildMiddlewareMatcher()).toEqual([
      '/dashboard/:path*',
      '/claims/:path*',
      '/approvals/:path*',
      '/finance/:path*',
      '/approved-history/:path*',
      '/no-access',
      '/admin/:path*',
      '/login',
    ])
  })

  it('covers every protected and public route', () => {
    const matcher = buildMiddlewareMatcher()
    for (const route of [...PROTECTED_ROUTES, ...PUBLIC_AUTH_ROUTES]) {
      expect(matcher.some((entry) => entry.startsWith(route))).toBe(true)
    }
  })
})
