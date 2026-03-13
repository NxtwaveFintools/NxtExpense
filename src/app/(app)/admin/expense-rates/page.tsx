import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils/date'
import { ExpenseRateTable } from '@/features/admin/components/expense-rate-table'

type ExpenseRateRow = {
  id: string
  expense_type: string
  rate_amount: number
  effective_from: string | null
  effective_to: string | null
  is_active: boolean
  designation_name: string | null
  location_name: string | null
}

async function getAllExpenseRates(
  supabase: SupabaseClient
): Promise<ExpenseRateRow[]> {
  const { data, error } = await supabase
    .from('expense_rates')
    .select(
      `
      id, expense_type, rate_amount, effective_from, effective_to, is_active,
      designations!designation_id ( designation_name ),
      work_locations!location_id ( location_name )
    `
    )
    .order('expense_type')
    .order('is_active', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const des = row.designations as unknown as {
      designation_name: string
    } | null
    const wl = row.work_locations as unknown as { location_name: string } | null

    return {
      id: row.id,
      expense_type: row.expense_type,
      rate_amount: Number(row.rate_amount),
      effective_from: row.effective_from
        ? formatDate(row.effective_from)
        : null,
      effective_to: row.effective_to ? formatDate(row.effective_to) : null,
      is_active: row.is_active ?? true,
      designation_name: des?.designation_name ?? null,
      location_name: wl?.location_name ?? null,
    }
  })
}

export default async function AdminExpenseRatesPage() {
  const supabase = await createSupabaseServerClient()
  const rates = await getAllExpenseRates(supabase)

  const activeCount = rates.filter((r) => r.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Expense Rates</h2>
        <span className="text-sm text-foreground/50">
          {activeCount} active / {rates.length} total
        </span>
      </div>

      <ExpenseRateTable rates={rates} />
    </div>
  )
}
