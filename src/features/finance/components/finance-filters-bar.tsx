'use client'

import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Filter } from 'lucide-react'

import { CsvExportActions } from '@/components/ui/csv-export-actions'
import { EmployeeNameSuggestionInput } from '@/components/ui/employee-name-suggestion-input'
import { ApprovedHistoryExportActions } from '@/features/finance/components/approved-history-export-actions'
import { getFinanceEmployeeNameSuggestionsAction } from '@/features/finance/actions/employee-name-suggestions'

import type {
  FinanceDateFilterField,
  FinanceFilterOptions,
  FinanceFilters,
} from '@/features/finance/types'

type FinanceFiltersBarProps = {
  pathname: string
  heading?: string
  filters: FinanceFilters
  options: FinanceFilterOptions
  showEmployeeIdFilter?: boolean
  showHodApproverFilter?: boolean
  showClaimStatusFilter?: boolean
  showActionFilter?: boolean
  showDateFilter?: boolean
  dateFilterOptions?: FinanceDateFilterField[]
  exportCurrentPageHref?: string
  exportAllHref?: string
  approvedHistoryExportAllHref?: string
  approvedHistoryBcExpenseHref?: string
  approvedHistoryPaymentJournalsHref?: string
}

const DEFAULT_DATE_FILTER_OPTIONS: FinanceDateFilterField[] = [
  'claim_date',
  'submitted_at',
  'finance_approved_date',
  'payment_released_date',
]

function getDateFilterFieldLabel(field: FinanceDateFilterField): string {
  if (field === 'submitted_at') {
    return 'Submission Date'
  }

  if (field === 'finance_approved_date') {
    return 'Finance Approved Date'
  }

  if (field === 'payment_released_date') {
    return 'Payment Released Date'
  }

  return 'Travel Date'
}

export function FinanceFiltersBar({
  pathname,
  heading = 'Finance Filters',
  filters,
  options,
  showEmployeeIdFilter = false,
  showHodApproverFilter = true,
  showClaimStatusFilter = true,
  showActionFilter = true,
  showDateFilter = true,
  dateFilterOptions = DEFAULT_DATE_FILTER_OPTIONS,
  exportCurrentPageHref,
  exportAllHref,
  approvedHistoryExportAllHref,
  approvedHistoryBcExpenseHref,
  approvedHistoryPaymentJournalsHref,
}: FinanceFiltersBarProps) {
  const router = useRouter()

  const [employeeId, setEmployeeId] = useState(filters.employeeId ?? '')
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
  const deferredEmployeeName = useDeferredValue(employeeName)

  const employeeNameSuggestionsQuery = useQuery<string[], Error>({
    queryKey: [
      'finance-filters-employee-name-suggestions',
      deferredEmployeeName,
    ],
    queryFn: async () => {
      const result =
        await getFinanceEmployeeNameSuggestionsAction(deferredEmployeeName)

      if (!result.ok) {
        throw new Error(result.error)
      }

      return result.data
    },
    enabled: deferredEmployeeName.trim().length >= 2,
    staleTime: 30_000,
    gcTime: 2 * 60 * 1000,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (showEmployeeIdFilter && employeeId) params.set('employeeId', employeeId)
    if (employeeName) params.set('employeeName', employeeName)
    if (claimNumber) params.set('claimNumber', claimNumber)
    if (ownerDesignation) params.set('ownerDesignation', ownerDesignation)
    if (showHodApproverFilter && hodApproverEmployeeId)
      params.set('hodApproverEmployeeId', hodApproverEmployeeId)
    if (showClaimStatusFilter && claimStatus) {
      params.set('claimStatus', claimStatus)
    }
    if (workLocation) params.set('workLocation', workLocation)
    if (showActionFilter && actionFilter) {
      params.set('actionFilter', actionFilter)
    }
    if (showDateFilter) {
      if (dateFilterField !== 'claim_date') {
        params.set('dateFilterField', dateFilterField)
      }
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
    }
    const qs = params.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}`)
  }

  function handleClear() {
    setEmployeeId('')
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
    router.push(pathname)
  }

  const inputCls =
    'h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'
  const activeDateFilterLabel = getDateFilterFieldLabel(dateFilterField)

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="flex items-center gap-2.5 text-base font-semibold">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
          <Filter className="size-3.5 text-primary" />
        </div>
        {heading}
      </h2>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-4">
        {showEmployeeIdFilter ? (
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Employee ID</span>
            <input
              name="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="Search by employee ID"
              className={`${inputCls} placeholder:text-muted-foreground`}
            />
          </label>
        ) : null}

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Employee Name</span>
          <EmployeeNameSuggestionInput
            value={employeeName}
            onValueChange={setEmployeeName}
            suggestions={employeeNameSuggestionsQuery.data ?? []}
            isLoading={employeeNameSuggestionsQuery.isFetching}
            placeholder="Search by full employee name"
            inputClassName={inputCls}
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

        {showHodApproverFilter ? (
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
        ) : null}

        {showClaimStatusFilter ? (
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
        ) : null}

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

        {showActionFilter ? (
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
        ) : null}

        {showDateFilter ? (
          <>
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
                {dateFilterOptions.map((field) => (
                  <option key={field} value={field}>
                    {getDateFilterFieldLabel(field)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">
                {activeDateFilterLabel} From
              </span>
              <input
                name="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={inputCls}
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">
                {activeDateFilterLabel} To
              </span>
              <input
                name="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={inputCls}
              />
            </label>
          </>
        ) : null}

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
          {approvedHistoryExportAllHref &&
          approvedHistoryBcExpenseHref &&
          approvedHistoryPaymentJournalsHref ? (
            <ApprovedHistoryExportActions
              exportAllHref={approvedHistoryExportAllHref}
              exportBcExpenseHref={approvedHistoryBcExpenseHref}
              exportPaymentJournalsHref={approvedHistoryPaymentJournalsHref}
              buttonClassName="rounded-md"
            />
          ) : exportCurrentPageHref && exportAllHref ? (
            <CsvExportActions
              exportCurrentPageHref={exportCurrentPageHref}
              exportAllHref={exportAllHref}
              buttonClassName="rounded-md"
            />
          ) : null}
        </div>
      </form>
    </section>
  )
}
