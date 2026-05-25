'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  bulkImportCitiesAction,
  createCityAction,
  toggleCityActiveAction,
  updateCityAction,
} from '@/features/admin/actions'
import { CityBulkImportSummary } from '@/features/admin/components/city-bulk-import-summary'
import { confirmAdminAction } from '@/features/admin/components/confirm-admin-action'
import { CityManagementTable } from '@/features/admin/components/city-management-table'
import type {
  AdminCity,
  AdminState,
  BulkImportSummary,
} from '@/features/admin/components/state-city-types'

type Props = {
  states: AdminState[]
  cities: AdminCity[]
}

export function CityManagementPanel({ states, cities }: Props) {
  const router = useRouter()
  const [selectedStateId, setSelectedStateId] = useState(states[0]?.id ?? '')
  const [newCityName, setNewCityName] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [editingCityId, setEditingCityId] = useState<string | null>(null)
  const [editingCityName, setEditingCityName] = useState('')
  const [lastSummary, setLastSummary] = useState<BulkImportSummary | null>(null)
  const [citySearch, setCitySearch] = useState('')

  const selectedState = useMemo(
    () => states.find((state) => state.id === selectedStateId) ?? null,
    [selectedStateId, states]
  )

  const filteredCities = useMemo(() => {
    const search = citySearch.trim().toLowerCase()
    return cities
      .filter((city) => city.state_id === selectedStateId)
      .filter(
        (city) => !search || city.city_name.toLowerCase().includes(search)
      )
      .sort((a, b) => a.city_name.localeCompare(b.city_name))
  }, [cities, selectedStateId, citySearch])

  async function handleCreateCity() {
    const normalized = newCityName.trim()

    if (!selectedStateId || !normalized) {
      toast.error('Select a state and provide city name.')
      return
    }

    const isConfirmed = await confirmAdminAction(
      `Create city "${normalized}" in "${selectedState?.state_name ?? 'selected state'}"?`
    )

    if (!isConfirmed) {
      return
    }

    setPendingKey('create-city')

    const result = await createCityAction({
      stateId: selectedStateId,
      cityName: normalized,
      confirmation: 'CONFIRM',
    })

    setPendingKey(null)

    if (!result.ok) {
      toast.error(result.error ?? 'Failed to create city.')
      return
    }

    toast.success(`City created: ${result.city?.city_name ?? normalized}.`)
    setNewCityName('')
    router.refresh()
  }

  function startEditCity(city: AdminCity) {
    setEditingCityId(city.id)
    setEditingCityName(city.city_name)
  }

  function cancelEditCity() {
    setEditingCityId(null)
    setEditingCityName('')
  }

  async function handleUpdateCity(cityId: string) {
    const normalized = editingCityName.trim()

    if (!normalized) {
      toast.error('City name is required.')
      return
    }

    const isConfirmed = await confirmAdminAction(
      `Rename city to "${normalized}"?\n\nHistorical claims keep frozen names.`
    )

    if (!isConfirmed) {
      return
    }

    setPendingKey(`update-${cityId}`)

    const result = await updateCityAction({
      id: cityId,
      cityName: normalized,
      confirmation: 'CONFIRM',
    })

    setPendingKey(null)

    if (!result.ok) {
      toast.error(result.error ?? 'Failed to update city.')
      return
    }

    toast.success(`City updated: ${result.city?.city_name ?? normalized}.`)
    cancelEditCity()
    router.refresh()
  }

  async function handleToggleCity(city: AdminCity) {
    const nextState = !city.is_active
    const actionLabel = nextState ? 'activate' : 'deactivate'

    const isConfirmed = await confirmAdminAction(
      `${actionLabel[0]?.toUpperCase() ?? ''}${actionLabel.slice(1)} city "${city.city_name}"?`
    )

    if (!isConfirmed) {
      return
    }

    setPendingKey(`toggle-${city.id}`)

    const result = await toggleCityActiveAction({
      id: city.id,
      isActive: nextState,
      confirmation: 'CONFIRM',
    })

    setPendingKey(null)

    if (!result.ok) {
      toast.error(result.error ?? 'Failed to update city status.')
      return
    }

    toast.success(
      `City ${nextState ? 'activated' : 'deactivated'} successfully.`
    )
    router.refresh()
  }

  async function handleBulkImport() {
    const normalized = bulkInput.trim()

    if (!selectedStateId || !normalized) {
      toast.error('Select a state and provide city list.')
      return
    }

    const isConfirmed = await confirmAdminAction(
      `Import cities into "${selectedState?.state_name ?? 'selected state'}"?\n\nInput supports comma or newline separated values.`
    )

    if (!isConfirmed) {
      return
    }

    setPendingKey('bulk-import')

    const result = await bulkImportCitiesAction({
      stateId: selectedStateId,
      rawInput: normalized,
      confirmation: 'CONFIRM',
    })

    setPendingKey(null)

    if (!result.ok || !result.summary) {
      toast.error(result.error ?? 'Bulk city import failed.')
      return
    }

    setLastSummary(result.summary)
    toast.success(
      `Import completed: ${result.summary.insertedCount} inserted, ${result.summary.duplicateCount} duplicates, ${result.summary.invalidCount} invalid.`
    )
    setBulkInput('')
    router.refresh()
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <header>
        <h3 className="text-base font-semibold text-foreground">Cities</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage city masters per state. Bulk import supports comma or newline
          separated values with case-insensitive dedupe.
        </p>
      </header>

      <div className="grid gap-2 md:grid-cols-[200px_minmax(0,1fr)_auto]">
        <select
          value={selectedStateId}
          onChange={(event) => setSelectedStateId(event.currentTarget.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          data-testid="admin-city-state-filter"
        >
          {states.map((state) => (
            <option key={state.id} value={state.id}>
              {state.state_name} ({state.state_code})
            </option>
          ))}
        </select>
        <input
          value={newCityName}
          onChange={(event) => setNewCityName(event.currentTarget.value)}
          placeholder="Add city name"
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          data-testid="admin-city-name-input"
        />
        <button
          type="button"
          onClick={handleCreateCity}
          disabled={pendingKey === 'create-city' || !newCityName.trim()}
          className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          data-testid="admin-add-city-button"
        >
          {pendingKey === 'create-city' ? 'Creating...' : 'Add City'}
        </button>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-background p-3">
        <label
          htmlFor="bulk-city-import"
          className="text-sm font-medium text-foreground"
        >
          Bulk city import
        </label>
        <textarea
          id="bulk-city-import"
          value={bulkInput}
          onChange={(event) => setBulkInput(event.currentTarget.value)}
          placeholder="Example: Jaipur, Jodhpur\nUdaipur"
          rows={4}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          data-testid="admin-bulk-city-input"
        />
        <button
          type="button"
          onClick={handleBulkImport}
          disabled={pendingKey === 'bulk-import' || !bulkInput.trim()}
          className="rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
          data-testid="admin-bulk-city-import-button"
        >
          {pendingKey === 'bulk-import' ? 'Importing...' : 'Import Cities'}
        </button>
      </div>

      {lastSummary ? <CityBulkImportSummary summary={lastSummary} /> : null}

      <div className="flex items-center gap-2">
        <input
          value={citySearch}
          onChange={(event) => setCitySearch(event.currentTarget.value)}
          placeholder="Search cities…"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground"
          data-testid="admin-city-search-input"
        />
        {citySearch ? (
          <button
            type="button"
            onClick={() => setCitySearch('')}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        ) : null}
      </div>

      <CityManagementTable
        cities={filteredCities}
        editingCityId={editingCityId}
        editingCityName={editingCityName}
        pendingKey={pendingKey}
        onStartEdit={startEditCity}
        onCancelEdit={cancelEditCity}
        onEditCityName={setEditingCityName}
        onSaveEdit={handleUpdateCity}
        onToggleCity={handleToggleCity}
      />
    </section>
  )
}
