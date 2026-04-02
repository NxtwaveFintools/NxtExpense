import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  buildOAuthRedirectUrl: vi.fn(),
  hasInvalidAzureTenantPath: vi.fn(),
  isDevelopmentAuthEnabled: vi.fn(),
  appendAllowedDomainHint: vi.fn(),
  getAllowedCorporateEmailHint: vi.fn(),
  isAllowedCorporateEmail: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  signInWithOAuthMutation: vi.fn(),
  signInWithPasswordMutation: vi.fn(),
  signOutMutation: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

vi.mock('@/lib/auth/auth-helpers', () => ({
  buildOAuthRedirectUrl: mocks.buildOAuthRedirectUrl,
  hasInvalidAzureTenantPath: mocks.hasInvalidAzureTenantPath,
  isDevelopmentAuthEnabled: mocks.isDevelopmentAuthEnabled,
}))

vi.mock('@/lib/auth/allowed-email-domains', () => ({
  appendAllowedDomainHint: mocks.appendAllowedDomainHint,
  getAllowedCorporateEmailHint: mocks.getAllowedCorporateEmailHint,
  isAllowedCorporateEmail: mocks.isAllowedCorporateEmail,
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/auth/mutations', () => ({
  signInWithOAuthMutation: mocks.signInWithOAuthMutation,
  signInWithPasswordMutation: mocks.signInWithPasswordMutation,
  signOutMutation: mocks.signOutMutation,
}))

import {
  signInWithMicrosoftAction,
  signInWithPasswordAction,
  signOutAction,
} from '@/features/auth/actions'

describe('auth actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.buildOAuthRedirectUrl.mockResolvedValue(
      'http://localhost:3000/dashboard'
    )
    mocks.hasInvalidAzureTenantPath.mockReturnValue(false)
    mocks.isDevelopmentAuthEnabled.mockReturnValue(true)
    mocks.appendAllowedDomainHint.mockImplementation(
      (message: string) => message
    )
    mocks.getAllowedCorporateEmailHint.mockResolvedValue('@nxtwave.co.in')
    mocks.isAllowedCorporateEmail.mockResolvedValue(true)

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { email: 'employee@nxtwave.co.in' },
          },
        }),
      },
    })

    mocks.signInWithOAuthMutation.mockResolvedValue({
      url: 'https://example.microsoft.com/oauth',
      errorCode: null,
    })

    mocks.signInWithPasswordMutation.mockResolvedValue({ errorMessage: null })
    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'emp-1' })
    mocks.signOutMutation.mockResolvedValue(undefined)
  })

  it('should redirect to Microsoft OAuth URL when initialization succeeds', async () => {
    // Act + Assert
    await expect(signInWithMicrosoftAction()).rejects.toThrow(
      'REDIRECT:https://example.microsoft.com/oauth'
    )
  })

  it('should redirect to login error when OAuth start fails', async () => {
    // Arrange
    mocks.signInWithOAuthMutation.mockResolvedValue({
      url: null,
      errorCode: 'oauth_start_failed',
    })

    // Act + Assert
    await expect(signInWithMicrosoftAction()).rejects.toThrow(
      'REDIRECT:/login?error=oauth_start_failed'
    )
  })

  it('should redirect to tenant URL error when Azure URL is invalid', async () => {
    // Arrange
    mocks.hasInvalidAzureTenantPath.mockReturnValue(true)

    // Act + Assert
    await expect(signInWithMicrosoftAction()).rejects.toThrow(
      'REDIRECT:/login?error=azure_tenant_url_invalid'
    )
  })

  it('should reject password login when development auth is disabled', async () => {
    // Arrange
    mocks.isDevelopmentAuthEnabled.mockReturnValue(false)
    const formData = new FormData()
    formData.set('email', 'employee@nxtwave.co.in')
    formData.set('password', 'Password@123')

    // Act
    const result = await signInWithPasswordAction({} as never, formData)

    // Assert
    expect(result.error).toContain('Email/password login is disabled')
  })

  it('should validate credentials before hitting auth mutations', async () => {
    // Arrange
    const formData = new FormData()
    formData.set('email', 'not-an-email')
    formData.set('password', '123456')

    // Act
    const result = await signInWithPasswordAction({} as never, formData)

    // Assert
    expect(result.error).toBe('Enter a valid email address.')
    expect(mocks.signInWithPasswordMutation).not.toHaveBeenCalled()
  })

  it('should return auth mutation error for wrong password', async () => {
    // Arrange
    mocks.signInWithPasswordMutation.mockResolvedValue({
      errorMessage: 'Invalid login credentials',
    })
    const formData = new FormData()
    formData.set('email', 'employee@nxtwave.co.in')
    formData.set('password', 'wrong-password')

    // Act
    const result = await signInWithPasswordAction({} as never, formData)

    // Assert
    expect(result.error).toBe('Invalid login credentials')
  })

  it('should block disallowed corporate domains and sign out user', async () => {
    // Arrange
    mocks.isAllowedCorporateEmail.mockResolvedValue(false)
    mocks.appendAllowedDomainHint.mockReturnValue(
      'Only corporate emails are allowed. Allowed domains: @nxtwave.co.in'
    )

    const formData = new FormData()
    formData.set('email', 'user@gmail.com')
    formData.set('password', 'Password@123')

    // Act
    const result = await signInWithPasswordAction({} as never, formData)

    // Assert
    expect(result.error).toBe(
      'Only corporate emails are allowed. Allowed domains: @nxtwave.co.in'
    )
    expect(mocks.signOutMutation).toHaveBeenCalledTimes(1)
  })

  it('should handle domain validation errors gracefully and sign out', async () => {
    // Arrange
    mocks.isAllowedCorporateEmail.mockRejectedValue(
      new Error('Domain table unavailable')
    )
    const formData = new FormData()
    formData.set('email', 'employee@nxtwave.co.in')
    formData.set('password', 'Password@123')

    // Act
    const result = await signInWithPasswordAction({} as never, formData)

    // Assert
    expect(result.error).toBe(
      'Unable to validate corporate email domain. Please try again.'
    )
    expect(mocks.signOutMutation).toHaveBeenCalledTimes(1)
  })

  it('should redirect to dashboard on successful password login', async () => {
    // Arrange
    const formData = new FormData()
    formData.set('email', 'employee@nxtwave.co.in')
    formData.set('password', 'Password@123')

    // Act + Assert
    await expect(
      signInWithPasswordAction({} as never, formData)
    ).rejects.toThrow('REDIRECT:/dashboard')
  })

  it('should sign out and redirect to login signed_out message', async () => {
    // Act + Assert
    await expect(signOutAction()).rejects.toThrow(
      'REDIRECT:/login?message=signed_out'
    )
    expect(mocks.signOutMutation).toHaveBeenCalledTimes(1)
  })
})
