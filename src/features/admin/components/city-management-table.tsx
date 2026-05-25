'use client'

import type { AdminCity } from '@/features/admin/components/state-city-types'

type Props = {
  cities: AdminCity[]
  editingCityId: string | null
  editingCityName: string
  pendingKey: string | null
  onStartEdit: (city: AdminCity) => void
  onCancelEdit: () => void
  onEditCityName: (value: string) => void
  onSaveEdit: (cityId: string) => Promise<void>
  onToggleCity: (city: AdminCity) => Promise<void>
}

export function CityManagementTable({
  cities,
  editingCityId,
  editingCityName,
  pendingKey,
  onStartEdit,
  onCancelEdit,
  onEditCityName,
  onSaveEdit,
  onToggleCity,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
              City Name
            </th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
              Status
            </th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {cities.map((city) => {
            const isEditing = editingCityId === city.id
            const isUpdating = pendingKey === `update-${city.id}`
            const isToggling = pendingKey === `toggle-${city.id}`

            return (
              <tr key={city.id} data-testid={`admin-city-row-${city.id}`}>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      value={editingCityName}
                      onChange={(event) =>
                        onEditCityName(event.currentTarget.value)
                      }
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                    />
                  ) : (
                    <span className="font-medium">{city.city_name}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      city.is_active
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {city.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onSaveEdit(city.id)}
                          disabled={isUpdating || !editingCityName.trim()}
                          className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs text-green-700 disabled:opacity-50"
                        >
                          {isUpdating ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          className="rounded border border-border px-2 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onStartEdit(city)}
                          className="rounded border border-border px-2 py-1 text-xs"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleCity(city)}
                          disabled={isToggling}
                          className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                        >
                          {isToggling
                            ? 'Updating...'
                            : city.is_active
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
          {cities.length === 0 ? (
            <tr>
              <td
                colSpan={3}
                className="px-3 py-4 text-center text-sm text-muted-foreground"
              >
                No cities found for selected state.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
