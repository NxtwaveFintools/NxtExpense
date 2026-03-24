import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { ClaimSubmissionForm } from '@/features/claims/components/claim-submission-form'
import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { canAccessEmployeeClaims } from '@/features/employees/permissions'
import {
  getAllWorkLocations,
  getAllStates,
  getAllCities,
  getVehicleTypesByDesignation,
  getExpenseRateByType,
} from '@/lib/services/config-service'

export default async function NewClaimPage() {
  const user = await requireCurrentUser('/login')
  const supabase = await createSupabaseServerClient()
  const employee = await getEmployeeByEmail(supabase, user.email ?? '')

  if (!employee || !(await canAccessEmployeeClaims(supabase, employee))) {
    redirect('/dashboard')
  }

  const employeeStatusCode = employee.employee_statuses?.status_code ?? 'ACTIVE'

  if (employeeStatusCode !== 'ACTIVE') {
    redirect('/claims')
  }

  // Fetch lookup data from DB
  const [workLocations, allowedVehicles, states, cities] = await Promise.all([
    getAllWorkLocations(supabase),
    employee.designation_id
      ? getVehicleTypesByDesignation(supabase, employee.designation_id)
      : Promise.resolve([]),
    getAllStates(supabase),
    getAllCities(supabase),
  ])

  const workLocationOptions = workLocations
  const allowedVehicleTypes = allowedVehicles.map((vt) => ({
    id: vt.id,
    name: vt.vehicle_name,
  }))
  const stateOptions = states.map((s) => ({ id: s.id, name: s.state_name }))
  const cityOptions = cities.map((city) => ({
    id: city.id,
    name: city.city_name,
    stateId: city.state_id,
  }))

  // Build rate snapshot from new lookup tables
  const baseLocationId = workLocations.find(
    (wl) => wl.location_code === 'FIELD_BASE'
  )?.id
  const outstationLocationId = workLocations.find(
    (wl) => wl.location_code === 'FIELD_OUTSTATION'
  )?.id

  const [foodBaseRate, foodOutstationRate, fwpRate] = await Promise.all([
    baseLocationId
      ? getExpenseRateByType(supabase, baseLocationId, 'FOOD_BASE', null)
      : Promise.resolve(null),
    outstationLocationId
      ? getExpenseRateByType(
          supabase,
          outstationLocationId,
          'FOOD_OUTSTATION',
          null
        )
      : Promise.resolve(null),
    outstationLocationId && employee.designation_id
      ? getExpenseRateByType(
          supabase,
          outstationLocationId,
          'FOOD_WITH_PRINCIPALS',
          employee.designation_id
        )
      : Promise.resolve(null),
  ])

  const intracityDailyByVehicle = Object.fromEntries(
    allowedVehicles.map((vt) => [vt.id, Number(vt.base_fuel_rate_per_day)])
  ) as Record<string, number>

  const claimRateSnapshot = {
    foodBaseDaily: foodBaseRate ? Number(foodBaseRate.rate_amount) : null,
    foodOutstationDaily: foodOutstationRate
      ? Number(foodOutstationRate.rate_amount)
      : null,
    fuelBaseDailyByVehicle: Object.fromEntries(
      allowedVehicles.map((vt) => [vt.id, Number(vt.base_fuel_rate_per_day)])
    ) as Record<string, number>,
    intercityPerKmByVehicle: Object.fromEntries(
      allowedVehicles.map((vt) => [vt.id, Number(vt.intercity_rate_per_km)])
    ) as Record<string, number>,
    intracityDailyByVehicle,
    maxKmRoundTripByVehicle: Object.fromEntries(
      allowedVehicles.map((vt) => [vt.id, Number(vt.max_km_round_trip)])
    ) as Record<string, number>,
    foodWithPrincipalsMax: fwpRate ? Number(fwpRate.rate_amount) : null,
  }

  return (
    <>
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
            workLocationOptions={workLocationOptions}
            stateOptions={stateOptions}
            initialCityOptions={cityOptions}
            claimRateSnapshot={claimRateSnapshot}
            initialValues={null}
          />
        </div>
      </main>
    </>
  )
}
