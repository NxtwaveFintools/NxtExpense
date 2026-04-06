'use client'
import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, X } from 'lucide-react'

import { EmployeeNameSuggestionInput } from '@/components/ui/employee-name-suggestion-input'
import { getAdminAnalyticsEmployeeNameSuggestionsAction } from '@/features/admin/actions/analytics-actions'
import type {
  AdminAnalyticsDateField,
  AdminAnalyticsFilterOptions,
  AdminAnalyticsFilters,
} from '@/features/admin/types/analytics'
type AdminAnalyticsFiltersProps = {
  filters: AdminAnalyticsFilters
  options: AdminAnalyticsFilterOptions | null
  isLoadingOptions: boolean
  onApply: (filters: AdminAnalyticsFilters) => void
}
const EMPTY_FILTERS: AdminAnalyticsFilters = {
  dateFilterField: 'travel_date',
  dateFrom: null,
  dateTo: null,
  claimId: null,
  designationId: null,
  workLocationId: null,
  stateId: null,
  employeeId: null,
  employeeName: null,
  vehicleCode: null,
  claimStatusId: null,
  pendingOnly: false,
}
function getDateFieldLabel(field: AdminAnalyticsDateField): string {
  return field === 'submission_date' ? 'Submission Date' : 'Travel Date'
}
function countActiveFilters(filters: AdminAnalyticsFilters): number {
  let count = 0
  if (filters.dateFilterField === 'submission_date') {
    count += 1
  }
  if (filters.pendingOnly) {
    count += 1
  }
  const values = [
    filters.dateFrom,
    filters.dateTo,
    filters.claimId,
    filters.designationId,
    filters.workLocationId,
    filters.stateId,
    filters.employeeId,
    filters.employeeName,
    filters.vehicleCode,
    filters.claimStatusId,
  ]
  return count + values.filter((value) => value !== null && value !== '').length
}
export function AdminAnalyticsFiltersBar({
  filters,
  options,
  isLoadingOptions,
  onApply,
}: AdminAnalyticsFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [local, setLocal] = useState<AdminAnalyticsFilters>(filters)
  const deferredEmployeeName = useDeferredValue(local.employeeName ?? '')

  const employeeNameSuggestionsQuery = useQuery<string[], Error>({
    queryKey: [
      'admin-dashboard-employee-name-suggestions',
      deferredEmployeeName,
    ],
    queryFn: async () => {
      const result =
        await getAdminAnalyticsEmployeeNameSuggestionsAction(
          deferredEmployeeName
        )

      if (!result.ok) {
        throw new Error(result.error)
      }

      return result.data
    },
    enabled: isOpen && deferredEmployeeName.trim().length >= 2,
    staleTime: 30_000,
    gcTime: 2 * 60 * 1000,
  })

  const activeCount = countActiveFilters(filters)
  const activeDateLabel = getDateFieldLabel(local.dateFilterField)
  function handleFieldChange(
    field: keyof AdminAnalyticsFilters,
    value: string | boolean
  ) {
    setLocal((prev) => ({
      ...prev,
      [field]: typeof value === 'string' ? value || null : value,
    }))
  }
  function handleApply() {
    onApply(local)
  }
  function handleClear() {
    setLocal(EMPTY_FILTERS)
    onApply(EMPTY_FILTERS)
  }
  return (
    <section className="rounded-xl border border-border bg-surface shadow-sm animate-slide-up stagger-1">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            Analytics Filters
          </span>
          {activeCount > 0 ? (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </div>
        {isOpen ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      {isOpen ? (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Date Field">
              <select
                value={local.dateFilterField}
                onChange={(event) =>
                  handleFieldChange(
                    'dateFilterField',
                    event.target.value as AdminAnalyticsDateField
                  )
                }
                className="filter-input"
              >
                <option value="travel_date">Travel Date</option>
                <option value="submission_date">Submission Date</option>
              </select>
            </FilterField>
            <FilterField label={`${activeDateLabel} From`}>
              <input
                type="date"
                value={local.dateFrom ?? ''}
                onChange={(event) =>
                  handleFieldChange('dateFrom', event.target.value)
                }
                className="filter-input"
              />
            </FilterField>
            <FilterField label={`${activeDateLabel} To`}>
              <input
                type="date"
                value={local.dateTo ?? ''}
                onChange={(event) =>
                  handleFieldChange('dateTo', event.target.value)
                }
                className="filter-input"
              />
            </FilterField>
            <FilterField label="Active Pending Claims Only">
              <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={local.pendingOnly}
                  onChange={(event) =>
                    handleFieldChange('pendingOnly', event.target.checked)
                  }
                  className="size-4 accent-primary"
                />
                Exclude approved, rejected, and payment released claims
              </label>
            </FilterField>
            <FilterField label="Employee ID">
              <input
                type="text"
                value={local.employeeId ?? ''}
                onChange={(event) =>
                  handleFieldChange('employeeId', event.target.value)
                }
                className="filter-input"
                placeholder="Search by employee id"
              />
            </FilterField>
            <FilterField label="Claim ID">
              <input
                type="text"
                value={local.claimId ?? ''}
                onChange={(event) =>
                  handleFieldChange('claimId', event.target.value)
                }
                className="filter-input"
                placeholder="Search by claim id"
              />
            </FilterField>
            <FilterField label="Employee Name">
              <EmployeeNameSuggestionInput
                value={local.employeeName ?? ''}
                onValueChange={(value) =>
                  handleFieldChange('employeeName', value)
                }
                suggestions={employeeNameSuggestionsQuery.data ?? []}
                isLoading={employeeNameSuggestionsQuery.isFetching}
                placeholder="Search by full employee name"
                inputClassName="filter-input"
              />
            </FilterField>
            <FilterField label="Claim Status">
              <select
                value={local.claimStatusId ?? ''}
                onChange={(event) =>
                  handleFieldChange('claimStatusId', event.target.value)
                }
                className="filter-input"
                disabled={isLoadingOptions}
              >
                <option value="">All statuses</option>
                {options?.claimStatuses.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Designation">
              <select
                value={local.designationId ?? ''}
                onChange={(event) =>
                  handleFieldChange('designationId', event.target.value)
                }
                className="filter-input"
                disabled={isLoadingOptions}
              >
                <option value="">All designations</option>
                {options?.designations.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Work Location">
              <select
                value={local.workLocationId ?? ''}
                onChange={(event) =>
                  handleFieldChange('workLocationId', event.target.value)
                }
                className="filter-input"
                disabled={isLoadingOptions}
              >
                <option value="">All locations</option>
                {options?.workLocations.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="State">
              <select
                value={local.stateId ?? ''}
                onChange={(event) =>
                  handleFieldChange('stateId', event.target.value)
                }
                className="filter-input"
                disabled={isLoadingOptions}
              >
                <option value="">All states</option>
                {options?.states.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Vehicle Type">
              <select
                value={local.vehicleCode ?? ''}
                onChange={(event) =>
                  handleFieldChange('vehicleCode', event.target.value)
                }
                className="filter-input"
                disabled={isLoadingOptions}
              >
                <option value="">All vehicle types</option>
                {options?.vehicleTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover btn-press"
            >
              Apply Filters
            </button>
            {countActiveFilters(local) > 0 ? (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
              >
                <X className="size-3.5" />
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
function FilterField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}
