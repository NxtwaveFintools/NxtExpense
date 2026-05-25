'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  createStateAction,
  toggleStateActiveAction,
  updateStateAction,
} from '@/features/admin/actions'
import { confirmAdminAction } from '@/features/admin/components/confirm-admin-action'
import type { AdminState } from '@/features/admin/components/state-city-types'

type Props = {
  states: AdminState[]
}

export function StateManagementPanel({ states }: Props) {
  const router = useRouter()
  const [newStateName, setNewStateName] = useState('')
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  async function handleCreateState() {
    const normalized = newStateName.trim()

    if (!normalized) {
      toast.error('State name is required.')
      return
    }

    const isConfirmed = await confirmAdminAction(
      `Create state "${normalized}"?\n\nThis action writes to master configuration.`
    )

    if (!isConfirmed) {
      return
    }

    setPendingKey('create-state')

    const result = await createStateAction({
      stateName: normalized,
      confirmation: 'CONFIRM',
    })

    setPendingKey(null)

    if (!result.ok) {
      toast.error(result.error ?? 'Failed to create state.')
      return
    }

    toast.success(`State created: ${result.state?.state_name ?? normalized}.`)
    setNewStateName('')
    router.refresh()
  }

  function startEdit(state: AdminState) {
    setEditingId(state.id)
    setEditingName(state.state_name)
  }

  async function handleUpdateState(stateId: string) {
    const normalized = editingName.trim()

    if (!normalized) {
      toast.error('State name is required.')
      return
    }

    const isConfirmed = await confirmAdminAction(
      `Rename state to "${normalized}"?\n\nExisting claims remain unchanged.`
    )

    if (!isConfirmed) {
      return
    }

    setPendingKey(`update-${stateId}`)

    const result = await updateStateAction({
      id: stateId,
      stateName: normalized,
      confirmation: 'CONFIRM',
    })

    setPendingKey(null)

    if (!result.ok) {
      toast.error(result.error ?? 'Failed to update state.')
      return
    }

    toast.success(`State updated: ${result.state?.state_name ?? normalized}.`)
    setEditingId(null)
    setEditingName('')
    router.refresh()
  }

  async function handleToggleState(state: AdminState) {
    const nextState = !state.is_active
    const actionLabel = nextState ? 'activate' : 'deactivate'

    const isConfirmed = await confirmAdminAction(
      `${actionLabel[0]?.toUpperCase() ?? ''}${actionLabel.slice(1)} state "${state.state_name}"?`
    )

    if (!isConfirmed) {
      return
    }

    setPendingKey(`toggle-${state.id}`)

    const result = await toggleStateActiveAction({
      id: state.id,
      isActive: nextState,
      confirmation: 'CONFIRM',
    })

    setPendingKey(null)

    if (!result.ok) {
      toast.error(result.error ?? 'Failed to update state status.')
      return
    }

    toast.success(
      `State ${nextState ? 'activated' : 'deactivated'}: ${state.state_name}.`
    )
    router.refresh()
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <header>
        <h3 className="text-base font-semibold text-foreground">States</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create, rename, and toggle states. Deactivating a state disables it
          for new claims.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input
          value={newStateName}
          onChange={(event) => setNewStateName(event.currentTarget.value)}
          placeholder="Add state name"
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          data-testid="admin-state-name-input"
        />
        <button
          type="button"
          onClick={handleCreateState}
          disabled={pendingKey === 'create-state' || !newStateName.trim()}
          className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          data-testid="admin-add-state-button"
        >
          {pendingKey === 'create-state' ? 'Creating...' : 'Add State'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                Code
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                State Name
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
            {states.map((state) => {
              const isEditing = editingId === state.id
              const isUpdating = pendingKey === `update-${state.id}`
              const isToggling = pendingKey === `toggle-${state.id}`

              return (
                <tr key={state.id} data-testid={`admin-state-row-${state.id}`}>
                  <td className="px-3 py-2 font-mono text-xs">
                    {state.state_code}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        value={editingName}
                        onChange={(event) =>
                          setEditingName(event.currentTarget.value)
                        }
                        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                        data-testid={`admin-state-edit-input-${state.id}`}
                      />
                    ) : (
                      <span className="font-medium">{state.state_name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        state.is_active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {state.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateState(state.id)}
                            disabled={isUpdating || !editingName.trim()}
                            className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs text-green-700 disabled:opacity-50"
                          >
                            {isUpdating ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null)
                              setEditingName('')
                            }}
                            className="rounded border border-border px-2 py-1 text-xs"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(state)}
                            className="rounded border border-border px-2 py-1 text-xs"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleState(state)}
                            disabled={isToggling}
                            className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                            data-testid={`admin-state-toggle-${state.id}`}
                          >
                            {isToggling
                              ? 'Updating...'
                              : state.is_active
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
    </section>
  )
}
