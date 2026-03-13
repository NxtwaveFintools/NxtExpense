'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  toggleExpenseRateActiveAction,
  updateExpenseRateAction,
} from '@/features/admin/actions'

type ExpenseRate = {
  id: string
  expense_type: string
  rate_amount: number
  effective_from: string | null
  effective_to: string | null
  is_active: boolean
  designation_name: string | null
  location_name: string | null
}

type Props = { rates: ExpenseRate[] }

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

export function ExpenseRateTable({ rates }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draftAmount, setDraftAmount] = useState(0)

  async function handleToggle(id: string, currentActive: boolean) {
    setPending(id)
    const result = await toggleExpenseRateActiveAction({
      id,
      isActive: !currentActive,
    })
    if (result.ok) {
      toast.success(`Rate ${currentActive ? 'deactivated' : 'activated'}.`)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Failed to update.')
    }
    setPending(null)
  }

  function startEdit(rate: ExpenseRate) {
    setEditing(rate.id)
    setDraftAmount(rate.rate_amount)
  }

  async function saveRate(id: string) {
    setPending(id)
    const result = await updateExpenseRateAction({
      id,
      rateAmount: draftAmount,
    })
    if (result.ok) {
      toast.success('Rate updated.')
      setEditing(null)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Failed to update rate.')
    }
    setPending(null)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-foreground/70">
              Expense Type
            </th>
            <th className="px-3 py-2 text-left font-medium text-foreground/70">
              Location
            </th>
            <th className="px-3 py-2 text-left font-medium text-foreground/70">
              Designation
            </th>
            <th className="px-3 py-2 text-right font-medium text-foreground/70">
              Rate
            </th>
            <th className="px-3 py-2 text-center font-medium text-foreground/70">
              Effective From
            </th>
            <th className="px-3 py-2 text-center font-medium text-foreground/70">
              Effective To
            </th>
            <th className="px-3 py-2 text-center font-medium text-foreground/70">
              Status
            </th>
            <th className="px-3 py-2 text-center font-medium text-foreground/70">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rates.map((r) => {
            const isEditing = editing === r.id
            return (
              <tr key={r.id} className="hover:bg-muted/50">
                <td className="px-3 py-2 font-medium">{r.expense_type}</td>
                <td className="px-3 py-2 text-foreground/60">
                  {r.location_name ?? 'All Locations'}
                </td>
                <td className="px-3 py-2 text-foreground/60">
                  {r.designation_name ?? 'All Designations'}
                </td>
                <td className="px-3 py-2 text-right">
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={draftAmount}
                      onChange={(e) => setDraftAmount(+e.target.value)}
                      className="w-24 rounded border border-border px-1 py-0.5 text-right text-xs"
                    />
                  ) : (
                    inr(r.rate_amount)
                  )}
                </td>
                <td className="px-3 py-2 text-center text-foreground/60">
                  {r.effective_from ?? '—'}
                </td>
                <td className="px-3 py-2 text-center text-foreground/60">
                  {r.effective_to ?? '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.is_active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                  >
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          disabled={pending === r.id}
                          onClick={() => saveRate(r.id)}
                          className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          {pending === r.id ? '...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={pending === r.id}
                          onClick={() => handleToggle(r.id, r.is_active)}
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                        >
                          {pending === r.id
                            ? '...'
                            : r.is_active
                              ? 'Deactivate'
                              : 'Activate'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
