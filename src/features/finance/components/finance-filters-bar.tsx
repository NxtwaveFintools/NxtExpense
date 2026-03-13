'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import type {
  FinanceActionFilter,
  FinanceDateFilterField,
  FinanceFilterOptions,
  FinanceFilters,
} from '@/features/finance/types'

type FinanceFiltersBarProps = {
  filters: FinanceFilters
  options: FinanceFilterOptions
  exportCurrentPageHref: string
  exportAllHref: string
}

export function FinanceFiltersBar({
  filters,
  options,
  exportCurrentPageHref,
  exportAllHref,
}: FinanceFiltersBarProps) {
  const router = useRouter()

  const [employeeName, setEmployeeName] = useState(filters.employeeName ?? '')
  const [claimNumber, setClaimNumber] = useState(filters.claimNumber ?? '')
  const [ownerDesignation, setOwnerDesignation] = useState(
    filters.ownerDesignation ?? ''
  )
  const [hodApproverEmployeeId, setHodApproverEmployeeId] = useState(
    filters.hodApproverEmployeeId ?? ''
  )
  const [claimStatus, setClaimStatus] = useState(filters.claimStatus ?? '')
  const [workLocation, setWorkLocation] = useState(filters.workLocation ?? '')
  const [actionFilter, setActionFilter] = useState<FinanceActionFilter>(
    filters.actionFilter
  )
  const [dateFilterField, setDateFilterField] =
    useState<FinanceDateFilterField>(filters.dateFilterField)
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? '')
  const [dateTo, setDateTo] = useState(filters.dateTo ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (employeeName) params.set('employeeName', employeeName)
    if (claimNumber) params.set('claimNumber', claimNumber)
    if (ownerDesignation) params.set('ownerDesignation', ownerDesignation)
    if (hodApproverEmployeeId)
      params.set('hodApproverEmployeeId', hodApproverEmployeeId)
    if (claimStatus) params.set('claimStatus', claimStatus)
    if (workLocation) params.set('workLocation', workLocation)
    if (actionFilter !== 'all') {
      params.set('actionFilter', actionFilter)
    }
    if (dateFilterField !== 'claim_date') {
      params.set('dateFilterField', dateFilterField)
    }
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    const qs = params.toString()
    router.push(`/finance${qs ? `?${qs}` : ''}`)
  }

  function handleClear() {
    setEmployeeName('')
    setClaimNumber('')
    setOwnerDesignation('')
    setHodApproverEmployeeId('')
    setClaimStatus('')
    setWorkLocation('')
    setActionFilter('all')
    setDateFilterField('claim_date')
    setDateFrom('')
    setDateTo('')
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
            name="hodApproverEmployeeId"
            value={hodApproverEmployeeId}
            onChange={(e) => setHodApproverEmployeeId(e.target.value)}
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
          <span className="text-foreground/80">Finance Action</span>
          <select
            name="actionFilter"
            value={actionFilter}
            onChange={(e) =>
              setActionFilter(e.target.value as FinanceActionFilter)
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="all">All Actions</option>
            <option value="issued">Issued</option>
            <option value="finance_rejected">Finance Rejected</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Date Filter</span>
          <select
            name="dateFilterField"
            value={dateFilterField}
            onChange={(e) =>
              setDateFilterField(e.target.value as FinanceDateFilterField)
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="claim_date">Claim Date</option>
            <option value="finance_approved_date">Finance Approved Date</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">From</span>
          <input
            name="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">To</span>
          <input
            name="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
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
          <Link
            href={exportCurrentPageHref}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            Download Current Page CSV
          </Link>
          <Link
            href={exportAllHref}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            Download All Filtered CSV
          </Link>
        </div>
      </form>
    </section>
  )
}
