'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Search, Loader2 } from 'lucide-react'

import {
  searchEmployeesAction,
  reassignApproversAction,
} from '@/features/admin/actions'
import type { AdminEmployeeRow } from '@/features/admin/queries'

export function EmployeeManagement() {
  const [query, setQuery] = useState('')
  const [employees, setEmployees] = useState<AdminEmployeeRow[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Reassign state
  const [selectedEmployee, setSelectedEmployee] =
    useState<AdminEmployeeRow | null>(null)
  const [level1, setLevel1] = useState('')
  const [level2, setLevel2] = useState('')
  const [level3, setLevel3] = useState('')
  const [reassignReason, setReassignReason] = useState('')
  const [isReassigning, setIsReassigning] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return
    setIsSearching(true)
    setSearchError(null)

    const result = await searchEmployeesAction(query.trim())
    setIsSearching(false)

    if (!result.ok) {
      setSearchError(result.error)
      return
    }
    setEmployees(result.data)
  }

  function selectEmployee(emp: AdminEmployeeRow) {
    setSelectedEmployee(emp)
    setLevel1('')
    setLevel2('')
    setLevel3('')
    setReassignReason('')
  }

  async function handleReassign() {
    if (!selectedEmployee || !reassignReason.trim()) return
    setIsReassigning(true)

    const result = await reassignApproversAction({
      employeeId: selectedEmployee.id,
      approvalLevel1: level1.trim() || undefined,
      approvalLevel2: level2.trim() || undefined,
      approvalLevel3: level3.trim() || undefined,
      reason: reassignReason.trim(),
      confirmation: 'CONFIRM',
    })

    setIsReassigning(false)

    if (!result.ok) {
      toast.error(result.error ?? 'Reassignment failed')
      return
    }

    toast.success(
      `Approvers updated for ${selectedEmployee.employee_name}. ${result.impactedClaims ?? 0} active claims affected.`
    )
    setSelectedEmployee(null)
    setReassignReason('')
    handleSearch()
  }

  const inputCls =
    'h-10 w-full rounded-md border border-border bg-background px-4 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground'

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by name, email, or employee ID..."
            className={`${inputCls} pl-10`}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all duration-150 hover:bg-primary-hover hover:shadow-md disabled:opacity-50"
        >
          {isSearching ? <Loader2 className="size-4 animate-spin" /> : null}
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {searchError && (
        <p className="rounded-md border border-error/20 bg-error-light px-4 py-3 text-sm text-error">
          {searchError}
        </p>
      )}

      {/* Results table */}
      {employees.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide text-muted-foreground">
                  Employee ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide text-muted-foreground">
                  Designation
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide text-muted-foreground">
                  State
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide text-muted-foreground">
                  L1 Approver
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map((emp) => (
                <tr
                  key={emp.id}
                  className="transition-colors hover:bg-muted/50"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    {emp.employee_id}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{emp.employee_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {emp.employee_email}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {emp.designation}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {emp.state}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {emp.approval_employee_id_level_1 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        Assigned
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => selectEmployee(emp)}
                      className="rounded-md border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/10"
                    >
                      Reassign
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reassign form */}
      {selectedEmployee && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-6 dark:border-primary/10 dark:bg-primary/5">
          <h3 className="font-semibold text-primary">
            Reassign Approvers: {selectedEmployee.employee_name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedEmployee.designation} — {selectedEmployee.state}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="level1-email"
                className="block text-xs font-semibold text-foreground mb-1.5"
              >
                Level 1 Approver Email
              </label>
              <input
                id="level1-email"
                type="email"
                value={level1}
                onChange={(e) => setLevel1(e.target.value)}
                placeholder="level1@example.com"
                className={inputCls}
              />
            </div>
            <div>
              <label
                htmlFor="level2-email"
                className="block text-xs font-semibold text-foreground mb-1.5"
              >
                Level 2 Approver Email
              </label>
              <input
                id="level2-email"
                type="email"
                value={level2}
                onChange={(e) => setLevel2(e.target.value)}
                placeholder="level2@example.com"
                className={inputCls}
              />
            </div>
            <div>
              <label
                htmlFor="level3-email"
                className="block text-xs font-semibold text-foreground mb-1.5"
              >
                Level 3 Approver Email
              </label>
              <input
                id="level3-email"
                type="email"
                value={level3}
                onChange={(e) => setLevel3(e.target.value)}
                placeholder="level3@example.com"
                className={inputCls}
              />
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="reassign-reason"
              className="block text-sm font-semibold text-foreground mb-1.5"
            >
              Reason (required)
            </label>
            <textarea
              id="reassign-reason"
              value={reassignReason}
              onChange={(e) => setReassignReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Explain why the approval chain is being reassigned..."
              className="min-h-20 w-full rounded-md border border-border bg-background px-4 py-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="mt-4 flex gap-2.5">
            <button
              onClick={handleReassign}
              disabled={isReassigning || !reassignReason.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover disabled:opacity-50"
            >
              {isReassigning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {isReassigning ? 'Reassigning...' : 'Confirm Reassignment'}
            </button>
            <button
              onClick={() => {
                setSelectedEmployee(null)
                setReassignReason('')
              }}
              className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium shadow-xs transition-all hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {employees.length === 0 && !isSearching && query && !searchError && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No employees found matching &ldquo;{query}&rdquo;.
        </p>
      )}
    </div>
  )
}
