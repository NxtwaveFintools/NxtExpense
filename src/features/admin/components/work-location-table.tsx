'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { toggleWorkLocationActiveAction } from '@/features/admin/actions'

type WorkLocation = {
  id: string
  location_code: string
  location_name: string
  requires_vehicle_selection: boolean
  requires_outstation_details: boolean
  allows_expenses: boolean
  display_order: number
  is_active: boolean
}

type Props = { workLocations: WorkLocation[] }

export function WorkLocationTable({ workLocations }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)

  async function handleToggle(id: string, currentActive: boolean) {
    setPending(id)
    const result = await toggleWorkLocationActiveAction({
      id,
      isActive: !currentActive,
    })
    if (result.ok) {
      toast.success(
        `Work location ${currentActive ? 'deactivated' : 'activated'}.`
      )
      router.refresh()
    } else {
      toast.error(result.error ?? 'Failed to update.')
    }
    setPending(null)
  }

  const boolIcon = (v: boolean) => (v ? '✓' : '—')

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-foreground/70">
              Code
            </th>
            <th className="px-3 py-2 text-left font-medium text-foreground/70">
              Name
            </th>
            <th className="px-3 py-2 text-center font-medium text-foreground/70">
              Vehicle
            </th>
            <th className="px-3 py-2 text-center font-medium text-foreground/70">
              Outstation
            </th>
            <th className="px-3 py-2 text-center font-medium text-foreground/70">
              Expenses
            </th>
            <th className="px-3 py-2 text-center font-medium text-foreground/70">
              Order
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
          {workLocations.map((wl) => (
            <tr key={wl.id} className="hover:bg-muted/50">
              <td className="px-3 py-2 font-mono text-xs">
                {wl.location_code}
              </td>
              <td className="px-3 py-2 font-medium">{wl.location_name}</td>
              <td className="px-3 py-2 text-center">
                {boolIcon(wl.requires_vehicle_selection)}
              </td>
              <td className="px-3 py-2 text-center">
                {boolIcon(wl.requires_outstation_details)}
              </td>
              <td className="px-3 py-2 text-center">
                {boolIcon(wl.allows_expenses)}
              </td>
              <td className="px-3 py-2 text-center">{wl.display_order}</td>
              <td className="px-3 py-2 text-center">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    wl.is_active
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300'
                  }`}
                >
                  {wl.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-3 py-2 text-center">
                <button
                  type="button"
                  disabled={pending === wl.id}
                  onClick={() => handleToggle(wl.id, wl.is_active)}
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                >
                  {pending === wl.id
                    ? '...'
                    : wl.is_active
                      ? 'Deactivate'
                      : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
