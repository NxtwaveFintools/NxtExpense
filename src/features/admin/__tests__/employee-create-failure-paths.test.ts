import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAdminContext: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/features/admin/actions/context', () => ({
  getAdminContext: mocks.getAdminContext,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}))

import { createEmployeeAction } from '@/features/admin/actions/employee-create-action'

const VALID_UUID = '5db22d75-b209-4f30-b5c8-f4f27ebee9e8'

describe('createEmployeeAction failure paths', () => {
  let rpcMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    rpcMock = vi.fn()

    mocks.getAdminContext.mockResolvedValue({
      supabase: {
        rpc: rpcMock,
      },
      user: { email: 'admin@nxtwave.co.in' },
      employee: { id: 'emp-admin-1' },
    })

    mocks.createSupabaseAdminClient.mockReturnValue({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'auth-user-created' } },
            error: null,
          }),
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    })
  })

  it('returns finalize-replacement error without deleting provisioned auth user when employee row already exists', async () => {
    const createUserMock = vi.fn().mockResolvedValue({
      data: { user: { id: 'auth-user-created' } },
      error: null,
    })
    const deleteUserMock = vi.fn().mockResolvedValue({ error: null })

    mocks.createSupabaseAdminClient.mockReturnValue({
      auth: {
        admin: {
          createUser: createUserMock,
          deleteUser: deleteUserMock,
        },
      },
    })

    rpcMock
      .mockResolvedValueOnce({
        data: [
          {
            id: 'emp-new',
            employee_id: 'NXT-EMP-9999',
            employee_name: 'Replacement Candidate',
            employee_email: 'replacement@nxtwave.co.in',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Replacement chain contains active claims.' },
      })

    const result = await createEmployeeAction({
      employeeId: 'NXT-EMP-9999',
      employeeName: 'Replacement Candidate',
      employeeEmail: 'replacement@nxtwave.co.in',
      loginPassword: 'Password@123',
      designationId: VALID_UUID,
      employeeStatusId: VALID_UUID,
      roleId: VALID_UUID,
      stateId: VALID_UUID,
      replacementEmployeeId: VALID_UUID,
      replacementReason: 'Backfill after transition',
      replacementConfirmation: 'CONFIRM',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain(
      'Unable to finalize replacement: Replacement chain contains active claims.'
    )
    expect(deleteUserMock).not.toHaveBeenCalled()
    expect(rpcMock).toHaveBeenNthCalledWith(
      1,
      'admin_create_employee_atomic',
      expect.any(Object)
    )
    expect(rpcMock).toHaveBeenNthCalledWith(
      2,
      'admin_finalize_employee_replacement_atomic',
      expect.any(Object)
    )
  })

  it('appends rollback failure details when auth cleanup RPC fails', async () => {
    const createUserMock = vi.fn().mockResolvedValue({
      data: { user: { id: 'auth-user-rollback' } },
      error: null,
    })
    const deleteUserMock = vi.fn().mockResolvedValue({
      error: { message: 'Network timeout during auth cleanup.' },
    })

    mocks.createSupabaseAdminClient.mockReturnValue({
      auth: {
        admin: {
          createUser: createUserMock,
          deleteUser: deleteUserMock,
        },
      },
    })

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'Employee ID already exists.' },
    })

    const result = await createEmployeeAction({
      employeeId: 'NXT-EMP-1004',
      employeeName: 'Rollback Candidate',
      employeeEmail: 'rollback@nxtwave.co.in',
      loginPassword: 'Password@123',
      designationId: VALID_UUID,
      employeeStatusId: VALID_UUID,
      roleId: VALID_UUID,
      stateId: VALID_UUID,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Employee ID already exists.')
    expect(result.error).toContain(
      'Auth rollback failed: Network timeout during auth cleanup.'
    )
    expect(deleteUserMock).toHaveBeenCalledWith('auth-user-rollback')
  })

  it('falls back to generic rollback failure suffix when delete user throws', async () => {
    const createUserMock = vi.fn().mockResolvedValue({
      data: { user: { id: 'auth-user-throw' } },
      error: null,
    })
    const deleteUserMock = vi.fn().mockRejectedValue(new Error('boom'))

    mocks.createSupabaseAdminClient.mockReturnValue({
      auth: {
        admin: {
          createUser: createUserMock,
          deleteUser: deleteUserMock,
        },
      },
    })

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'Employee status is invalid.' },
    })

    const result = await createEmployeeAction({
      employeeId: 'NXT-EMP-1005',
      employeeName: 'Rollback Throw Candidate',
      employeeEmail: 'rollback.throw@nxtwave.co.in',
      loginPassword: 'Password@123',
      designationId: VALID_UUID,
      employeeStatusId: VALID_UUID,
      roleId: VALID_UUID,
      stateId: VALID_UUID,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Employee status is invalid.')
    expect(result.error).toContain('Auth rollback failed.')
    expect(deleteUserMock).toHaveBeenCalledWith('auth-user-throw')
  })
})
