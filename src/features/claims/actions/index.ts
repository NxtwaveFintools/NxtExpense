'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

import {
  getEmployeeByEmail,
  getEmployeeRoles,
} from '@/lib/services/employee-service'
import { canAccessEmployeeClaimsFromRoles } from '@/lib/services/approval-service'
import {
  getAllWorkLocations,
  getBaseLocationDayTypeByCode,
  getDefaultBaseLocationDayType,
  getDesignationApprovalFlow,
} from '@/lib/services/config-service'
import {
  calculateBaseLocationItems,
  calculateOutstationTravelItems,
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

type ResolvedBaseLocationDayType = {
  day_type_code: string
  day_type_label: string
  include_food_allowance: boolean
}

async function resolveBaseLocationDayTypeSelection(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  requestedDayTypeCode: string | undefined
): Promise<{ value: ResolvedBaseLocationDayType } | { error: string }> {
  const normalizedRequestedDayType = requestedDayTypeCode?.trim()

  try {
    if (normalizedRequestedDayType) {
      const selectedDayType = await getBaseLocationDayTypeByCode(
        supabase,
        normalizedRequestedDayType
      )

      if (!selectedDayType) {
        return { error: 'Selected day type is not available.' }
      }

      return {
        value: {
          day_type_code: selectedDayType.day_type_code,
          day_type_label: selectedDayType.day_type_label,
          include_food_allowance: selectedDayType.include_food_allowance,
        },
      }
    }

    const defaultDayType = await getDefaultBaseLocationDayType(supabase)

    if (!defaultDayType) {
      return {
        error: 'No active day type is configured for base location claims.',
      }
    }

    return {
      value: {
        day_type_code: defaultDayType.day_type_code,
        day_type_label: defaultDayType.day_type_label,
        include_food_allowance: defaultDayType.include_food_allowance,
      },
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to resolve base day type configuration.',
    }
  }
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

  if (!firstLevel) {
    throw new Error(
      `Unsupported first approval level configured for employee: ${firstLevel ?? 'none'}.`
    )
  }

  const { data: status, error } = await supabase
    .from('claim_statuses')
    .select('id')
    .eq('approval_level', firstLevel)
    .eq('is_approval', false)
    .eq('is_rejection', false)
    .eq('is_terminal', false)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .maybeSingle()

  if (error) {
    throw new Error(
      `Failed to resolve initial claim workflow state: ${error.message}`
    )
  }

  if (!status) {
    throw new Error(
      `No active pending claim status found for approval level ${firstLevel}.`
    )
  }

  return {
    statusId: status.id,
    currentApprovalLevel: firstLevel >= 3 ? null : firstLevel,
  }
}

async function validateCitiesForSelectedState(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  stateId: string,
  cityIds: Array<string | undefined>
): Promise<string | null> {
  const uniqueCityIds = [...new Set(cityIds.filter(Boolean))] as string[]

  if (uniqueCityIds.length === 0) {
    return null
  }

  const { data, error } = await supabase
    .from('cities')
    .select('id')
    .eq('state_id', stateId)
    .in('id', uniqueCityIds)

  if (error) {
    return 'Unable to validate selected cities for the chosen state.'
  }

  const validIds = new Set((data ?? []).map((row) => row.id as string))
  const hasInvalidCity = uniqueCityIds.some((cityId) => !validIds.has(cityId))

  return hasInvalidCity
    ? 'Selected cities must belong to the selected state.'
    : null
}

function mapClaimInsertErrorToUserMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : ''
  const normalizedMessage = message.toLowerCase()

  if (
    normalizedMessage.includes('expense_claims_one_active_per_employee_date') ||
    (normalizedMessage.includes(
      'duplicate key value violates unique constraint'
    ) &&
      normalizedMessage.includes('expense_claims'))
  ) {
    return 'Claim already submitted for this date. Please open My Claims to view the existing claim.'
  }

  return null
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

  const employeeStatusCode = employee.employee_statuses?.status_code ?? 'ACTIVE'

  if (employeeStatusCode !== 'ACTIVE') {
    return {
      ok: false,
      error: 'Inactive employees cannot submit new claims.',
    }
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
      error: `Claim already submitted for this date (${existingClaim.claim_number}). Please open My Claims to view its status.`,
    }
  }

  // ── Look up work location by ID (form sends UUID directly) ──
  const allWorkLocations = await getAllWorkLocations(supabase)
  const wlFlags = allWorkLocations.find((wl) => wl.id === input.workLocation)
  if (!wlFlags) {
    return { ok: false, error: 'Unknown work location.' }
  }

  const workLocationId = wlFlags.id

  const hasIntercitySelection =
    typeof input.intercityOwnVehicleUsed === 'boolean'

  const intracityTravelSelection =
    typeof input.intracityTravelUsed === 'boolean'
      ? input.intracityTravelUsed
      : typeof input.intracityOwnVehicleUsed === 'boolean'
        ? input.intracityOwnVehicleUsed
        : undefined

  const hasIntracitySelection = typeof intracityTravelSelection === 'boolean'

  if (wlFlags.requires_outstation_details && !hasIntercitySelection) {
    return {
      ok: false,
      error:
        'Please select whether you travelled between cities using your own vehicle.',
    }
  }

  if (
    wlFlags.requires_outstation_details &&
    input.intercityOwnVehicleUsed === false &&
    !hasIntracitySelection
  ) {
    return {
      ok: false,
      error:
        'Please select whether you travelled within the city using your own vehicle/rental vehicle.',
    }
  }

  const intercityOwnVehicleUsed = wlFlags.requires_outstation_details
    ? input.intercityOwnVehicleUsed === true
    : false

  const hasIntercityTravel = wlFlags.requires_outstation_details
    ? intercityOwnVehicleUsed
    : false

  // Inter-city own-vehicle flow implicitly includes intra-city movement in the destination city.
  const intracityVehicleMode = wlFlags.requires_outstation_details
    ? hasIntercityTravel
      ? 'OWN_VEHICLE'
      : input.intracityTravelUsed === true
        ? (input.intracityVehicleMode ?? null)
        : null
    : null

  if (
    wlFlags.requires_outstation_details &&
    input.intercityOwnVehicleUsed === false &&
    intracityTravelSelection === true &&
    !intracityVehicleMode
  ) {
    return {
      ok: false,
      error:
        'Please select the vehicle type used within the city (Own Vehicle or Rent Vehicle).',
    }
  }

  const hasDirectIntracityTravel = wlFlags.requires_outstation_details
    ? intracityTravelSelection === true
    : false

  const intracityOwnVehicleUsed = wlFlags.requires_outstation_details
    ? hasIntercityTravel || intracityVehicleMode === 'OWN_VEHICLE'
    : false

  const hasIntracityTravel = wlFlags.requires_outstation_details
    ? hasIntercityTravel || hasDirectIntracityTravel
    : false

  const effectiveOutstationCityId = hasIntracityTravel
    ? (input.outstationCityId ??
      (hasIntercityTravel ? input.toCityId : undefined))
    : undefined

  const hasAnyOutstationCityTravel = hasIntercityTravel || hasIntracityTravel

  const isOutstationOwnVehicle =
    intercityOwnVehicleUsed || intracityOwnVehicleUsed

  // ── Server-side conditional field validation based on DB flags ──
  if (wlFlags.requires_vehicle_selection && !input.vehicleType) {
    return {
      ok: false,
      error: 'Vehicle type is required for this work location.',
    }
  }

  if (wlFlags.requires_outstation_details) {
    const hasAnyOutstationTravel = hasIntercityTravel || hasIntracityTravel

    if (hasAnyOutstationTravel && !input.outstationStateId) {
      return { ok: false, error: 'State is required.' }
    }

    if (hasIntercityTravel && !input.fromCityId) {
      return {
        ok: false,
        error: 'From city is required for outstation travel.',
      }
    }

    if (hasIntercityTravel && !input.toCityId) {
      return { ok: false, error: 'To city is required for outstation travel.' }
    }

    if (hasIntercityTravel && input.fromCityId && input.toCityId) {
      if (input.fromCityId === input.toCityId) {
        return {
          ok: false,
          error: 'Inter-city travel requires different From and To cities.',
        }
      }
    }

    if (hasIntracityTravel && !effectiveOutstationCityId) {
      return {
        ok: false,
        error: 'Intra-city city is required for outstation travel.',
      }
    }

    if (hasIntercityTravel && hasIntracityTravel) {
      if (
        effectiveOutstationCityId &&
        input.toCityId &&
        effectiveOutstationCityId !== input.toCityId
      ) {
        return {
          ok: false,
          error:
            'Intra-city city must match the Inter-city To City when both scopes are selected.',
        }
      }
    }

    if (isOutstationOwnVehicle) {
      if (!input.vehicleType) {
        return {
          ok: false,
          error: 'Vehicle type is required when using own vehicle.',
        }
      }

      if (
        intercityOwnVehicleUsed &&
        (!input.kmTravelled || input.kmTravelled <= 0)
      ) {
        return { ok: false, error: 'KM travelled must be greater than zero.' }
      }
    }

    const cityIdsToValidate: Array<string | undefined> = []
    if (hasIntercityTravel) {
      cityIdsToValidate.push(input.fromCityId, input.toCityId)
    }
    if (hasIntracityTravel) {
      cityIdsToValidate.push(effectiveOutstationCityId)
    }

    if (cityIdsToValidate.length > 0 && input.outstationStateId) {
      const cityValidationError = await validateCitiesForSelectedState(
        supabase,
        input.outstationStateId,
        cityIdsToValidate
      )

      if (cityValidationError) {
        return { ok: false, error: cityValidationError }
      }
    }
  }

  let vehicleTypeId: string | null = null
  if (
    wlFlags.requires_vehicle_selection ||
    (wlFlags.requires_outstation_details && hasAnyOutstationCityTravel)
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

  let resolvedBaseLocationDayType: ResolvedBaseLocationDayType | null = null

  if (wlFlags.requires_vehicle_selection) {
    const resolvedDayType = await resolveBaseLocationDayTypeSelection(
      supabase,
      input.baseLocationDayTypeCode
    )

    if ('error' in resolvedDayType) {
      return { ok: false, error: resolvedDayType.error }
    }

    resolvedBaseLocationDayType = resolvedDayType.value
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
      includeFoodAllowance:
        resolvedBaseLocationDayType?.include_food_allowance ?? true,
    })
  } else if (wlFlags.requires_outstation_details) {
    const vt = vehicleTypeId
      ? await getVehicleTypeById(supabase, vehicleTypeId)
      : null

    // Validate KM limit from DB (replaces hardcoded 150/300 check)
    if (
      hasIntercityTravel &&
      intercityOwnVehicleUsed &&
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

    draft = await calculateOutstationTravelItems(supabase, {
      workLocationId,
      designationId: employee.designation_id ?? '',
      vehicleType: vt,
      hasIntercityTravel,
      hasIntracityTravel,
      intercityOwnVehicleUsed,
      intracityOwnVehicleUsed,
      kmTravelled: input.kmTravelled,
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
    hasIntercityTravel: boolean
    hasIntracityTravel: boolean
    intracityVehicleMode: 'OWN_VEHICLE' | 'RENTAL_VEHICLE' | null
    intercityOwnVehicleUsed: boolean
    intracityOwnVehicleUsed: boolean
    outstationStateId?: string
    outstationCityId?: string
    fromCityId?: string
    toCityId?: string
    kmTravelled?: number
  }
  const outstation = isOutstation
    ? ({
        hasIntercityTravel,
        hasIntracityTravel,
        intracityVehicleMode,
        intercityOwnVehicleUsed,
        intracityOwnVehicleUsed,
        outstationStateId: input.outstationStateId,
        outstationCityId: effectiveOutstationCityId,
        fromCityId: input.fromCityId,
        toCityId: input.toCityId,
        kmTravelled: input.kmTravelled,
      } satisfies OutstationInput)
    : null

  const hasIntercityScope =
    isOutstation && outstation?.hasIntercityTravel === true
  const hasIntracityScope =
    isOutstation && outstation?.hasIntracityTravel === true
  const hasOwnVehicle =
    isOutstation &&
    (outstation?.intercityOwnVehicleUsed === true ||
      outstation?.intracityOwnVehicleUsed === true)

  const derivedOutstationCityId = isOutstation
    ? (outstation?.outstationCityId ??
      (hasIntercityScope ? (outstation?.toCityId ?? null) : null))
    : null

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
    let newClaim: { id: string; claim_number: string }

    try {
      newClaim = await insertClaim(supabase, {
        employeeId: employee.id,
        claimDateIso: input.claimDate.iso,
        workLocationId,
        baseLocationDayTypeCode: isBaseLocation
          ? (resolvedBaseLocationDayType?.day_type_code ?? null)
          : null,
        ownVehicleUsed: isOutstation ? hasOwnVehicle : null,
        vehicleTypeId: isBaseLocation || hasOwnVehicle ? vehicleTypeId : null,
        outstationStateId: outstation?.outstationStateId ?? null,
        outstationCityId: derivedOutstationCityId,
        fromCityId: hasIntercityScope ? (outstation?.fromCityId ?? null) : null,
        toCityId: hasIntercityScope ? (outstation?.toCityId ?? null) : null,
        kmTravelled:
          hasIntercityScope && outstation?.intercityOwnVehicleUsed
            ? (outstation?.kmTravelled ?? null)
            : null,
        hasIntercityTravel: isOutstation ? hasIntercityScope : false,
        hasIntracityTravel: isOutstation ? hasIntracityScope : false,
        intercityOwnVehicleUsed: hasIntercityScope
          ? (outstation?.intercityOwnVehicleUsed ?? false)
          : null,
        intracityOwnVehicleUsed: hasIntracityScope
          ? (outstation?.intracityOwnVehicleUsed ?? false)
          : null,
        intracityVehicleMode: hasIntracityScope
          ? (outstation?.intracityVehicleMode ?? null)
          : null,
        totalAmount: draft.total,
        statusId: initialWorkflowState.statusId,
        currentApprovalLevel: initialWorkflowState.currentApprovalLevel,
        submittedAt: new Date().toISOString(),
        designationId: employee.designation_id,
        accommodationNights: null,
        foodWithPrincipalsAmount: isOutstation
          ? (input.foodWithPrincipalsAmount ?? null)
          : null,
      })
    } catch (error) {
      const userMessage = mapClaimInsertErrorToUserMessage(error)
      if (userMessage) {
        return { ok: false, error: userMessage }
      }
      throw error
    }

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

  let claim: { id: string; claim_number: string }

  try {
    claim = await insertClaim(supabase, {
      employeeId: employee.id,
      claimDateIso: input.claimDate.iso,
      workLocationId,
      baseLocationDayTypeCode: isBaseLocation
        ? (resolvedBaseLocationDayType?.day_type_code ?? null)
        : null,
      ownVehicleUsed: isOutstation ? hasOwnVehicle : null,
      vehicleTypeId: isBaseLocation || hasOwnVehicle ? vehicleTypeId : null,
      outstationStateId: outstation?.outstationStateId ?? null,
      outstationCityId: derivedOutstationCityId,
      fromCityId: hasIntercityScope ? (outstation?.fromCityId ?? null) : null,
      toCityId: hasIntercityScope ? (outstation?.toCityId ?? null) : null,
      kmTravelled:
        hasIntercityScope && outstation?.intercityOwnVehicleUsed
          ? (outstation?.kmTravelled ?? null)
          : null,
      hasIntercityTravel: isOutstation ? hasIntercityScope : false,
      hasIntracityTravel: isOutstation ? hasIntracityScope : false,
      intercityOwnVehicleUsed: hasIntercityScope
        ? (outstation?.intercityOwnVehicleUsed ?? false)
        : null,
      intracityOwnVehicleUsed: hasIntracityScope
        ? (outstation?.intracityOwnVehicleUsed ?? false)
        : null,
      intracityVehicleMode: hasIntracityScope
        ? (outstation?.intracityVehicleMode ?? null)
        : null,
      totalAmount: draft.total,
      statusId: initialWorkflowState.statusId,
      currentApprovalLevel: initialWorkflowState.currentApprovalLevel,
      submittedAt: new Date().toISOString(),
      designationId: employee.designation_id,
      accommodationNights: null,
      foodWithPrincipalsAmount: isOutstation
        ? (input.foodWithPrincipalsAmount ?? null)
        : null,
    })
  } catch (error) {
    const userMessage = mapClaimInsertErrorToUserMessage(error)
    if (userMessage) {
      return { ok: false, error: userMessage }
    }
    throw error
  }

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
