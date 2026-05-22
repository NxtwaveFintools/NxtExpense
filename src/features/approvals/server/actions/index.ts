'use server'

import { revalidatePath } from 'next/cache'

import type {
  ApprovalHistoryFilters,
  BulkApprovalActionResult,
} from '@/features/approvals/types'
import {
  getApprovalEmployeeNameSuggestions,
  getClaimWithOwner,
  getFilteredApprovalHistoryPaginated,
  getPendingApprovalsPaginated,
} from '@/features/approvals/data/queries'
import {
  normalizeApprovalHistoryFilters,
  toPendingApprovalsFilters,
} from '@/features/approvals/utils/history-filters'
import {
  submitApprovalWorkflow,
  submitBulkApprovalWorkflow,
  type ApprovalActionResult,
} from '@/features/approvals/server/services/approval-workflow.orchestrator'
import { canAccessApprovals } from '@/features/employees/permissions'
import { getClaimAvailableActions } from '@/features/claims/data/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getEmployeeByEmail,
  hasApproverAssignments,
} from '@/lib/services/employee-service'
import {
  approvalActionSchema,
  bulkApprovalActionSchema,
} from '@/features/approvals/validations'

type RawApprovalFilters = Partial<Record<keyof ApprovalHistoryFilters, string>>

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

function revalidateApprovalSurfaces(claimId?: string) {
  revalidatePath('/approvals')
  revalidatePath('/claims')
  revalidatePath('/finance')

  if (claimId) {
    revalidatePath(`/approvals/${claimId}`)
    revalidatePath(`/claims/${claimId}`)
  }
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

  const result = await submitApprovalWorkflow(
    supabase,
    user?.email,
    parsed.data
  )

  if (result.ok) {
    const claimWithOwner = await getClaimWithOwner(
      supabase,
      parsed.data.claimId
    )
    revalidateApprovalSurfaces(claimWithOwner?.claim.id ?? parsed.data.claimId)
  }

  return result
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
    toPendingApprovalsFilters(normalizedFilters)
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

  const result = await submitBulkApprovalWorkflow(
    supabase,
    user?.email,
    parsed.data
  )

  if (result.succeeded > 0) {
    revalidateApprovalSurfaces()
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

export async function getApprovalEmployeeNameSuggestionsAction(
  employeeNameSearch: string | null
): Promise<ActionResult<string[]>> {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return { ok: false, error: 'Unauthorized request.' }
    }

    const employee = await getEmployeeByEmail(supabase, user.email)
    if (!employee) {
      return { ok: false, error: 'Approver employee profile not found.' }
    }

    const approverAccess = await hasApproverAssignments(
      supabase,
      employee.employee_email
    )

    if (!canAccessApprovals(approverAccess)) {
      return { ok: false, error: 'Approval access is required.' }
    }

    const names = await getApprovalEmployeeNameSuggestions(
      supabase,
      employeeNameSearch,
      8
    )

    return { ok: true, data: names }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unexpected error.',
    }
  }
}
