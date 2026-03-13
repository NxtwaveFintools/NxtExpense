import type { SupabaseClient } from '@supabase/supabase-js'

import type { ExpenseItemType } from '@/features/claims/types'

type ClaimPayload = {
  employeeId: string
  claimDateIso: string
  workLocationId: string | null
  ownVehicleUsed: boolean | null
  vehicleTypeId: string | null
  outstationCityId: string | null
  fromCityId: string | null
  toCityId: string | null
  kmTravelled: number | null
  totalAmount: number
  statusId: string | null
  currentApprovalLevel: number | null
  submittedAt: string | null
  designationId: string | null
  accommodationNights: number | null
  foodWithPrincipalsAmount: number | null
}

type InsertClaimItemInput = {
  claimId: string
  itemType: ExpenseItemType
  description: string | null
  amount: number
}

export async function insertClaim(
  supabase: SupabaseClient,
  input: ClaimPayload
): Promise<{ id: string; claim_number: string }> {
  const { data, error } = await supabase
    .from('expense_claims')
    .insert({
      employee_id: input.employeeId,
      claim_date: input.claimDateIso,
      work_location_id: input.workLocationId,
      own_vehicle_used: input.ownVehicleUsed,
      vehicle_type_id: input.vehicleTypeId,
      outstation_city_id: input.outstationCityId,
      from_city_id: input.fromCityId,
      to_city_id: input.toCityId,
      km_travelled: input.kmTravelled,
      total_amount: input.totalAmount,
      status_id: input.statusId,
      current_approval_level: input.currentApprovalLevel,
      submitted_at: input.submittedAt,
      designation_id: input.designationId,
      accommodation_nights: input.accommodationNights,
      food_with_principals_amount: input.foodWithPrincipalsAmount,
    })
    .select('id, claim_number')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as { id: string; claim_number: string }
}

export async function updateClaimDraftData(
  supabase: SupabaseClient,
  claimId: string,
  input: Omit<ClaimPayload, 'employeeId'>
): Promise<void> {
  const { error } = await supabase
    .from('expense_claims')
    .update({
      claim_date: input.claimDateIso,
      work_location_id: input.workLocationId,
      own_vehicle_used: input.ownVehicleUsed,
      vehicle_type_id: input.vehicleTypeId,
      outstation_city_id: input.outstationCityId,
      from_city_id: input.fromCityId,
      to_city_id: input.toCityId,
      km_travelled: input.kmTravelled,
      total_amount: input.totalAmount,
      status_id: input.statusId,
      current_approval_level: input.currentApprovalLevel,
      submitted_at: input.submittedAt,
      designation_id: input.designationId,
      accommodation_nights: input.accommodationNights,
      food_with_principals_amount: input.foodWithPrincipalsAmount,
    })
    .eq('id', claimId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function insertClaimItems(
  supabase: SupabaseClient,
  items: InsertClaimItemInput[]
): Promise<void> {
  if (items.length === 0) {
    return
  }

  const { error } = await supabase.from('expense_claim_items').insert(
    items.map((item) => ({
      claim_id: item.claimId,
      item_type: item.itemType,
      description: item.description,
      amount: item.amount,
    }))
  )

  if (error) {
    throw new Error(error.message)
  }
}

export async function replaceClaimItems(
  supabase: SupabaseClient,
  claimId: string,
  items: InsertClaimItemInput[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('expense_claim_items')
    .delete()
    .eq('claim_id', claimId)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  await insertClaimItems(supabase, items)
}

export async function getClaimForDate(
  supabase: SupabaseClient,
  employeeId: string,
  claimDateIso: string
): Promise<{
  id: string
  claim_number: string
  status_code: string
  current_approval_level: number | null
  is_rejection: boolean
  is_terminal: boolean
  allow_resubmit: boolean
  is_superseded: boolean
} | null> {
  // Only look at the ACTIVE (non-superseded) claim — the partial unique index
  // guarantees at most one exists per employee+date.
  const { data, error } = await supabase
    .from('expense_claims')
    .select(
      'id, claim_number, current_approval_level, allow_resubmit, is_superseded, claim_statuses!status_id(status_code, is_rejection, is_terminal)'
    )
    .eq('employee_id', employeeId)
    .eq('claim_date', claimDateIso)
    .eq('is_superseded', false)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  const row = data as unknown as {
    id: string
    claim_number: string
    current_approval_level: number | null
    allow_resubmit: boolean
    is_superseded: boolean
    claim_statuses:
      | { status_code: string; is_rejection: boolean; is_terminal: boolean }
      | Array<{
          status_code: string
          is_rejection: boolean
          is_terminal: boolean
        }>
  }
  const statusInfo = Array.isArray(row.claim_statuses)
    ? row.claim_statuses[0]
    : row.claim_statuses
  return {
    id: row.id,
    claim_number: row.claim_number,
    status_code: statusInfo?.status_code ?? 'UNKNOWN',
    current_approval_level: row.current_approval_level ?? null,
    allow_resubmit: row.allow_resubmit ?? false,
    is_superseded: row.is_superseded ?? false,
    is_rejection: statusInfo?.is_rejection ?? false,
    is_terminal: statusInfo?.is_terminal ?? false,
  }
}
