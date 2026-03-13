'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  toggleVehicleTypeActiveAction,
  updateVehicleRatesAction,
} from '@/features/admin/actions'

type VehicleType = {
  id: string
  vehicle_code: string
  vehicle_name: string
  base_fuel_rate_per_day: number
  intercity_rate_per_km: number
  max_km_round_trip: number
  display_order: number
  is_active: boolean
}

type Props = { vehicleTypes: VehicleType[] }

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

export function VehicleTypeTable({ vehicleTypes }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ baseFuel: 0, intercity: 0, maxKm: 0 })

  async function handleToggle(id: string, currentActive: boolean) {
    setPending(id)
    const result = await toggleVehicleTypeActiveAction({
      id,
      isActive: !currentActive,
    })
    if (result.ok) {
      toast.success(
        `Vehicle type ${currentActive ? 'deactivated' : 'activated'}.`
      )
      router.refresh()
    } else {
      toast.error(result.error ?? 'Failed to update.')
    }
    setPending(null)
  }

  function startEdit(vt: VehicleType) {
    setEditing(vt.id)
    setDraft({
      baseFuel: vt.base_fuel_rate_per_day,
      intercity: vt.intercity_rate_per_km,
      maxKm: vt.max_km_round_trip,
    })
  }

  async function saveRates(id: string) {
    setPending(id)
    const result = await updateVehicleRatesAction({
      id,
      baseFuelRatePerDay: draft.baseFuel,
      intercityRatePerKm: draft.intercity,
      maxKmRoundTrip: draft.maxKm,
    })
    if (result.ok) {
      toast.success('Vehicle rates updated.')
      setEditing(null)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Failed to update rates.')
    }
    setPending(null)
  }

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
            <th className="px-3 py-2 text-right font-medium text-foreground/70">
              Base Fuel/Day
            </th>
            <th className="px-3 py-2 text-right font-medium text-foreground/70">
              Intercity/KM
            </th>
            <th className="px-3 py-2 text-right font-medium text-foreground/70">
              Max KM
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
          {vehicleTypes.map((vt) => {
            const isEditing = editing === vt.id
            return (
              <tr key={vt.id} className="hover:bg-muted/50">
                <td className="px-3 py-2 font-mono text-xs">
                  {vt.vehicle_code}
                </td>
                <td className="px-3 py-2 font-medium">{vt.vehicle_name}</td>
                <td className="px-3 py-2 text-right">
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={draft.baseFuel}
                      onChange={(e) =>
                        setDraft({ ...draft, baseFuel: +e.target.value })
                      }
                      className="w-20 rounded border border-border px-1 py-0.5 text-right text-xs"
                    />
                  ) : (
                    inr(vt.base_fuel_rate_per_day)
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={draft.intercity}
                      onChange={(e) =>
                        setDraft({ ...draft, intercity: +e.target.value })
                      }
                      className="w-20 rounded border border-border px-1 py-0.5 text-right text-xs"
                    />
                  ) : (
                    inr(vt.intercity_rate_per_km)
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={draft.maxKm}
                      onChange={(e) =>
                        setDraft({ ...draft, maxKm: +e.target.value })
                      }
                      className="w-20 rounded border border-border px-1 py-0.5 text-right text-xs"
                    />
                  ) : (
                    vt.max_km_round_trip
                  )}
                </td>
                <td className="px-3 py-2 text-center">{vt.display_order}</td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      vt.is_active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                  >
                    {vt.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          disabled={pending === vt.id}
                          onClick={() => saveRates(vt.id)}
                          className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          {pending === vt.id ? '...' : 'Save'}
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
                          onClick={() => startEdit(vt)}
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={pending === vt.id}
                          onClick={() => handleToggle(vt.id, vt.is_active)}
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                        >
                          {pending === vt.id
                            ? '...'
                            : vt.is_active
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
