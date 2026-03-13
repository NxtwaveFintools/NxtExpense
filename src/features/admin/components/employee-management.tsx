'use client'

import { useState } from 'react'
import { toast } from 'sonner'

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

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by name, email, or employee ID..."
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {searchError && <p className="text-sm text-red-600">{searchError}</p>}

      {/* Results table */}
      {employees.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-foreground/70">
                  Employee ID
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground/70">
                  Name
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground/70">
                  Designation
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground/70">
                  State
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground/70">
                  L1 Approver
                </th>
                <th className="px-3 py-2 text-center font-medium text-foreground/70">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2 font-mono text-xs">
                    {emp.employee_id}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{emp.employee_name}</p>
                    <p className="text-xs text-foreground/50">
                      {emp.employee_email}
                    </p>
                  </td>
                  <td className="px-3 py-2">{emp.designation}</td>
                  <td className="px-3 py-2">{emp.state}</td>
                  <td className="px-3 py-2 text-xs">
                    {emp.approval_employee_id_level_1 ? 'L1 Assigned' : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => selectEmployee(emp)}
                      className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
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
        <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-600 dark:bg-blue-900/20">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300">
            Reassign Approvers: {selectedEmployee.employee_name}
          </h3>
          <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
            {selectedEmployee.designation} — {selectedEmployee.state}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="level1-email"
                className="block text-xs font-medium text-blue-800 dark:text-blue-300"
              >
                Level 1 Approver Email
              </label>
              <input
                id="level1-email"
                type="email"
                value={level1}
                onChange={(e) => setLevel1(e.target.value)}
                placeholder="level1@example.com"
                className="mt-1 w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none dark:border-blue-600 dark:bg-surface"
              />
            </div>
            <div>
              <label
                htmlFor="level2-email"
                className="block text-xs font-medium text-blue-800 dark:text-blue-300"
              >
                Level 2 Approver Email
              </label>
              <input
                id="level2-email"
                type="email"
                value={level2}
                onChange={(e) => setLevel2(e.target.value)}
                placeholder="level2@example.com"
                className="mt-1 w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none dark:border-blue-600 dark:bg-surface"
              />
            </div>
            <div>
              <label
                htmlFor="level3-email"
                className="block text-xs font-medium text-blue-800 dark:text-blue-300"
              >
                Level 3 Approver Email
              </label>
              <input
                id="level3-email"
                type="email"
                value={level3}
                onChange={(e) => setLevel3(e.target.value)}
                placeholder="level3@example.com"
                className="mt-1 w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none dark:border-blue-600 dark:bg-surface"
              />
            </div>
          </div>

          <div className="mt-3">
            <label
              htmlFor="reassign-reason"
              className="block text-sm font-medium text-blue-800 dark:text-blue-300"
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
              className="mt-1 w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none dark:border-blue-600 dark:bg-surface"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleReassign}
              disabled={isReassigning || !reassignReason.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isReassigning ? 'Reassigning...' : 'Confirm Reassignment'}
            </button>
            <button
              onClick={() => {
                setSelectedEmployee(null)
                setReassignReason('')
              }}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {employees.length === 0 && !isSearching && query && !searchError && (
        <p className="text-center text-sm text-foreground/50">
          No employees found matching &ldquo;{query}&rdquo;.
        </p>
      )}
    </div>
  )
}
