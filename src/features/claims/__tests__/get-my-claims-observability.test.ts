import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  getEmployeeRoles: vi.fn(),
  canAccessEmployeeClaimsFromRoles: vi.fn(),
  getMyClaimsPaginated: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/lib/services/employee-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/services/employee-service')
  >('@/lib/services/employee-service')

  return {
    ...actual,
    getEmployeeByEmail: mocks.getEmployeeByEmail,
    getEmployeeRoles: mocks.getEmployeeRoles,
  }
})

vi.mock('@/lib/services/approval-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/services/approval-service')
  >('@/lib/services/approval-service')

  return {
    ...actual,
    canAccessEmployeeClaimsFromRoles: mocks.canAccessEmployeeClaimsFromRoles,
  }
})

vi.mock('@/features/claims/queries', () => ({
  getMyClaimsPaginated: mocks.getMyClaimsPaginated,
}))

import { getMyClaimsAction } from '@/features/claims/actions'

describe('getMyClaimsAction observability', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'employee@nxtwave.co.in' } },
        }),
      },
    })

    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'emp-1' })
    mocks.getEmployeeRoles.mockResolvedValue([{ role_code: 'EMPLOYEE' }])
    mocks.canAccessEmployeeClaimsFromRoles.mockReturnValue(true)

    mocks.getMyClaimsPaginated.mockResolvedValue({
      data: [{ id: 'claim-1' }],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })
  })

  it('logs an error when paginated query fails and returns safe empty page fallback', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mocks.getMyClaimsPaginated.mockRejectedValueOnce(
      new Error('Database timeout')
    )

    const result = await getMyClaimsAction('cursor-1', 10)

    expect(result).toEqual({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })
    expect(errorSpy).toHaveBeenCalledWith(
      'getMyClaimsAction failed',
      expect.any(Error)
    )

    errorSpy.mockRestore()
  })

  it('does not emit catch telemetry for intentional unauthenticated fallback', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    const result = await getMyClaimsAction(null, 10)

    expect(result).toEqual({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })
    expect(errorSpy).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})
