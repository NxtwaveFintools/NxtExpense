import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { ClaimSubmissionForm } from '@/features/claims/components/claim-submission-form'
import type { ClaimFormInitialValues } from '@/features/claims/types'
import { getClaimById } from '@/features/claims/queries'
import { getEmployeeByEmail } from '@/features/employees/queries'
import { canAccessEmployeeClaims } from '@/features/employees/permissions'

const WORK_LOCATION_OPTIONS = [
  'Office / WFH',
  'Field - Base Location',
  'Field - Outstation',
  'Leave',
  'Week-off',
] as const

const TRANSPORT_TYPE_OPTIONS = ['Rental Vehicle', 'Rapido/Uber/Ola'] as const

type NewClaimPageProps = {
  searchParams?: Promise<{
    editClaimId?: string
  }>
}

export default async function NewClaimPage({
  searchParams,
}: NewClaimPageProps) {
  const user = await requireCurrentUser('/login')
  const supabase = await createSupabaseServerClient()
  const employee = await getEmployeeByEmail(supabase, user.email ?? '')

  if (!employee || !canAccessEmployeeClaims(employee)) {
    redirect('/dashboard')
  }

  const resolvedSearch = await searchParams
  const editClaimId = resolvedSearch?.editClaimId?.trim()

  let initialValues: ClaimFormInitialValues | null = null

  if (editClaimId) {
    const claimWithItems = await getClaimById(supabase, editClaimId)
    if (!claimWithItems) {
      redirect('/claims')
    }

    if (claimWithItems.claim.employee_id !== employee.id) {
      redirect('/claims')
    }

    if (claimWithItems.claim.status !== 'returned_for_modification') {
      redirect(`/claims/${claimWithItems.claim.id}`)
    }

    const taxiItem = claimWithItems.items.find(
      (item) => item.item_type === 'taxi_bill'
    )

    const transportType = taxiItem?.description?.includes('Rapido/Uber/Ola')
      ? 'Rapido/Uber/Ola'
      : 'Rental Vehicle'

    initialValues = {
      claimDateIso: claimWithItems.claim.claim_date,
      workLocation: claimWithItems.claim.work_location,
      vehicleType: claimWithItems.claim.vehicle_type,
      ownVehicleUsed: claimWithItems.claim.own_vehicle_used,
      transportType,
      outstationLocation: claimWithItems.claim.outstation_location,
      fromCity: claimWithItems.claim.from_city,
      toCity: claimWithItems.claim.to_city,
      kmTravelled: claimWithItems.claim.km_travelled
        ? Number(claimWithItems.claim.km_travelled)
        : null,
      taxiAmount: taxiItem ? Number(taxiItem.amount) : null,
    }
  }

  const { data: rateRows, error: rateError } = await supabase
    .from('expense_reimbursement_rates')
    .select('rate_type, vehicle_type, amount')
    .eq('designation', employee.designation)
    .in('rate_type', [
      'food_base_daily',
      'fuel_base_daily',
      'food_outstation_daily',
      'intercity_per_km',
    ])

  if (rateError) {
    throw new Error(rateError.message)
  }

  const allowedVehicleTypes = Array.from(
    new Set(
      (rateRows ?? [])
        .filter(
          (row) =>
            row.vehicle_type &&
            (row.rate_type === 'fuel_base_daily' ||
              row.rate_type === 'intercity_per_km')
        )
        .map((row) => row.vehicle_type)
    )
  ) as Array<'Two Wheeler' | 'Four Wheeler'>

  if (allowedVehicleTypes.length === 0) {
    allowedVehicleTypes.push('Two Wheeler')
  }

  const claimRateSnapshot = {
    foodBaseDaily: null as number | null,
    foodOutstationDaily: null as number | null,
    fuelBaseDailyByVehicle: {} as Record<string, number>,
    intercityPerKmByVehicle: {} as Record<string, number>,
  }

  for (const row of rateRows ?? []) {
    const amount = Number(row.amount)
    if (!Number.isFinite(amount)) {
      continue
    }

    if (row.rate_type === 'food_base_daily') {
      claimRateSnapshot.foodBaseDaily = amount
      continue
    }

    if (row.rate_type === 'food_outstation_daily') {
      claimRateSnapshot.foodOutstationDaily = amount
      continue
    }

    if (row.rate_type === 'fuel_base_daily' && row.vehicle_type) {
      claimRateSnapshot.fuelBaseDailyByVehicle[row.vehicle_type] = amount
      continue
    }

    if (row.rate_type === 'intercity_per_km' && row.vehicle_type) {
      claimRateSnapshot.intercityPerKmByVehicle[row.vehicle_type] = amount
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-4">
          <Link
            href="/claims"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to My Claims
          </Link>
        </div>
        <ClaimSubmissionForm
          allowedVehicleTypes={allowedVehicleTypes}
          workLocationOptions={WORK_LOCATION_OPTIONS}
          transportTypeOptions={TRANSPORT_TYPE_OPTIONS}
          claimRateSnapshot={claimRateSnapshot}
          initialValues={initialValues}
        />
      </div>
    </main>
  )
}
