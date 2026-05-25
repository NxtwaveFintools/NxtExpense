import { createSupabaseServerClient } from '@/lib/supabase/server'
import { CityManagementPanel } from '@/features/admin/components/city-management-panel'
import { StateManagementPanel } from '@/features/admin/components/state-management-panel'
import type {
  AdminCity,
  AdminState,
} from '@/features/admin/components/state-city-types'

export default async function AdminStateCityPage() {
  const supabase = await createSupabaseServerClient()

  const [statesResult, citiesResult] = await Promise.all([
    supabase
      .from('states')
      .select('id, state_code, state_name, is_active, display_order')
      .order('display_order', { ascending: true })
      .order('state_name', { ascending: true }),
    supabase
      .from('cities')
      .select('id, city_name, state_id, is_active, display_order')
      .order('state_id', { ascending: true })
      .order('display_order', { ascending: true })
      .order('city_name', { ascending: true }),
  ])

  const queryError = statesResult.error ?? citiesResult.error
  if (queryError) {
    throw new Error(queryError.message)
  }

  const states = (statesResult.data ?? []) as AdminState[]
  const cities = (citiesResult.data ?? []) as AdminCity[]

  const activeStateCount = states.filter((state) => state.is_active).length
  const activeCityCount = cities.filter((city) => city.is_active).length

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-foreground">
          State & City Configuration
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {activeStateCount} active states / {states.length} total,{' '}
          {activeCityCount} active cities / {cities.length} total.
        </p>
      </header>

      <StateManagementPanel states={states} />
      <CityManagementPanel states={states} cities={cities} />
    </div>
  )
}
