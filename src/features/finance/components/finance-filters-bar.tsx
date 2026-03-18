'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Filter, Download } from 'lucide-react'

import type {
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
  const [actionFilter, setActionFilter] = useState(filters.actionFilter ?? '')
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
    if (actionFilter) {
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
    setActionFilter('')
    setDateFilterField('claim_date')
    setDateFrom('')
    setDateTo('')
    router.push('/finance')
  }

  const inputCls =
    'h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="flex items-center gap-2.5 text-base font-semibold">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
          <Filter className="size-3.5 text-primary" />
        </div>
        Finance Filters
      </h2>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-4">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Employee Name</span>
          <input
            name="employeeName"
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            placeholder="Search by employee name"
            className={`${inputCls} placeholder:text-muted-foreground`}
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Claim Number</span>
          <input
            name="claimNumber"
            value={claimNumber}
            onChange={(e) => setClaimNumber(e.target.value)}
            placeholder="Search by claim ID"
            className={`${inputCls} placeholder:text-muted-foreground`}
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">
            Employee Designation
          </span>
          <select
            name="ownerDesignation"
            value={ownerDesignation}
            onChange={(e) => setOwnerDesignation(e.target.value)}
            className={inputCls}
          >
            <option value="">All Designations</option>
            {options.ownerDesignations.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">HOD Approver</span>
          <select
            name="hodApproverEmployeeId"
            value={hodApproverEmployeeId}
            onChange={(e) => setHodApproverEmployeeId(e.target.value)}
            className={inputCls}
          >
            <option value="">All HOD Approvers</option>
            {options.hodApprovers.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Claim Status</span>
          <select
            name="claimStatus"
            value={claimStatus}
            onChange={(e) => setClaimStatus(e.target.value)}
            className={inputCls}
          >
            <option value="">All Statuses</option>
            {options.claimStatuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Location</span>
          <select
            name="workLocation"
            value={workLocation}
            onChange={(e) => setWorkLocation(e.target.value)}
            className={inputCls}
          >
            <option value="">All Locations</option>
            {options.workLocations.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Finance Action</span>
          <select
            name="actionFilter"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className={inputCls}
          >
            <option value="">All Actions</option>
            {options.financeActions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Date Filter</span>
          <select
            name="dateFilterField"
            value={dateFilterField}
            onChange={(e) =>
              setDateFilterField(e.target.value as FinanceDateFilterField)
            }
            className={inputCls}
          >
            <option value="claim_date">Claim Date</option>
            <option value="finance_approved_date">Payment Issued Date</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">From</span>
          <input
            name="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">To</span>
          <input
            name="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={inputCls}
          />
        </label>

        <div className="md:col-span-4 flex flex-wrap items-center gap-2 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all duration-150 hover:bg-primary-hover hover:shadow-md"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium shadow-xs transition-all hover:bg-muted"
          >
            Clear Filters
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={exportCurrentPageHref}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2.5 text-xs font-medium shadow-xs transition-all hover:bg-muted"
            >
              <Download className="size-3.5" />
              Page CSV
            </Link>
            <Link
              href={exportAllHref}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2.5 text-xs font-medium shadow-xs transition-all hover:bg-muted"
            >
              <Download className="size-3.5" />
              All CSV
            </Link>
          </div>
        </div>
      </form>
    </section>
  )
}
