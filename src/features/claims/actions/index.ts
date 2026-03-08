'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

import { getEmployeeByEmail } from '@/features/employees/queries'
import { canAccessEmployeeClaims } from '@/features/employees/permissions'

import type { ClaimFormValues } from '@/features/claims/types'
import { claimSubmissionSchema } from '@/features/claims/validations'
import {
  getClaimForDate,
  getRateAmount,
  insertClaim,
  insertClaimItems,
  replaceClaimItems,
  updateClaimDraftData,
} from '@/features/claims/mutations'
import { getMyClaimsPaginated } from '@/features/claims/queries'
import { buildClaimItemsAndTotal } from '@/features/claims/utils/calculations'

type ClaimActionResult = {
  ok: boolean
  error: string | null
  claimId?: string
  claimNumber?: string
}

async function moveClaimIntoWorkflow(
  claimId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  return supabase.rpc('resubmit_claim_after_rejection_atomic', {
    p_claim_id: claimId,
    p_notes: null,
  })
}

export async function submitClaimAction(
  rawInput: ClaimFormValues
): Promise<ClaimActionResult> {
  const parsed = claimSubmissionSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid claim input.',
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { ok: false, error: 'Unauthorized request.' }
  }

  const employee = await getEmployeeByEmail(supabase, user.email)
  if (!employee) {
    return { ok: false, error: 'Employee profile not found.' }
  }

  if (!canAccessEmployeeClaims(employee)) {
    return { ok: false, error: 'Your role cannot submit employee claims.' }
  }

  const input = parsed.data

  const existingClaim = await getClaimForDate(
    supabase,
    employee.id,
    input.claimDate.iso
  )

  if (existingClaim && existingClaim.status !== 'returned_for_modification') {
    if (
      existingClaim.status === 'rejected' ||
      existingClaim.status === 'finance_rejected'
    ) {
      return {
        ok: false,
        error:
          'This claim was finally rejected and cannot be resubmitted. Please contact admin for correction.',
      }
    }

    return {
      ok: false,
      error:
        'You already have a pending claim for this date. Please wait for approval or modify your existing claim.',
    }
  }

  const rates: {
    foodBase?: number
    foodOutstation?: number
    fuelBase?: number
    intercityRate?: number
  } = {}

  if (input.workLocation === 'Field - Base Location') {
    rates.foodBase = await getRateAmount(
      supabase,
      employee.designation,
      'food_base_daily'
    )
    rates.fuelBase = await getRateAmount(
      supabase,
      employee.designation,
      'fuel_base_daily',
      input.vehicleType
    )
  }

  if (input.workLocation === 'Field - Outstation') {
    rates.foodOutstation = await getRateAmount(
      supabase,
      employee.designation,
      'food_outstation_daily'
    )

    if (input.ownVehicleUsed) {
      rates.intercityRate = await getRateAmount(
        supabase,
        employee.designation,
        'intercity_per_km',
        input.vehicleType
      )
    }
  }

  const draft = buildClaimItemsAndTotal(input, rates)

  if (existingClaim) {
    await updateClaimDraftData(supabase, existingClaim.id, {
      claimDateIso: input.claimDate.iso,
      workLocation: input.workLocation,
      ownVehicleUsed:
        input.workLocation === 'Field - Outstation'
          ? input.ownVehicleUsed
          : null,
      vehicleType:
        input.workLocation === 'Field - Base Location' ||
        (input.workLocation === 'Field - Outstation' && input.ownVehicleUsed)
          ? input.vehicleType
          : null,
      outstationLocation:
        input.workLocation === 'Field - Outstation'
          ? input.outstationLocation
          : null,
      fromCity:
        input.workLocation === 'Field - Outstation' && input.ownVehicleUsed
          ? input.fromCity
          : null,
      toCity:
        input.workLocation === 'Field - Outstation' && input.ownVehicleUsed
          ? input.toCity
          : null,
      kmTravelled:
        input.workLocation === 'Field - Outstation' && input.ownVehicleUsed
          ? input.kmTravelled
          : null,
      totalAmount: draft.total,
      status: 'returned_for_modification',
      currentApprovalLevel: null,
      submittedAt: null,
    })

    await replaceClaimItems(
      supabase,
      existingClaim.id,
      draft.items.map((item) => ({
        claimId: existingClaim.id,
        itemType: item.itemType,
        amount: item.amount,
        description: item.description,
      }))
    )

    const { error: resubmitError } = await moveClaimIntoWorkflow(
      existingClaim.id,
      supabase
    )

    if (resubmitError) {
      return { ok: false, error: resubmitError.message }
    }

    return {
      ok: true,
      error: null,
      claimId: existingClaim.id,
      claimNumber: existingClaim.claim_number,
    }
  }

  const claim = await insertClaim(supabase, {
    employeeId: employee.id,
    claimDateIso: input.claimDate.iso,
    workLocation: input.workLocation,
    ownVehicleUsed:
      input.workLocation === 'Field - Outstation' ? input.ownVehicleUsed : null,
    vehicleType:
      input.workLocation === 'Field - Base Location' ||
      (input.workLocation === 'Field - Outstation' && input.ownVehicleUsed)
        ? input.vehicleType
        : null,
    outstationLocation:
      input.workLocation === 'Field - Outstation'
        ? input.outstationLocation
        : null,
    fromCity:
      input.workLocation === 'Field - Outstation' && input.ownVehicleUsed
        ? input.fromCity
        : null,
    toCity:
      input.workLocation === 'Field - Outstation' && input.ownVehicleUsed
        ? input.toCity
        : null,
    kmTravelled:
      input.workLocation === 'Field - Outstation' && input.ownVehicleUsed
        ? input.kmTravelled
        : null,
    totalAmount: draft.total,
    status: 'submitted',
    currentApprovalLevel: null,
    submittedAt: new Date().toISOString(),
  })

  await insertClaimItems(
    supabase,
    draft.items.map((item) => ({
      claimId: claim.id,
      itemType: item.itemType,
      amount: item.amount,
      description: item.description,
    }))
  )

  const { error: workflowError } = await moveClaimIntoWorkflow(
    claim.id,
    supabase
  )
  if (workflowError) {
    return { ok: false, error: workflowError.message }
  }

  return {
    ok: true,
    error: null,
    claimId: claim.id,
    claimNumber: claim.claim_number,
  }
}

export async function getMyClaimsAction(cursor: string | null, limit = 10) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    throw new Error('Unauthorized request.')
  }

  const employee = await getEmployeeByEmail(supabase, user.email)
  if (!employee || !canAccessEmployeeClaims(employee)) {
    return {
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit,
    }
  }

  return getMyClaimsPaginated(supabase, employee.id, cursor, limit)
}
