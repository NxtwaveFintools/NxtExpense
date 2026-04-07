import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  isFinanceTeamMember: vi.fn(),
  getClaimAvailableActions: vi.fn(),
  getClaimAvailableActionsByClaimIds: vi.fn(),
  getMaxNotesLength: vi.fn(),
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

vi.mock('@/features/finance/permissions', () => ({
  isFinanceTeamMember: mocks.isFinanceTeamMember,
}))

vi.mock('@/features/claims/queries', () => ({
  getClaimAvailableActions: mocks.getClaimAvailableActions,
  getClaimAvailableActionsByClaimIds: mocks.getClaimAvailableActionsByClaimIds,
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

import { submitFinanceAction } from '@/features/finance/actions'

describe('submitFinanceAction concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'finance-emp-1',
      employee_email: 'finance@nxtwave.co.in',
    })
    mocks.isFinanceTeamMember.mockResolvedValue(true)
    mocks.getMaxNotesLength.mockResolvedValue(500)

    mocks.getClaimAvailableActions.mockResolvedValue([
      {
        action: 'finance_approved',
        display_label: 'Finance Approved',
        require_notes: false,
        supports_allow_resubmit: false,
        actor_scope: 'finance',
      },
      {
        action: 'finance_rejected',
        display_label: 'Reject',
        require_notes: true,
        supports_allow_resubmit: true,
        actor_scope: 'finance',
      },
    ])
  })

  it('returns one success and one conflict when approve/reject race on same claim', async () => {
    let actionCommitCount = 0

    const rpcMock = vi.fn().mockImplementation(async () => {
      actionCommitCount += 1

      if (actionCommitCount === 1) {
        return { error: null }
      }

      return {
        error: {
          message: 'Claim has already transitioned to a terminal state.',
        },
      }
    })

    mocks.createSupabaseServerClient.mockImplementation(async () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'finance@nxtwave.co.in' } },
        }),
      },
      rpc: rpcMock,
    }))

    const [approveResult, rejectResult] = await Promise.all([
      submitFinanceAction({
        claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
        action: 'finance_approved',
      }),
      submitFinanceAction({
        claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
        action: 'finance_rejected',
        notes: 'Reject attempt in concurrent transition check',
      }),
    ])

    const allResults = [approveResult, rejectResult]
    const successCount = allResults.filter((result) => result.ok).length
    const failedResults = allResults.filter((result) => !result.ok)

    expect(successCount).toBe(1)
    expect(failedResults).toHaveLength(1)
    expect(failedResults[0]?.error).toBe(
      'Claim has already transitioned to a terminal state.'
    )
    expect(rpcMock).toHaveBeenCalledTimes(2)
  })
})
