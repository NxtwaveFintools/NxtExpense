'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { toggleDesignationActiveAction } from '@/features/admin/actions'

type Designation = {
  id: string
  designation_code: string
  designation_name: string
  designation_abbreviation: string | null
  hierarchy_level: number
  is_active: boolean
}

type Props = { designations: Designation[] }

export function DesignationTable({ designations }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)

  async function handleToggle(id: string, currentActive: boolean) {
    setPending(id)
    const result = await toggleDesignationActiveAction({
      id,
      isActive: !currentActive,
    })
    if (result.ok) {
      toast.success(
        `Designation ${currentActive ? 'deactivated' : 'activated'}.`
      )
      router.refresh()
    } else {
      toast.error(result.error ?? 'Failed to update.')
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
            <th className="px-3 py-2 text-left font-medium text-foreground/70">
              Abbreviation
            </th>
            <th className="px-3 py-2 text-center font-medium text-foreground/70">
              Hierarchy
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
          {designations.map((d) => (
            <tr key={d.id} className="hover:bg-muted/50">
              <td className="px-3 py-2 font-mono text-xs">
                {d.designation_code}
              </td>
              <td className="px-3 py-2 font-medium">{d.designation_name}</td>
              <td className="px-3 py-2 text-foreground/60">
                {d.designation_abbreviation ?? '—'}
              </td>
              <td className="px-3 py-2 text-center">{d.hierarchy_level}</td>
              <td className="px-3 py-2 text-center">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    d.is_active
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300'
                  }`}
                >
                  {d.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-3 py-2 text-center">
                <button
                  type="button"
                  disabled={pending === d.id}
                  onClick={() => handleToggle(d.id, d.is_active)}
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                >
                  {pending === d.id
                    ? '...'
                    : d.is_active
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
