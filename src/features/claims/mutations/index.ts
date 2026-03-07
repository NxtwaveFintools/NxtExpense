import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  ClaimStatus,
  ExpenseItemType,
  VehicleType,
  WorkLocation,
} from '@/features/claims/types'

type ClaimPayload = {
  employeeId: string
  claimDateIso: string
  workLocation: WorkLocation
  ownVehicleUsed: boolean | null
  vehicleType: VehicleType | null
  outstationLocation: string | null
  fromCity: string | null
  toCity: string | null
  kmTravelled: number | null
  totalAmount: number
  status: ClaimStatus
  currentApprovalLevel: number | null
  submittedAt: string | null
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
      work_location: input.workLocation,
      own_vehicle_used: input.ownVehicleUsed,
      vehicle_type: input.vehicleType,
      outstation_location: input.outstationLocation,
      from_city: input.fromCity,
      to_city: input.toCity,
      km_travelled: input.kmTravelled,
      total_amount: input.totalAmount,
      status: input.status,
      current_approval_level: input.currentApprovalLevel,
      submitted_at: input.submittedAt,
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
      work_location: input.workLocation,
      own_vehicle_used: input.ownVehicleUsed,
      vehicle_type: input.vehicleType,
      outstation_location: input.outstationLocation,
      from_city: input.fromCity,
      to_city: input.toCity,
      km_travelled: input.kmTravelled,
      total_amount: input.totalAmount,
      status: input.status,
      current_approval_level: input.currentApprovalLevel,
      submitted_at: input.submittedAt,
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
  status: ClaimStatus
} | null> {
  const { data, error } = await supabase
    .from('expense_claims')
    .select('id, claim_number, status')
    .eq('employee_id', employeeId)
    .eq('claim_date', claimDateIso)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  return data as { id: string; claim_number: string; status: ClaimStatus }
}

export async function getRateAmount(
  supabase: SupabaseClient,
  designation: string,
  rateType: string,
  vehicleType: VehicleType | null = null
): Promise<number> {
  let query = supabase
    .from('expense_reimbursement_rates')
    .select('amount')
    .eq('designation', designation)
    .eq('rate_type', rateType)

  query = vehicleType
    ? query.eq('vehicle_type', vehicleType)
    : query.is('vehicle_type', null)

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error(
      `Missing reimbursement rate for ${designation} / ${rateType}.`
    )
  }

  return Number(data.amount)
}
