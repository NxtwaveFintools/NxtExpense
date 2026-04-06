'use client'

import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import {
  getFinanceDashboardAnalytics,
  getFinanceDashboardFilterOptions,
} from '@/features/dashboard/actions/finance-dashboard'
import type {
  FinanceDashboardData,
  FinanceDashboardFilterOptions,
  FinanceDashboardFilters,
} from '@/features/dashboard/types/finance-dashboard'
import { FinanceKPIStrip } from '@/features/dashboard/components/finance-kpi-strip'
import { FinanceDashboardFiltersBar } from '@/features/dashboard/components/finance-dashboard-filters'
import { FinanceDashboardCharts } from '@/features/dashboard/components/finance-dashboard-charts'

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

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

type FinanceDashboardProps = {
  employee: { employeeName: string }
}

export function FinanceDashboard({ employee }: FinanceDashboardProps) {
  const [filters, setFilters] = useState<FinanceDashboardFilters>(EMPTY_FILTERS)
  const greeting = getGreeting(new Date().getHours())
  const fullName = employee.employeeName.trim()

  const analyticsQuery = useQuery<FinanceDashboardData, Error>({
    queryKey: ['finance-dashboard-analytics', filters],
    queryFn: async () => {
      const result = await getFinanceDashboardAnalytics({
        dateFilterField: filters.dateFilterField,
        dateFrom: filters.dateFrom ?? undefined,
        dateTo: filters.dateTo ?? undefined,
        designationId: filters.designationId ?? undefined,
        workLocationId: filters.workLocationId ?? undefined,
        stateId: filters.stateId ?? undefined,
        employeeId: filters.employeeId ?? undefined,
        employeeName: filters.employeeName ?? undefined,
        vehicleCode: filters.vehicleCode ?? undefined,
      })

      if (!result.ok) {
        throw new Error(result.error)
      }

      return result.data
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const filterOptionsQuery = useQuery<FinanceDashboardFilterOptions, Error>({
    queryKey: ['finance-dashboard-filter-options'],
    queryFn: async () => {
      const result = await getFinanceDashboardFilterOptions()

      if (!result.ok) {
        throw new Error(result.error)
      }

      return result.data
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 animate-slide-up stagger-1">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              {greeting}, {fullName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Finance overview — pending claims awaiting your review.
            </p>
          </div>
          <Link
            href="/finance"
            className="group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md btn-press"
          >
            Go to Pending Queue
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Filters */}
        <FinanceDashboardFiltersBar
          filters={filters}
          options={filterOptionsQuery.data ?? null}
          isLoadingOptions={filterOptionsQuery.isLoading}
          onApply={setFilters}
        />

        {/* KPI Strip */}
        <FinanceKPIStrip
          kpi={analyticsQuery.data?.kpi ?? null}
          isLoading={analyticsQuery.isLoading}
        />

        {/* Charts */}
        <FinanceDashboardCharts
          data={analyticsQuery.data ?? null}
          isLoading={analyticsQuery.isLoading}
        />

        {/* Error state */}
        {analyticsQuery.isError ? (
          <div className="rounded-lg border border-error/30 bg-error-light px-4 py-3 text-sm text-error">
            {analyticsQuery.error.message}
          </div>
        ) : null}
      </div>
    </main>
  )
}
