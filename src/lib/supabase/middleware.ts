import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { getSupabasePublicEnv } from '@/lib/supabase/env'

const SUPABASE_AUTH_COOKIE_SUFFIXES = [
  'auth-token',
  'auth-token-code-verifier',
] as const

const STALE_REFRESH_TOKEN_ERROR_CODES = new Set(['refresh_token_not_found'])

type SupabaseAuthErrorLike = {
  __isAuthError?: boolean
  code?: string
}

function getSupabaseProjectRef(supabaseUrl: string): string | null {
  try {
    const { hostname } = new URL(supabaseUrl)
    const [projectRef] = hostname.split('.')
    return projectRef?.trim() ? projectRef : null
  } catch {
    return null
  }
}

function isSupabaseAuthCookie(cookieName: string, projectRef: string): boolean {
  return SUPABASE_AUTH_COOKIE_SUFFIXES.some((suffix) => {
    const prefix = `sb-${projectRef}-${suffix}`
    return (
      cookieName === prefix ||
      cookieName.startsWith(`${prefix}.`) ||
      cookieName.startsWith(`${prefix}-`)
    )
  })
}

export function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse,
  supabaseUrl: string
): boolean {
  const projectRef = getSupabaseProjectRef(supabaseUrl)
  if (!projectRef) return false

  let didClearCookies = false

  request.cookies.getAll().forEach(({ name }) => {
    if (!isSupabaseAuthCookie(name, projectRef)) return

    request.cookies.delete(name)
    response.cookies.set({
      name,
      value: '',
      expires: new Date(0),
      maxAge: 0,
      path: '/',
    })
    didClearCookies = true
  })

  return didClearCookies
}

function isStaleRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const authError = error as SupabaseAuthErrorLike
  return (
    authError.__isAuthError === true &&
    STALE_REFRESH_TOKEN_ERROR_CODES.has(authError.code ?? '')
  )
}

type RefreshedSession = {
  response: NextResponse
  user: User | null
  supabase: SupabaseClient
  didResetSession: boolean
  didEncounterStaleRefreshToken: boolean
}

export async function refreshAuthSession(
  request: NextRequest
): Promise<RefreshedSession> {
  let response = NextResponse.next({ request })
  const { url, publishableKey } = getSupabasePublicEnv()

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  let user: User | null = null
  const didResetSession = false
  let didEncounterStaleRefreshToken = false

  try {
    const {
      data: { user: resolvedUser },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      if (!isStaleRefreshTokenError(error)) throw error
      didEncounterStaleRefreshToken = true
    } else {
      user = resolvedUser
    }
  } catch (error) {
    if (!isStaleRefreshTokenError(error)) throw error
    didEncounterStaleRefreshToken = true
  }

  return {
    response,
    user,
    supabase,
    didResetSession,
    didEncounterStaleRefreshToken,
  }
}
