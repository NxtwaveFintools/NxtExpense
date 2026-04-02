import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  getClaimWithOwner: vi.fn(),
  isFinanceTeamMember: vi.fn(),
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

vi.mock('@/features/finance/permissions', () => ({
  isFinanceTeamMember: mocks.isFinanceTeamMember,
}))

import { submitApprovalAction } from '@/features/approvals/actions'
import { submitFinanceAction } from '@/features/finance/actions'
import { getClaimStatusDisplayLabel } from '@/lib/utils/claim-status'
import {
  applyApprovalTransition,
  applyFinanceTransition,
  createInitialWorkflowClaim,
  FINANCE_APPROVER_EMAILS,
  getWorkflowConfig,
  MANSOOR_EMAIL,
  resubmitRejectedClaim,
  type WorkflowClaimState,
} from '@/features/claims/workflow/__tests__/workflow-test-kit'

type ApprovalRpcParams = {
  p_claim_id: string
  p_action: 'approved' | 'rejected'
  p_notes: string | null
  p_allow_resubmit: boolean
}

type FinanceRpcParams = {
  p_claim_id: string
  p_action:
    | 'finance_approved'
    | 'payment_released'
    | 'released'
    | 'finance_rejected'
  p_notes: string | null
  p_allow_resubmit: boolean
}

function getMockAvailableActions() {
  return [
    {
      action: 'approved',
      display_label: 'Approve',
      require_notes: false,
      supports_allow_resubmit: false,
      actor_scope: 'approver',
    },
    {
      action: 'rejected',
      display_label: 'Reject',
      require_notes: true,
      supports_allow_resubmit: true,
      actor_scope: 'approver',
    },
    {
      action: 'finance_approved',
      display_label: 'Finance Approved',
      require_notes: false,
      supports_allow_resubmit: false,
      actor_scope: 'finance',
    },
    {
      action: 'payment_released',
      display_label: 'Payment Released',
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
  ]
}

let activeUserEmail = ''
let claimSequence = 101
let claimStore = new Map<string, WorkflowClaimState>()

function nextClaimId(): string {
  const suffix = claimSequence.toString(16).padStart(12, '0')
  claimSequence += 1
  return `00000000-0000-4000-8000-${suffix}`
}

function setActor(email: string): void {
  activeUserEmail = email.trim().toLowerCase()
}

function addClaim(submitterEmail: string): WorkflowClaimState {
  const claim = createInitialWorkflowClaim(nextClaimId(), submitterEmail)
  claimStore.set(claim.id, claim)
  return claim
}

async function approveClaim(claimId: string, approverEmail: string) {
  setActor(approverEmail)
  return submitApprovalAction({
    claimId,
    action: 'approved',
    notes: 'Approved in direct flow.',
  })
}

async function rejectClaim(
  claimId: string,
  approverEmail: string,
  notes: string,
  allowResubmit = true
) {
  setActor(approverEmail)
  return submitApprovalAction({
    claimId,
    action: 'rejected',
    notes,
    allowResubmit,
  })
}

async function financeApproveClaim(claimId: string, financeEmail: string) {
  setActor(financeEmail)
  return submitFinanceAction({
    claimId,
    action: 'finance_approved',
    notes: 'Finance approved by finance team.',
  })
}

async function financeReleaseClaim(claimId: string, financeEmail: string) {
  setActor(financeEmail)
  return submitFinanceAction({
    claimId,
    action: 'payment_released',
    notes: 'Payment released by finance team.',
  })
}

async function financeRejectClaim(
  claimId: string,
  financeEmail: string,
  notes: string,
  allowResubmit = true
) {
  setActor(financeEmail)
  return submitFinanceAction({
    claimId,
    action: 'finance_rejected',
    notes,
    allowResubmit,
  })
}

async function runDirectFlowScenario(
  submitterEmail: string,
  financeEmail: string
) {
  const claim = addClaim(submitterEmail)
  expect(claim.statusCode).toBe('L3_PENDING_FINANCE_REVIEW')

  if (submitterEmail !== MANSOOR_EMAIL) {
    expect(claim.currentApprovalLevel).toBe(3)
    const mansoorResult = await approveClaim(claim.id, MANSOOR_EMAIL)
    expect(mansoorResult).toEqual({ ok: true, error: null })
    expect(claim.currentApprovalLevel).toBeNull()
  } else {
    expect(claim.currentApprovalLevel).toBeNull()
  }

  const financeResult = await financeApproveClaim(claim.id, financeEmail)
  expect(financeResult).toEqual({ ok: true, error: null })

  expect(claim.statusCode).toBe('APPROVED')
  expect(getClaimStatusDisplayLabel(claim.statusCode, 'Finance Approved')).toBe(
    'Finance Approved'
  )

  const releaseResult = await financeReleaseClaim(claim.id, financeEmail)
  expect(releaseResult).toEqual({ ok: true, error: null })
  expect(claim.statusCode).toBe('PAYMENT_RELEASED')
  expect(getClaimStatusDisplayLabel(claim.statusCode, 'Payment Released')).toBe(
    'Payment Released'
  )

  return claim
}

describe('expense approval workflow integration — direct flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    activeUserEmail = 'finance1@nxtwave.co.in'
    claimSequence = 101
    claimStore = new Map<string, WorkflowClaimState>()

    mocks.createSupabaseServerClient.mockImplementation(async () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: activeUserEmail ? { email: activeUserEmail } : null,
          },
        }),
      },
      rpc: vi.fn(async (rpcName: string, params: unknown) => {
        if (rpcName === 'get_claim_available_actions') {
          const claimId = (params as { p_claim_id: string }).p_claim_id
          const claim = claimStore.get(claimId)
          if (!claim) {
            return { data: [], error: null }
          }

          return { data: getMockAvailableActions(), error: null }
        }

        if (rpcName === 'submit_approval_action_atomic') {
          const typed = params as ApprovalRpcParams
          const claim = claimStore.get(typed.p_claim_id)
          if (!claim) {
            return { error: { message: 'Claim not found.' } }
          }

          const message = applyApprovalTransition(claim, activeUserEmail, typed)
          return { error: message ? { message } : null }
        }

        if (rpcName === 'submit_finance_action_atomic') {
          const typed = params as FinanceRpcParams
          const claim = claimStore.get(typed.p_claim_id)
          if (!claim) {
            return { error: { message: 'Claim not found.' } }
          }

          const message = applyFinanceTransition(claim, activeUserEmail, typed)
          return { error: message ? { message } : null }
        }

        return { error: { message: `Unexpected RPC: ${rpcName}` } }
      }),
    }))

    mocks.getEmployeeByEmail.mockImplementation(
      async (_s: unknown, email: string) => {
        if (!email) {
          return null
        }
        return {
          id: `emp-${email.toLowerCase()}`,
          employee_email: email.toLowerCase(),
        }
      }
    )

    mocks.getClaimWithOwner.mockImplementation(
      async (_s: unknown, claimId: string) => {
        const claim = claimStore.get(claimId)
        if (!claim) {
          return null
        }

        return {
          claim: { id: claim.id } as never,
          owner: { id: `emp-${claim.submitterEmail}` } as never,
        }
      }
    )

    mocks.isFinanceTeamMember.mockImplementation(
      async (_s: unknown, employee: { employee_email?: string }) =>
        FINANCE_APPROVER_EMAILS.has(
          (employee.employee_email ?? '').toLowerCase()
        )
    )
  })

  it('completes SBH(AP) direct flow: Nagaraju -> Mansoor -> Finance', async () => {
    const claim = await runDirectFlowScenario(
      'nagaraju.madugula@nxtwave.co.in',
      'finance1@nxtwave.co.in'
    )
    expect(claim.approvalHistory.map((entry) => entry.actorEmail)).toEqual([
      MANSOOR_EMAIL,
      'finance1@nxtwave.co.in',
      'finance1@nxtwave.co.in',
    ])
    expect(
      claim.approvalHistory.some((entry) => entry.approvalLevel === 1)
    ).toBe(false)
  })

  it('completes SBH(Karnataka) direct flow through Mansoor', async () => {
    const claim = await runDirectFlowScenario(
      'vignesh.shenoy@nxtwave.co.in',
      'finance2@nxtwave.co.in'
    )
    expect(claim.approvalHistory.map((entry) => entry.actorEmail)).toEqual([
      MANSOOR_EMAIL,
      'finance2@nxtwave.co.in',
      'finance2@nxtwave.co.in',
    ])
  })

  it('supports ZBH multi-state routing and completes workflow', async () => {
    const config = getWorkflowConfig('satyapriya.dash@nxtwave.co.in')
    expect(config.coveredStates).toEqual([
      'Delhi NCR',
      'West Bengal',
      'Odisha',
      'Rajasthan',
      'Uttar Pradesh',
    ])

    const claim = await runDirectFlowScenario(
      'satyapriya.dash@nxtwave.co.in',
      'finance2@nxtwave.co.in'
    )
    expect(claim.approvalHistory[0]?.actorEmail).toBe(MANSOOR_EMAIL)
  })

  it('routes PM(Mansoor) claim directly to Finance without intermediate approvals', async () => {
    const claim = await runDirectFlowScenario(
      'mansoor@nxtwave.co.in',
      'finance1@nxtwave.co.in'
    )
    expect(claim.approvalHistory).toHaveLength(2)
    expect(claim.approvalHistory[0]?.actorEmail).toBe('finance1@nxtwave.co.in')
    expect(claim.approvalHistory[0]?.approvalLevel).toBeNull()
  })

  it.each(['finance1@nxtwave.co.in', 'finance2@nxtwave.co.in'])(
    'allows %s to finance-approve and release claims',
    async (financeEmail) => {
      const claim = addClaim('nagaraju.madugula@nxtwave.co.in')
      const mansoorResult = await approveClaim(claim.id, MANSOOR_EMAIL)

      expect(mansoorResult).toEqual({ ok: true, error: null })
      expect(claim.currentApprovalLevel).toBeNull()

      const financeResult = await financeApproveClaim(claim.id, financeEmail)
      expect(financeResult).toEqual({ ok: true, error: null })

      const releaseResult = await financeReleaseClaim(claim.id, financeEmail)
      expect(releaseResult).toEqual({ ok: true, error: null })

      expect(claim.statusCode).toBe('PAYMENT_RELEASED')
      expect(claim.approvalHistory.at(-1)?.action).toBe('payment_released')
      expect(claim.approvalHistory.at(-1)?.actorEmail).toBe(financeEmail)
    }
  )

  it('supports SBH -> Mansoor -> rejected flow and allows resubmission', async () => {
    const claim = addClaim('nagaraju.madugula@nxtwave.co.in')

    const rejectResult = await rejectClaim(
      claim.id,
      MANSOOR_EMAIL,
      'Rejected by Mansoor: manager note mismatch.',
      true
    )

    expect(rejectResult).toEqual({ ok: true, error: null })
    expect(claim.statusCode).toBe('REJECTED')
    expect(claim.rejectionReason).toBe(
      'Rejected by Mansoor: manager note mismatch.'
    )
    expect(claim.allowResubmit).toBe(true)

    const blockedAfterRejection = await financeApproveClaim(
      claim.id,
      'finance1@nxtwave.co.in'
    )
    expect(blockedAfterRejection).toEqual({
      ok: false,
      error: 'Claim is already finalized.',
    })

    const replacement = resubmitRejectedClaim(claim, nextClaimId())
    claimStore.set(replacement.id, replacement)
    expect(replacement.currentApprovalLevel).toBe(3)
    expect(replacement.statusCode).toBe('L3_PENDING_FINANCE_REVIEW')
  })

  it('supports Mansoor -> Finance -> rejected flow with resubmission enabled', async () => {
    const claim = addClaim('mansoor@nxtwave.co.in')
    const result = await financeRejectClaim(
      claim.id,
      'finance2@nxtwave.co.in',
      'Rejected by Finance: bank details invalid.',
      true
    )

    expect(result).toEqual({ ok: true, error: null })
    expect(claim.statusCode).toBe('REJECTED')
    expect(claim.rejectionReason).toBe(
      'Rejected by Finance: bank details invalid.'
    )
    expect(claim.allowResubmit).toBe(true)
    expect(claim.approvalHistory.at(-1)?.actorEmail).toBe(
      'finance2@nxtwave.co.in'
    )

    const replacement = resubmitRejectedClaim(claim, nextClaimId())
    claimStore.set(replacement.id, replacement)

    expect(replacement.currentApprovalLevel).toBeNull()
    expect(replacement.statusCode).toBe('L3_PENDING_FINANCE_REVIEW')
  })
})
