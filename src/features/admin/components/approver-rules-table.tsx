'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { upsertApproverRuleAction } from '@/features/admin/actions'

type DesignationOption = {
  id: string
  designation_name: string
}

type ApproverRuleRow = {
  id: string
  approval_level: number
  designation_id: string
  designation_name: string
  requires_same_state: boolean
  is_active: boolean
}

type Props = {
  rules: ApproverRuleRow[]
  designations: DesignationOption[]
}

type DraftRule = {
  approvalLevel: number
  designationId: string
  requiresSameState: boolean
  isActive: boolean
}

const INITIAL_DRAFT: DraftRule = {
  approvalLevel: 1,
  designationId: '',
  requiresSameState: true,
  isActive: true,
}

export function ApproverRulesTable({ rules, designations }: Props) {
  const router = useRouter()
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftRule>(INITIAL_DRAFT)

  async function saveRule(payload: DraftRule, key: string) {
    setPendingKey(key)
    const result = await upsertApproverRuleAction(payload)

    if (!result.ok) {
      toast.error(result.error ?? 'Failed to save approver rule.')
      setPendingKey(null)
      return
    }

    toast.success('Approver rule saved.')
    setPendingKey(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-foreground">Add Rule</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure which designation can appear at each approver level.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <label className="text-xs font-medium text-foreground">
            Level
            <select
              value={draft.approvalLevel}
              onChange={(e) => {
                const approvalLevel = Number(e.currentTarget.value)
                setDraft((current) => ({
                  ...current,
                  approvalLevel,
                }))
              }}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value={1}>Level 1</option>
              <option value={2}>Level 2</option>
              <option value={3}>Level 3</option>
            </select>
          </label>

          <label className="text-xs font-medium text-foreground md:col-span-2">
            Designation
            <select
              value={draft.designationId}
              onChange={(e) => {
                const designationId = e.currentTarget.value
                setDraft((current) => ({
                  ...current,
                  designationId,
                }))
              }}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">Select designation</option>
              {designations.map((designation) => (
                <option key={designation.id} value={designation.id}>
                  {designation.designation_name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-foreground md:mt-6">
            <input
              type="checkbox"
              checked={draft.requiresSameState}
              onChange={(e) => {
                const requiresSameState = e.currentTarget.checked
                setDraft((current) => ({
                  ...current,
                  requiresSameState,
                }))
              }}
              className="size-4"
            />
            Same state only
          </label>

          <button
            type="button"
            disabled={!draft.designationId || pendingKey === 'new-rule'}
            onClick={() => saveRule(draft, 'new-rule')}
            className="h-9 self-end rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pendingKey === 'new-rule' ? 'Saving...' : 'Save Rule'}
          </button>
        </div>
      </section>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                Level
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                Designation
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
                Same State
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
                Active
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((rule) => {
              const key = `${rule.approval_level}-${rule.designation_id}`
              const isPending = pendingKey === key

              return (
                <tr key={rule.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2">Level {rule.approval_level}</td>
                  <td className="px-3 py-2 font-medium">
                    {rule.designation_name}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        saveRule(
                          {
                            approvalLevel: rule.approval_level,
                            designationId: rule.designation_id,
                            requiresSameState: !rule.requires_same_state,
                            isActive: rule.is_active,
                          },
                          key
                        )
                      }
                      className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                    >
                      {rule.requires_same_state ? 'Same State' : 'Any State'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        saveRule(
                          {
                            approvalLevel: rule.approval_level,
                            designationId: rule.designation_id,
                            requiresSameState: rule.requires_same_state,
                            isActive: !rule.is_active,
                          },
                          key
                        )
                      }
                      className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                    >
                      {isPending
                        ? 'Saving...'
                        : rule.is_active
                          ? 'Deactivate'
                          : 'Activate'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
