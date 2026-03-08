'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import type {
  FinanceActionFilter,
  FinanceFilterOptions,
  FinanceFilters,
} from '@/features/finance/types'

type FinanceFiltersBarProps = {
  filters: FinanceFilters
  options: FinanceFilterOptions
}

function isFinanceActionFilter(value: string): value is FinanceActionFilter {
  return value === 'all' || value === 'issued' || value === 'finance_rejected'
}

export function FinanceFiltersBar({
  filters,
  options,
}: FinanceFiltersBarProps) {
  const router = useRouter()

  const [employeeName, setEmployeeName] = useState(filters.employeeName ?? '')
  const [claimNumber, setClaimNumber] = useState(filters.claimNumber ?? '')
  const [ownerDesignation, setOwnerDesignation] = useState(
    filters.ownerDesignation ?? ''
  )
  const [hodApproverEmail, setHodApproverEmail] = useState(
    filters.hodApproverEmail ?? ''
  )
  const [claimStatus, setClaimStatus] = useState(filters.claimStatus ?? '')
  const [workLocation, setWorkLocation] = useState(filters.workLocation ?? '')
  const [claimDateFrom, setClaimDateFrom] = useState(
    filters.claimDateFrom ?? ''
  )
  const [claimDateTo, setClaimDateTo] = useState(filters.claimDateTo ?? '')
  const [actionFilter, setActionFilter] = useState(
    filters.actionFilter ?? 'all'
  )
  const [actionDateFrom, setActionDateFrom] = useState(
    filters.actionDateFrom ?? ''
  )
  const [actionDateTo, setActionDateTo] = useState(filters.actionDateTo ?? '')
  const [resubmittedOnly, setResubmittedOnly] = useState(
    filters.resubmittedOnly ?? false
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (employeeName) params.set('employeeName', employeeName)
    if (claimNumber) params.set('claimNumber', claimNumber)
    if (ownerDesignation) params.set('ownerDesignation', ownerDesignation)
    if (hodApproverEmail) params.set('hodApproverEmail', hodApproverEmail)
    if (claimStatus) params.set('claimStatus', claimStatus)
    if (workLocation) params.set('workLocation', workLocation)
    if (claimDateFrom) params.set('claimDateFrom', claimDateFrom)
    if (claimDateTo) params.set('claimDateTo', claimDateTo)
    if (actionFilter && actionFilter !== 'all')
      params.set('actionFilter', actionFilter)
    if (actionDateFrom) params.set('actionDateFrom', actionDateFrom)
    if (actionDateTo) params.set('actionDateTo', actionDateTo)
    if (resubmittedOnly) params.set('resubmittedOnly', 'true')
    const qs = params.toString()
    router.push(`/finance${qs ? `?${qs}` : ''}`)
  }

  function handleClear() {
    setEmployeeName('')
    setClaimNumber('')
    setOwnerDesignation('')
    setHodApproverEmail('')
    setClaimStatus('')
    setWorkLocation('')
    setClaimDateFrom('')
    setClaimDateTo('')
    setActionFilter('all')
    setActionDateFrom('')
    setActionDateTo('')
    setResubmittedOnly(false)
    router.push('/finance')
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-base font-semibold">Finance Filters</h2>

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Employee Name</span>
          <input
            name="employeeName"
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            placeholder="Search by employee name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Claim Number</span>
          <input
            name="claimNumber"
            value={claimNumber}
            onChange={(e) => setClaimNumber(e.target.value)}
            placeholder="Search by claim ID"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Employee Designation</span>
          <select
            name="ownerDesignation"
            value={ownerDesignation}
            onChange={(e) => setOwnerDesignation(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="">All Designations</option>
            {options.ownerDesignations.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">HOD Approver</span>
          <select
            name="hodApproverEmail"
            value={hodApproverEmail}
            onChange={(e) => setHodApproverEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="">All HOD Approvers</option>
            {options.hodApprovers.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Claim Status</span>
          <select
            name="claimStatus"
            value={claimStatus}
            onChange={(e) => setClaimStatus(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="">All Statuses</option>
            {options.claimStatuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Location</span>
          <select
            name="workLocation"
            value={workLocation}
            onChange={(e) => setWorkLocation(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="">All Locations</option>
            {options.workLocations.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Claim Date From</span>
          <input
            name="claimDateFrom"
            type="date"
            value={claimDateFrom}
            onChange={(e) => setClaimDateFrom(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Claim Date To</span>
          <input
            name="claimDateTo"
            type="date"
            value={claimDateTo}
            onChange={(e) => setClaimDateTo(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Finance Action</span>
          <select
            name="actionFilter"
            value={actionFilter}
            onChange={(e) => {
              if (isFinanceActionFilter(e.target.value)) {
                setActionFilter(e.target.value)
              }
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="all">All Actions</option>
            <option value="issued">Issued</option>
            <option value="finance_rejected">Finance Rejected</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Action Date From</span>
          <input
            name="actionDateFrom"
            type="date"
            value={actionDateFrom}
            onChange={(e) => setActionDateFrom(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Action Date To</span>
          <input
            name="actionDateTo"
            type="date"
            value={actionDateTo}
            onChange={(e) => setActionDateTo(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="md:col-span-4 inline-flex items-center gap-2 text-sm text-foreground/80">
          <input
            name="resubmittedOnly"
            type="checkbox"
            checked={resubmittedOnly}
            onChange={(e) => setResubmittedOnly(e.target.checked)}
          />
          Show resubmitted claims only
        </label>

        <div className="md:col-span-4 flex flex-wrap items-center gap-2 pt-1">
          <button
            type="submit"
            className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            Clear Filters
          </button>
        </div>
      </form>
    </section>
  )
}
