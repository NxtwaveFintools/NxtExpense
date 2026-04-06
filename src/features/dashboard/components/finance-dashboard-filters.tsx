'use client'

import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, X } from 'lucide-react'

import type {
  FinanceDashboardDateField,
  FinanceDashboardFilters,
} from '@/features/dashboard/types/finance-dashboard'
import type { FinanceDashboardFilterOptions } from '@/features/dashboard/types/finance-dashboard'
import { getFinanceDashboardEmployeeNameSuggestions } from '@/features/dashboard/actions/finance-dashboard'
import { EmployeeNameSuggestionInput } from '@/components/ui/employee-name-suggestion-input'

type FinanceDashboardFiltersBarProps = {
  filters: FinanceDashboardFilters
  options: FinanceDashboardFilterOptions | null
  isLoadingOptions: boolean
  onApply: (filters: FinanceDashboardFilters) => void
}

const EMPTY_FILTERS: FinanceDashboardFilters = {
  dateFilterField: 'travel_date',
  dateFrom: null,
  dateTo: null,
  designationId: null,
  workLocationId: null,
  stateId: null,
  employeeId: null,
  employeeName: null,
  vehicleCode: null,
}

function hasAnyFilter(f: FinanceDashboardFilters): boolean {
  if (f.dateFilterField === 'submission_date') {
    return true
  }

  return (
    Boolean(f.dateFrom) ||
    Boolean(f.dateTo) ||
    Boolean(f.designationId) ||
    Boolean(f.workLocationId) ||
    Boolean(f.stateId) ||
    Boolean(f.employeeId) ||
    Boolean(f.employeeName) ||
    Boolean(f.vehicleCode)
  )
}

function getDateFieldLabel(field: FinanceDashboardDateField): string {
  return field === 'submission_date' ? 'Submission Date' : 'Travel Date'
}

export function FinanceDashboardFiltersBar({
  filters,
  options,
  isLoadingOptions,
  onApply,
}: FinanceDashboardFiltersBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [local, setLocal] = useState<FinanceDashboardFilters>(filters)
  const deferredEmployeeName = useDeferredValue(local.employeeName ?? '')

  const employeeNameSuggestionsQuery = useQuery<string[], Error>({
    queryKey: [
      'finance-dashboard-employee-name-suggestions',
      deferredEmployeeName,
    ],
    queryFn: async () => {
      const result =
        await getFinanceDashboardEmployeeNameSuggestions(deferredEmployeeName)

      if (!result.ok) {
        throw new Error(result.error)
      }

      return result.data
    },
    enabled: isOpen && deferredEmployeeName.trim().length >= 2,
    staleTime: 30_000,
    gcTime: 2 * 60 * 1000,
  })

  const activeCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.designationId,
    filters.workLocationId,
    filters.stateId,
    filters.employeeId,
    filters.employeeName,
    filters.vehicleCode,
  ].filter((value) => value !== null && value !== '').length
  const activeCountWithDateField =
    filters.dateFilterField === 'submission_date'
      ? activeCount + 1
      : activeCount
  const activeDateLabel = getDateFieldLabel(local.dateFilterField)

  function handleApply() {
    onApply(local)
  }

  function handleClear() {
    setLocal(EMPTY_FILTERS)
    onApply(EMPTY_FILTERS)
  }

  function handleFieldChange(
    field: keyof FinanceDashboardFilters,
    value: string
  ) {
    setLocal((prev) => ({
      ...prev,
      [field]: value || null,
    }))
  }

  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm animate-slide-up stagger-1">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Filters</span>
          {activeCountWithDateField > 0 && (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeCountWithDateField}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Employee ID">
              <input
                type="text"
                placeholder="Search by employee ID..."
                value={local.employeeId ?? ''}
                onChange={(e) =>
                  handleFieldChange('employeeId', e.target.value)
                }
                className="filter-input"
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

            <FilterField label="Date Field">
              <select
                value={local.dateFilterField}
                onChange={(e) =>
                  setLocal((prev) => ({
                    ...prev,
                    dateFilterField: e.target
                      .value as FinanceDashboardDateField,
                  }))
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
                onChange={(e) => handleFieldChange('dateFrom', e.target.value)}
                className="filter-input"
              />
            </FilterField>

            <FilterField label={`${activeDateLabel} To`}>
              <input
                type="date"
                value={local.dateTo ?? ''}
                onChange={(e) => handleFieldChange('dateTo', e.target.value)}
                className="filter-input"
              />
            </FilterField>

            <FilterField label="Designation">
              <select
                value={local.designationId ?? ''}
                onChange={(e) =>
                  handleFieldChange('designationId', e.target.value)
                }
                className="filter-input"
                disabled={isLoadingOptions}
              >
                <option value="">All Designations</option>
                {options?.designations.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Vehicle Type">
              <select
                value={local.vehicleCode ?? ''}
                onChange={(e) =>
                  handleFieldChange('vehicleCode', e.target.value)
                }
                className="filter-input"
                disabled={isLoadingOptions}
              >
                <option value="">All Vehicle Types</option>
                {options?.vehicleTypes.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Work Location">
              <select
                value={local.workLocationId ?? ''}
                onChange={(e) =>
                  handleFieldChange('workLocationId', e.target.value)
                }
                className="filter-input"
                disabled={isLoadingOptions}
              >
                <option value="">All Locations</option>
                {options?.workLocations.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="State">
              <select
                value={local.stateId ?? ''}
                onChange={(e) => handleFieldChange('stateId', e.target.value)}
                className="filter-input"
                disabled={isLoadingOptions}
              >
                <option value="">All States</option>
                {options?.states.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
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
            {hasAnyFilter(local) && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
              >
                <X className="size-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
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
