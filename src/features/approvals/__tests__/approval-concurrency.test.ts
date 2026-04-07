import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  getClaimWithOwner: vi.fn(),
  getClaimAvailableActions: vi.fn(),
  getMaxNotesLength: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
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
  }
})

vi.mock('@/features/approvals/queries', () => ({
  getClaimWithOwner: mocks.getClaimWithOwner,
}))

vi.mock('@/features/claims/queries', () => ({
  getClaimAvailableActions: mocks.getClaimAvailableActions,
  getClaimAvailableActionsByClaimIds: vi.fn(),
}))

vi.mock('@/lib/services/system-settings-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/services/system-settings-service')
  >('@/lib/services/system-settings-service')

  return {
    ...actual,
    getMaxNotesLength: mocks.getMaxNotesLength,
  }
})

import { submitApprovalAction } from '@/features/approvals/actions'

describe('submitApprovalAction concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'approver-1',
      employee_email: 'approver@nxtwave.co.in',
    })

    mocks.getClaimWithOwner.mockResolvedValue({
      claim: { id: 'claim-1' },
      owner: { id: 'owner-1' },
    })

    mocks.getClaimAvailableActions.mockResolvedValue([
      {
        action: 'approved',
        display_label: 'Approve',
        require_notes: false,
        supports_allow_resubmit: false,
        actor_scope: 'approver',
      },
    ])

    mocks.getMaxNotesLength.mockResolvedValue(500)
  })

  it('returns one success and one workflow conflict for concurrent approvals on same claim', async () => {
    let actionCommitCount = 0

    const rpcMock = vi.fn().mockImplementation(async () => {
      actionCommitCount += 1

      if (actionCommitCount === 1) {
        return { error: null }
      }

      return {
        error: { message: 'Claim is not at your approval level.' },
      }
    })

    mocks.createSupabaseServerClient.mockImplementation(async () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'approver@nxtwave.co.in' } },
        }),
      },
      rpc: rpcMock,
    }))

    const payload = {
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'approved',
      notes: 'Concurrent action test',
    } as const

    const [first, second] = await Promise.all([
      submitApprovalAction(payload),
      submitApprovalAction(payload),
    ])

    const allResults = [first, second]
    const successCount = allResults.filter((result) => result.ok).length
    const failedResults = allResults.filter((result) => !result.ok)

    expect(successCount).toBe(1)
    expect(failedResults).toHaveLength(1)
    expect(failedResults[0]?.error).toBe('Claim is not at your approval level.')
    expect(rpcMock).toHaveBeenCalledTimes(2)
  })
})
