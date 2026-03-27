'use server'

import { revalidatePath } from 'next/cache'

import { createSupabaseServerClient } from '@/lib/supabase/server'

import { getEmployeeByEmail } from '@/lib/services/employee-service'
import type {
  ApprovalHistoryFilters,
  BulkApprovalActionResult,
  PendingApprovalsFilters,
} from '@/features/approvals/types'
import {
  approvalActionSchema,
  bulkApprovalActionSchema,
} from '@/features/approvals/validations'
import {
  getClaimWithOwner,
  getPendingApprovalsPaginated,
} from '@/features/approvals/queries'
import { getFilteredApprovalHistoryPaginated } from '@/features/approvals/queries/history-filters'
import {
  getClaimAvailableActions,
  getClaimAvailableActionsByClaimIds,
} from '@/features/claims/queries'
import { normalizeApprovalHistoryFilters } from '@/features/approvals/utils/history-filters'
import {
  getMaxNotesLength,
  getMaxTextLengthValidationError,
} from '@/lib/services/system-settings-service'

type ApprovalActionResult = {
  ok: boolean
  error: string | null
}

export async function submitApprovalAction(payload: {
  claimId: string
  action: string
  notes?: string
  allowResubmit?: boolean
}): Promise<ApprovalActionResult> {
  const parsed = approvalActionSchema.safeParse(payload)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid approval input.',
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { ok: false, error: 'Unauthorized request.' }
  }

  const approver = await getEmployeeByEmail(supabase, user.email)
  if (!approver) {
    return { ok: false, error: 'Approver employee profile not found.' }
  }

  const maxNotesLength = await getMaxNotesLength(supabase)
  const notesValidationError = getMaxTextLengthValidationError(
    parsed.data.notes,
    maxNotesLength,
    'Notes'
  )

  if (notesValidationError) {
    return { ok: false, error: notesValidationError }
  }

  const claimWithOwner = await getClaimWithOwner(supabase, parsed.data.claimId)
  if (!claimWithOwner) {
    return { ok: false, error: 'Claim not found.' }
  }

  const availableActions = await getClaimAvailableActions(
    supabase,
    claimWithOwner.claim.id
  )
  const canRunAction = availableActions.some(
    (action) => action.action === parsed.data.action
  )

  if (!canRunAction) {
    return {
      ok: false,
      error: 'This workflow action is not available for the claim state.',
    }
  }

  const { error: approvalError } = await supabase.rpc(
    'submit_approval_action_atomic',
    {
      p_claim_id: claimWithOwner.claim.id,
      p_action: parsed.data.action,
      p_notes: parsed.data.notes ?? null,
      p_allow_resubmit: Boolean(parsed.data.allowResubmit),
    }
  )

  if (approvalError) {
    return { ok: false, error: approvalError.message }
  }

  revalidatePath('/approvals')
  revalidatePath(`/approvals/${claimWithOwner.claim.id}`)
  revalidatePath('/claims')
  revalidatePath(`/claims/${claimWithOwner.claim.id}`)
  revalidatePath('/finance')

  return { ok: true, error: null }
}

type RawApprovalFilters = Partial<Record<keyof ApprovalHistoryFilters, string>>

function getPendingFilters(
  normalizedFilters: ApprovalHistoryFilters
): PendingApprovalsFilters {
  return {
    employeeName: normalizedFilters.employeeName,
    claimStatus: normalizedFilters.claimStatus,
    claimDateFrom: normalizedFilters.claimDateFrom,
    claimDateTo: normalizedFilters.claimDateTo,
    amountOperator: normalizedFilters.amountOperator,
    amountValue: normalizedFilters.amountValue,
    locationType: normalizedFilters.locationType,
    claimDateSort: normalizedFilters.claimDateSort,
  }
}

export async function getPendingApprovalsAction(
  cursor: string | null,
  limit = 10,
  rawFilters: RawApprovalFilters = {}
) {
  const normalizedFilters = normalizeApprovalHistoryFilters(rawFilters)
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    throw new Error('Unauthorized request.')
  }

  return getPendingApprovalsPaginated(
    supabase,
    user.email,
    cursor,
    limit,
    getPendingFilters(normalizedFilters)
  )
}

export async function getApprovalHistoryAction(
  cursor: string | null,
  limit = 10,
  rawFilters: RawApprovalFilters = {}
) {
  const normalizedFilters = normalizeApprovalHistoryFilters(rawFilters)
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    throw new Error('Unauthorized request.')
  }

  return getFilteredApprovalHistoryPaginated(
    supabase,
    cursor,
    limit,
    normalizedFilters
  )
}

export async function submitBulkApprovalAction(payload: {
  claimIds: string[]
  action: string
  notes?: string
  allowResubmit?: boolean
}): Promise<BulkApprovalActionResult> {
  const parsed = bulkApprovalActionSchema.safeParse(payload)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid bulk approval input.',
      succeeded: 0,
      failed: 0,
      errors: [],
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return {
      ok: false,
      error: 'Unauthorized request.',
      succeeded: 0,
      failed: parsed.data.claimIds.length,
      errors: parsed.data.claimIds.map((claimId) => ({
        claimId,
        message: 'Unauthorized request.',
      })),
    }
  }

  const approver = await getEmployeeByEmail(supabase, user.email)
  if (!approver) {
    return {
      ok: false,
      error: 'Approver employee profile not found.',
      succeeded: 0,
      failed: parsed.data.claimIds.length,
      errors: parsed.data.claimIds.map((claimId) => ({
        claimId,
        message: 'Approver employee profile not found.',
      })),
    }
  }

  const maxNotesLength = await getMaxNotesLength(supabase)
  const notesValidationError = getMaxTextLengthValidationError(
    parsed.data.notes,
    maxNotesLength,
    'Notes'
  )

  if (notesValidationError) {
    return {
      ok: false,
      error: notesValidationError,
      succeeded: 0,
      failed: parsed.data.claimIds.length,
      errors: parsed.data.claimIds.map((claimId) => ({
        claimId,
        message: notesValidationError,
      })),
    }
  }

  const result: BulkApprovalActionResult = {
    ok: true,
    error: null,
    succeeded: 0,
    failed: 0,
    errors: [],
  }

  const actionsByClaimId = await getClaimAvailableActionsByClaimIds(
    supabase,
    parsed.data.claimIds
  )

  for (const claimId of parsed.data.claimIds) {
    const availableActions = actionsByClaimId.get(claimId) ?? []
    const canRunAction = availableActions.some(
      (action) => action.action === parsed.data.action
    )

    if (!canRunAction) {
      result.ok = false
      result.failed += 1
      result.errors.push({
        claimId,
        message: 'This workflow action is not available for the claim state.',
      })
      continue
    }

    const { error } = await supabase.rpc('submit_approval_action_atomic', {
      p_claim_id: claimId,
      p_action: parsed.data.action,
      p_notes: parsed.data.notes ?? null,
      p_allow_resubmit: Boolean(parsed.data.allowResubmit),
    })

    if (error) {
      result.ok = false
      result.failed += 1
      result.errors.push({
        claimId,
        message: error.message,
      })
      continue
    }

    result.succeeded += 1
  }

  if (result.succeeded > 0) {
    revalidatePath('/approvals')
    revalidatePath('/claims')
    revalidatePath('/finance')
  }

  if (result.failed > 0 && result.errors.length > 0) {
    result.error = `${result.failed} claim(s) failed to update.`
  }

  return result
}

export async function getClaimAvailableActionsAction(claimId: string) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    throw new Error('Unauthorized request.')
  }

  return getClaimAvailableActions(supabase, claimId)
}
