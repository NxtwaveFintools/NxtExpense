/**
 * Read-only DB helpers for e2e tests that need to assert against the *live*
 * expense-rate configuration instead of hard-coded amounts.
 *
 * WHY: food allowance rates (and per-state overrides) are time-windowed in
 * `expense_rates` and change over time. The submit orchestrator resolves them
 * as-of TODAY (`rateLookupDateIso = new Date()`) using the SUBMITTER's PRIMARY
 * state — NOT the claim date and NOT the selected outstation state
 * (see src/features/claims/server/services/submit-claim.orchestrator.ts and
 * src/lib/services/config-service.ts `getExpenseRateByType`). Tests therefore
 * derive the expected amount the same way so they never go stale when rates
 * are re-priced or overrides expire.
 *
 * Uses the service-role key (already present in .env.local for the dev
 * provisioning scripts) because `employees` / `employee_states` are only
 * readable by the `authenticated` role under RLS.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'

let cachedClient: SupabaseClient | null = null

function getServiceClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient
  }

  // Playwright workers don't load .env.local on their own; do it here.
  loadEnvConfig(process.cwd())

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'expense-rates-db helper requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local).'
    )
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return cachedClient
}

/** Matches the app's `rateLookupDateIso = new Date().toISOString().slice(0, 10)`. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Resolve a submitter's primary state id exactly like
 * `getEmployeePrimaryStateId` (prefer `is_primary`, else the earliest row).
 * Returns null when the employee has no state mapping.
 */
async function getEmployeePrimaryStateIdByEmail(
  email: string
): Promise<string | null> {
  const supabase = getServiceClient()

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('id')
    .eq('employee_email', email)
    .maybeSingle()

  if (employeeError) {
    throw new Error(
      `Failed to load employee ${email}: ${employeeError.message}`
    )
  }

  if (!employee) {
    throw new Error(`No employee row found for ${email}`)
  }

  const { data: states, error: statesError } = await supabase
    .from('employee_states')
    .select('state_id, is_primary, created_at')
    .eq('employee_id', employee.id)

  if (statesError) {
    throw new Error(
      `Failed to load states for ${email}: ${statesError.message}`
    )
  }

  if (!states || states.length === 0) {
    return null
  }

  const primary =
    states.find((row) => row.is_primary) ??
    [...states].sort((a, b) =>
      String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
    )[0]

  return primary?.state_id ?? null
}

/**
 * Resolve the active food allowance amount the orchestrator would snapshot for
 * a submitter, replicating `getExpenseRateByType`: a state-specific override
 * (if one is active today) wins over the national rate; latest `effective_from`
 * then `created_at` breaks ties.
 *
 * `expenseType` is 'FOOD_BASE' or 'FOOD_OUTSTATION'. Each food type only has
 * rows for its single work location, so filtering by `expense_type` alone is
 * equivalent to the app's `location_id` filter.
 */
async function resolveActiveFoodAllowance(
  expenseType: 'FOOD_BASE' | 'FOOD_OUTSTATION',
  primaryStateId: string | null,
  asOfDateIso: string = todayIso()
): Promise<number> {
  const supabase = getServiceClient()

  const selectActiveRate = async (
    stateFilter: 'state' | 'national'
  ): Promise<number | null> => {
    let query = supabase
      .from('expense_rates')
      .select('rate_amount, effective_from, created_at')
      .eq('expense_type', expenseType)
      .is('designation_id', null)
      .eq('is_active', true)
      .lte('effective_from', asOfDateIso)
      .or(`effective_to.is.null,effective_to.gte.${asOfDateIso}`)
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)

    query =
      stateFilter === 'state' && primaryStateId
        ? query.eq('state_id', primaryStateId)
        : query.is('state_id', null)

    const { data, error } = await query.maybeSingle()

    if (error) {
      throw new Error(
        `Failed to resolve ${expenseType} (${stateFilter}) rate: ${error.message}`
      )
    }

    return data ? Number(data.rate_amount) : null
  }

  if (primaryStateId) {
    const stateRate = await selectActiveRate('state')
    if (stateRate !== null) {
      return stateRate
    }
  }

  const nationalRate = await selectActiveRate('national')
  if (nationalRate === null) {
    throw new Error(
      `No active national ${expenseType} rate found as of ${asOfDateIso}.`
    )
  }

  return nationalRate
}

/** Convenience: resolve the food amount the orchestrator snapshots for a submitter. */
export async function resolveExpectedFoodForSubmitter(
  submitterEmail: string,
  mode: 'base' | 'outstation'
): Promise<number> {
  const primaryStateId = await getEmployeePrimaryStateIdByEmail(submitterEmail)
  const expenseType = mode === 'base' ? 'FOOD_BASE' : 'FOOD_OUTSTATION'
  return resolveActiveFoodAllowance(expenseType, primaryStateId)
}
