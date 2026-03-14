'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

import {
  getEmployeeByEmail,
  getEmployeeRoles,
} from '@/lib/services/employee-service'
import { canAccessEmployeeClaimsFromRoles } from '@/lib/services/approval-service'
import {
  getAllWorkLocations,
  getClaimStatusByCode,
  getDesignationApprovalFlow,
} from '@/lib/services/config-service'
import {
  calculateBaseLocationItems,
  calculateOutstationOwnVehicleItems,
  calculateOutstationTaxiItems,
  getVehicleTypeById,
  countFoodWithPrincipalsInMonth,
  getFoodWithPrincipalsLimit,
} from '@/lib/services/calculation-service'

import type { ClaimFormValues } from '@/features/claims/types'
import { claimSubmissionSchema } from '@/features/claims/validations'
import {
  getClaimForDate,
  insertClaim,
  insertClaimItems,
} from '@/features/claims/mutations'
import { getMyClaimsPaginated } from '@/features/claims/queries'

type ClaimActionResult = {
  ok: boolean
  error: string | null
  claimId?: string
  claimNumber?: string
}

type InitialWorkflowState = {
  statusId: string
  currentApprovalLevel: number | null
}

const INITIAL_WORKFLOW_STATUS_BY_LEVEL: Record<
  number,
  { statusCode: string; currentApprovalLevel: number | null }
> = {
  1: { statusCode: 'L1_PENDING', currentApprovalLevel: 1 },
  2: { statusCode: 'L2_PENDING', currentApprovalLevel: 2 },
  3: { statusCode: 'L3_PENDING_FINANCE_REVIEW', currentApprovalLevel: null },
}

async function resolveInitialWorkflowState(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  designationId: string | null
): Promise<InitialWorkflowState> {
  if (!designationId) {
    throw new Error('Employee designation is required to submit claims.')
  }

  const approvalFlow = await getDesignationApprovalFlow(supabase, designationId)
  const firstLevel = approvalFlow.required_approval_levels?.[0]
  const initialWorkflowState = firstLevel
    ? INITIAL_WORKFLOW_STATUS_BY_LEVEL[firstLevel]
    : undefined

  if (!initialWorkflowState) {
    throw new Error(
      `Unsupported first approval level configured for employee: ${firstLevel ?? 'none'}.`
    )
  }

  const status = await getClaimStatusByCode(
    supabase,
    initialWorkflowState.statusCode
  )

  return {
    statusId: status.id,
    currentApprovalLevel: initialWorkflowState.currentApprovalLevel,
  }
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

  const roles = await getEmployeeRoles(supabase, employee.id)
  if (!canAccessEmployeeClaimsFromRoles(roles)) {
    return { ok: false, error: 'Your role cannot submit employee claims.' }
  }

  const input = parsed.data

  const existingClaim = await getClaimForDate(
    supabase,
    employee.id,
    input.claimDate.iso
  )

  if (existingClaim && !existingClaim.is_rejection) {
    return {
      ok: false,
      error: `You already have a pending or approved claim for this date (${existingClaim.claim_number}). Please wait for it to be processed.`,
    }
  }

  // ── Look up work location by ID (form sends UUID directly) ──
  const allWorkLocations = await getAllWorkLocations(supabase)
  const wlFlags = allWorkLocations.find((wl) => wl.id === input.workLocation)
  if (!wlFlags) {
    return { ok: false, error: 'Unknown work location.' }
  }

  const workLocationId = wlFlags.id

  // ── Server-side conditional field validation based on DB flags ──
  if (wlFlags.requires_vehicle_selection && !input.vehicleType) {
    return {
      ok: false,
      error: 'Vehicle type is required for this work location.',
    }
  }

  if (wlFlags.requires_outstation_details) {
    if (!input.outstationCityId) {
      return { ok: false, error: 'Outstation city is required.' }
    }
    if (input.ownVehicleUsed) {
      if (!input.vehicleType) {
        return {
          ok: false,
          error: 'Vehicle type is required when using own vehicle.',
        }
      }
      if (!input.fromCityId) {
        return {
          ok: false,
          error: 'From city is required for own vehicle travel.',
        }
      }
      if (!input.toCityId) {
        return {
          ok: false,
          error: 'To city is required for own vehicle travel.',
        }
      }
      if (!input.kmTravelled || input.kmTravelled <= 0) {
        return { ok: false, error: 'KM travelled must be greater than zero.' }
      }
    } else {
      if (!input.transportType?.trim()) {
        return {
          ok: false,
          error: 'Transport type is required when not using own vehicle.',
        }
      }
    }
  }

  let vehicleTypeId: string | null = null
  if (
    wlFlags.requires_vehicle_selection ||
    (wlFlags.requires_outstation_details && input.ownVehicleUsed)
  ) {
    // Form sends vehicleType as UUID directly
    vehicleTypeId = input.vehicleType ?? null
    if (!vehicleTypeId) {
      return {
        ok: false,
        error: 'Vehicle type is required for this work location.',
      }
    }
  }

  // ── Calculate expense items from DB rates ──
  let draft: {
    items: { expense_type: string; amount: number; description: string }[]
    total: number
  }

  if (wlFlags.requires_vehicle_selection && vehicleTypeId) {
    const vt = await getVehicleTypeById(supabase, vehicleTypeId)
    draft = await calculateBaseLocationItems(supabase, {
      workLocationId,
      vehicleType: vt,
    })
  } else if (
    wlFlags.requires_outstation_details &&
    input.ownVehicleUsed &&
    vehicleTypeId
  ) {
    const vt = await getVehicleTypeById(supabase, vehicleTypeId)

    // Validate KM limit from DB (replaces hardcoded 150/300 check)
    if (
      input.kmTravelled &&
      vt &&
      vt.max_km_round_trip > 0 &&
      input.kmTravelled > vt.max_km_round_trip
    ) {
      return {
        ok: false,
        error: `KM travelled (${input.kmTravelled}) exceeds max limit of ${vt.max_km_round_trip} for ${vt.vehicle_name}.`,
      }
    }

    draft = await calculateOutstationOwnVehicleItems(supabase, {
      workLocationId,
      designationId: employee.designation_id ?? '',
      vehicleType: vt,
      kmTravelled: input.kmTravelled ?? 0,
      accommodationNights: input.accommodationNights,
      foodWithPrincipalsAmount: input.foodWithPrincipalsAmount,
    })
  } else if (wlFlags.requires_outstation_details && !input.ownVehicleUsed) {
    draft = await calculateOutstationTaxiItems(supabase, {
      workLocationId,
      taxiAmount: input.taxiAmount ?? 0,
      transportTypeName: input.transportType ?? 'Taxi',
      designationId: employee.designation_id ?? '',
      accommodationNights: input.accommodationNights,
      foodWithPrincipalsAmount: input.foodWithPrincipalsAmount,
    })
  } else {
    // Office/WFH, Leave, Week-off — no expense items
    draft = { items: [], total: 0 }
  }

  // ── Validate food with principals monthly limit (max 5x/month) ──
  if (
    wlFlags.requires_outstation_details &&
    input.foodWithPrincipalsAmount &&
    input.foodWithPrincipalsAmount > 0 &&
    employee.designation_id
  ) {
    const fwpRate = await getFoodWithPrincipalsLimit(
      supabase,
      workLocationId,
      employee.designation_id
    )
    if (fwpRate === 0) {
      return {
        ok: false,
        error: 'Your designation is not eligible for Food with Principals.',
      }
    }

    const yearMonth = input.claimDate.iso.slice(0, 7) // YYYY-MM
    const currentMonthCount = await countFoodWithPrincipalsInMonth(
      supabase,
      employee.id,
      yearMonth
    )
    if (currentMonthCount >= 5) {
      return {
        ok: false,
        error:
          'Food with Principals limit reached — maximum 5 times per month.',
      }
    }
  }

  let initialWorkflowState: InitialWorkflowState
  try {
    initialWorkflowState = await resolveInitialWorkflowState(
      supabase,
      employee.designation_id
    )
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'Unable to start workflow.',
    }
  }

  const isOutstation = wlFlags.requires_outstation_details
  const isBaseLocation = wlFlags.requires_vehicle_selection

  // Extract variant-specific fields based on DB flags
  type OutstationInput = {
    ownVehicleUsed: boolean
    outstationCityId: string
    fromCityId?: string
    toCityId?: string
    kmTravelled?: number
    taxiAmount?: number
    transportType?: string
  }
  const outstation = isOutstation ? (input as unknown as OutstationInput) : null
  const hasOwnVehicle = isOutstation && outstation?.ownVehicleUsed === true

  // ── Re-file when a rejected claim has been granted allow_resubmit=true ──
  // The old rejected row is preserved (frozen as is_superseded=TRUE) so it
  // remains permanently visible in the DB and in the employee's claim history.
  // A brand-new INSERT creates the replacement claim with its own claim_number.
  // The partial unique index (WHERE NOT is_superseded) allows both rows.
  if (existingClaim && existingClaim.is_rejection) {
    // Permanently closed: approver did not grant permission to raise a new claim
    if (!existingClaim.allow_resubmit) {
      return {
        ok: false,
        error:
          'This claim has been permanently closed. Contact your approver if you believe this is an error.',
      }
    }

    // Atomically mark the old rejected claim as superseded (frozen forever)
    const { error: supersedeError } = await supabase.rpc(
      'supersede_rejected_claim',
      {
        p_claim_id: existingClaim.id,
      }
    )
    if (supersedeError) {
      return { ok: false, error: supersedeError.message }
    }

    // Insert a brand-new claim row — the INSERT trigger assigns a fresh claim_number
    const newClaim = await insertClaim(supabase, {
      employeeId: employee.id,
      claimDateIso: input.claimDate.iso,
      workLocationId,
      ownVehicleUsed: outstation?.ownVehicleUsed ?? null,
      vehicleTypeId: isBaseLocation || hasOwnVehicle ? vehicleTypeId : null,
      outstationCityId: outstation?.outstationCityId ?? null,
      fromCityId: hasOwnVehicle ? (outstation?.fromCityId ?? null) : null,
      toCityId: hasOwnVehicle ? (outstation?.toCityId ?? null) : null,
      kmTravelled: hasOwnVehicle ? (outstation?.kmTravelled ?? null) : null,
      totalAmount: draft.total,
      statusId: initialWorkflowState.statusId,
      currentApprovalLevel: initialWorkflowState.currentApprovalLevel,
      submittedAt: new Date().toISOString(),
      designationId: employee.designation_id,
      accommodationNights: isOutstation
        ? (input.accommodationNights ?? null)
        : null,
      foodWithPrincipalsAmount: isOutstation
        ? (input.foodWithPrincipalsAmount ?? null)
        : null,
    })

    await insertClaimItems(
      supabase,
      draft.items.map((item) => ({
        claimId: newClaim.id,
        itemType: item.expense_type,
        amount: item.amount,
        description: item.description,
      }))
    )

    return {
      ok: true,
      error: null,
      claimId: newClaim.id,
      claimNumber: newClaim.claim_number,
    }
  }

  const claim = await insertClaim(supabase, {
    employeeId: employee.id,
    claimDateIso: input.claimDate.iso,
    workLocationId,
    ownVehicleUsed: outstation?.ownVehicleUsed ?? null,
    vehicleTypeId: isBaseLocation || hasOwnVehicle ? vehicleTypeId : null,
    outstationCityId: outstation?.outstationCityId ?? null,
    fromCityId: hasOwnVehicle ? (outstation?.fromCityId ?? null) : null,
    toCityId: hasOwnVehicle ? (outstation?.toCityId ?? null) : null,
    kmTravelled: hasOwnVehicle ? (outstation?.kmTravelled ?? null) : null,
    totalAmount: draft.total,
    statusId: initialWorkflowState.statusId,
    currentApprovalLevel: initialWorkflowState.currentApprovalLevel,
    submittedAt: new Date().toISOString(),
    designationId: employee.designation_id,
    accommodationNights: isOutstation
      ? (input.accommodationNights ?? null)
      : null,
    foodWithPrincipalsAmount: isOutstation
      ? (input.foodWithPrincipalsAmount ?? null)
      : null,
  })

  await insertClaimItems(
    supabase,
    draft.items.map((item) => ({
      claimId: claim.id,
      itemType: item.expense_type,
      amount: item.amount,
      description: item.description,
    }))
  )

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
  if (!employee) {
    return { data: [], hasNextPage: false, nextCursor: null, limit }
  }

  const roles = await getEmployeeRoles(supabase, employee.id)
  if (!canAccessEmployeeClaimsFromRoles(roles)) {
    return { data: [], hasNextPage: false, nextCursor: null, limit }
  }

  return getMyClaimsPaginated(supabase, employee.id, cursor, limit)
}
