'use client'

import { useDeferredValue, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Filter } from 'lucide-react'

import { CsvExportActions } from '@/components/ui/csv-export-actions'
import { EmployeeNameSuggestionInput } from '@/components/ui/employee-name-suggestion-input'
import { getApprovalEmployeeNameSuggestionsAction } from '@/features/approvals/actions/employee-name-suggestions'
import { addApprovalFiltersToParams } from '@/features/approvals/utils/history-filters'

import type { ClaimStatusCatalogItem } from '@/features/claims/types'
import type {
  ApprovalAmountOperator,
  ApprovalHistoryFilters,
  ApprovalLocationType,
} from '@/features/approvals/types'

type ApprovalFiltersBarProps = {
  filters: ApprovalHistoryFilters
  statusCatalog: ClaimStatusCatalogItem[]
  validationError?: string | null
  exportCurrentPageHref: string
  exportAllHref: string
}

const DEFAULT_FILTERS: ApprovalHistoryFilters = {
  claimStatus: null,
  employeeName: null,
  claimDateFrom: null,
  claimDateTo: null,
  amountOperator: 'lte',
  amountValue: null,
  locationType: null,
  claimDateSort: 'desc',
  hodApprovedFrom: null,
  hodApprovedTo: null,
  financeApprovedFrom: null,
  financeApprovedTo: null,
}

function toNullable(value: string): string | null {
  const normalized = value.trim()
  return normalized ? normalized : null
}

export function ApprovalFiltersBar({
  filters,
  statusCatalog,
  validationError,
  exportCurrentPageHref,
  exportAllHref,
}: ApprovalFiltersBarProps) {
  const router = useRouter()

  const [claimStatus, setClaimStatus] = useState(filters.claimStatus ?? '')
  const [employeeName, setEmployeeName] = useState(filters.employeeName ?? '')
  const [claimDateFrom, setClaimDateFrom] = useState(
    filters.claimDateFrom ?? ''
  )
  const [claimDateTo, setClaimDateTo] = useState(filters.claimDateTo ?? '')
  const [amountOperator, setAmountOperator] = useState<ApprovalAmountOperator>(
    filters.amountOperator
  )
  const [amountValue, setAmountValue] = useState(
    filters.amountValue === null ? '' : String(filters.amountValue)
  )
  const [locationType, setLocationType] = useState<ApprovalLocationType | ''>(
    filters.locationType ?? ''
  )
  const [claimDateSort, setClaimDateSort] = useState(filters.claimDateSort)

  const deferredEmployeeName = useDeferredValue(employeeName)

  const employeeNameSuggestionsQuery = useQuery<string[], Error>({
    queryKey: ['approval-employee-name-suggestions', deferredEmployeeName],
    queryFn: async () => {
      const result =
        await getApprovalEmployeeNameSuggestionsAction(deferredEmployeeName)

      if (!result.ok) {
        throw new Error(result.error)
      }

      return result.data
    },
    enabled: deferredEmployeeName.trim().length >= 2,
    staleTime: 30_000,
    gcTime: 2 * 60 * 1000,
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedAmount = toNullable(amountValue)
    const amountAsNumber = parsedAmount === null ? null : Number(parsedAmount)

    const nextFilters: ApprovalHistoryFilters = {
      claimStatus: toNullable(claimStatus),
      employeeName: toNullable(employeeName),
      claimDateFrom: toNullable(claimDateFrom),
      claimDateTo: toNullable(claimDateTo),
      amountOperator,
      amountValue:
        amountAsNumber !== null && Number.isFinite(amountAsNumber)
          ? amountAsNumber
          : null,
      locationType: locationType || null,
      claimDateSort,
      hodApprovedFrom: filters.hodApprovedFrom,
      hodApprovedTo: filters.hodApprovedTo,
      financeApprovedFrom: filters.financeApprovedFrom,
      financeApprovedTo: filters.financeApprovedTo,
    }

    const params = addApprovalFiltersToParams(
      new URLSearchParams(),
      nextFilters
    )
    const queryString = params.toString()

    router.push(queryString ? `/approvals?${queryString}` : '/approvals')
  }

  function handleClear() {
    setClaimStatus('')
    setEmployeeName('')
    setClaimDateFrom('')
    setClaimDateTo('')
    setAmountOperator(DEFAULT_FILTERS.amountOperator)
    setAmountValue('')
    setLocationType('')
    setClaimDateSort(DEFAULT_FILTERS.claimDateSort)
    router.push('/approvals')
  }

  const inputCls =
    'h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="flex items-center gap-2.5 text-base font-semibold">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
          <Filter className="size-3.5 text-primary" />
        </div>
        Approval Filters
      </h2>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-4">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Status</span>
          <select
            name="claimStatus"
            value={claimStatus}
            onChange={(event) => setClaimStatus(event.target.value)}
            className={inputCls}
          >
            <option value="">All Statuses</option>
            {statusCatalog.map((status) => (
              <option
                key={status.status_filter_value}
                value={status.status_filter_value}
              >
                {status.display_label}
              </option>
            ))}
          </select>
        </label>

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
          <span className="font-medium text-foreground">Travel Date From</span>
          <input
            name="claimDateFrom"
            type="date"
            value={claimDateFrom}
            onChange={(event) => setClaimDateFrom(event.target.value)}
            className={inputCls}
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Travel Date To</span>
          <input
            name="claimDateTo"
            type="date"
            value={claimDateTo}
            onChange={(event) => setClaimDateTo(event.target.value)}
            className={inputCls}
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Amount Condition</span>
          <select
            name="amountOperator"
            value={amountOperator}
            onChange={(event) =>
              setAmountOperator(event.target.value as ApprovalAmountOperator)
            }
            className={inputCls}
          >
            <option value="lte">Less than or equal (≤)</option>
            <option value="gte">Greater than or equal (≥)</option>
            <option value="eq">Equal to (=)</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Amount Value</span>
          <input
            name="amountValue"
            type="number"
            min="0"
            step="0.01"
            value={amountValue}
            onChange={(event) => setAmountValue(event.target.value)}
            placeholder="Enter amount"
            className={`${inputCls} placeholder:text-muted-foreground`}
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Location Type</span>
          <select
            name="locationType"
            value={locationType}
            onChange={(event) =>
              setLocationType(event.target.value as ApprovalLocationType | '')
            }
            className={inputCls}
          >
            <option value="">All Location Types</option>
            <option value="base">Base Location</option>
            <option value="outstation">Outstation</option>
          </select>
        </label>

        {validationError ? (
          <p className="md:col-span-4 text-sm font-medium text-rose-600">
            {validationError}
          </p>
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
            Clear
          </button>
          <CsvExportActions
            exportCurrentPageHref={exportCurrentPageHref}
            exportAllHref={exportAllHref}
            buttonClassName="rounded-md"
          />
        </div>
      </form>
    </section>
  )
}
