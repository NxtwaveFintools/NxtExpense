type SupabaseAuthErrorLike = {
  __isAuthError?: boolean
  code?: string | null
  name?: string
  status?: number
  message?: string
}

const STALE_REFRESH_TOKEN_ERROR_CODES = new Set(['refresh_token_not_found'])
const MISSING_SESSION_ERROR_CODES = new Set([
  'auth_session_missing',
  'session_not_found',
])
const MISSING_SESSION_ERROR_NAMES = new Set(['authsessionmissingerror'])
const STALE_REFRESH_TOKEN_MESSAGE_HINTS = [
  'invalid refresh token',
  'refresh token not found',
] as const
const MISSING_SESSION_MESSAGE_HINTS = ['auth session missing'] as const

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function includesAnyHint(
  normalizedValue: string,
  hints: readonly string[]
): boolean {
  return hints.some((hint) => normalizedValue.includes(hint))
}

export function isSupabaseAuthError(
  error: unknown
): error is SupabaseAuthErrorLike {
  if (!error || typeof error !== 'object') return false

  const authError = error as SupabaseAuthErrorLike
  if (authError.__isAuthError === true) return true

  const normalizedName = normalize(authError.name)
  return (
    normalizedName === 'authsessionmissingerror' ||
    normalizedName.endsWith('authapierror') ||
    normalizedName.endsWith('autherror')
  )
}

export function isStaleRefreshTokenError(error: unknown): boolean {
  if (!isSupabaseAuthError(error)) return false

  const code = normalize(error.code)
  if (STALE_REFRESH_TOKEN_ERROR_CODES.has(code)) return true

  const message = normalize(error.message)
  return (
    message.length > 0 &&
    includesAnyHint(message, STALE_REFRESH_TOKEN_MESSAGE_HINTS)
  )
}

export function isMissingAuthSessionError(error: unknown): boolean {
  if (!isSupabaseAuthError(error)) return false

  const code = normalize(error.code)
  if (MISSING_SESSION_ERROR_CODES.has(code)) return true

  const name = normalize(error.name)
  if (MISSING_SESSION_ERROR_NAMES.has(name)) return true

  const message = normalize(error.message)
  return (
    message.length > 0 &&
    includesAnyHint(message, MISSING_SESSION_MESSAGE_HINTS)
  )
}

export function isRecoverableAuthSessionError(error: unknown): boolean {
  return isStaleRefreshTokenError(error) || isMissingAuthSessionError(error)
}
