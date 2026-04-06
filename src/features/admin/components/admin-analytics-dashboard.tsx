'use client'

import Link from 'next/link'
import { ArrowRight, Shield } from 'lucide-react'
import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { ClaimAnalyticsCards } from '@/components/ui/claim-analytics-cards'
import {
  getAdminAnalyticsClaimsPageAction,
  getAdminAnalyticsFilterOptionsAction,
  getAdminDashboardAnalyticsAction,
} from '@/features/admin/actions/analytics-actions'
import { AdminAnalyticsClaimsTable } from '@/features/admin/components/admin-analytics-claims-table'
import { AdminAnalyticsCharts } from '@/features/admin/components/admin-analytics-charts'
import { AdminAnalyticsFiltersBar } from '@/features/admin/components/admin-analytics-filters'
import type {
  AdminAnalyticsClaimsPage,
  AdminAnalyticsFilterOptions,
  AdminAnalyticsFilters,
  AdminDashboardAnalytics,
} from '@/features/admin/types/analytics'
import {
  CURSOR_PAGE_SIZE_OPTIONS,
  DEFAULT_CURSOR_PAGE_SIZE,
  normalizeCursorPageSize,
} from '@/lib/utils/pagination'

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

export function AdminAnalyticsDashboard() {
  const [filters, setFilters] = useState<AdminAnalyticsFilters>(EMPTY_FILTERS)
  const [currentCursor, setCurrentCursor] = useState<string | null>(null)
  const [cursorTrail, setCursorTrail] = useState<Array<string | null>>([])
  const [pageSize, setPageSize] = useState<number>(DEFAULT_CURSOR_PAGE_SIZE)

  function handleApplyFilters(nextFilters: AdminAnalyticsFilters) {
    setFilters(nextFilters)
    setCurrentCursor(null)
    setCursorTrail([])
  }

  function handlePreviousPage() {
    if (cursorTrail.length === 0) {
      return
    }

    const previousCursor = cursorTrail[cursorTrail.length - 1] ?? null
    setCursorTrail((prev) => prev.slice(0, -1))
    setCurrentCursor(previousCursor)
  }

  function handleNextPage(nextCursor: string) {
    setCursorTrail((prev) => [...prev, currentCursor])
    setCurrentCursor(nextCursor)
  }

  function handlePageSizeChange(nextPageSize: number) {
    const normalized = normalizeCursorPageSize(nextPageSize)
    setPageSize(normalized)
    setCurrentCursor(null)
    setCursorTrail([])
  }

  const analyticsQuery = useQuery<AdminDashboardAnalytics, Error>({
    queryKey: ['admin-dashboard-analytics', filters],
    queryFn: async () => {
      const result = await getAdminDashboardAnalyticsAction({
        dateFilterField: filters.dateFilterField,
        dateFrom: filters.dateFrom ?? undefined,
        dateTo: filters.dateTo ?? undefined,
        claimId: filters.claimId ?? undefined,
        designationId: filters.designationId ?? undefined,
        workLocationId: filters.workLocationId ?? undefined,
        stateId: filters.stateId ?? undefined,
        employeeId: filters.employeeId ?? undefined,
        employeeName: filters.employeeName ?? undefined,
        vehicleCode: filters.vehicleCode ?? undefined,
        claimStatusId: filters.claimStatusId ?? undefined,
        pendingOnly: filters.pendingOnly,
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

  const claimsPageQuery = useQuery<AdminAnalyticsClaimsPage, Error>({
    queryKey: ['admin-dashboard-claims-page', filters, currentCursor, pageSize],
    queryFn: async () => {
      const result = await getAdminAnalyticsClaimsPageAction({
        filters: {
          dateFilterField: filters.dateFilterField,
          dateFrom: filters.dateFrom ?? undefined,
          dateTo: filters.dateTo ?? undefined,
          claimId: filters.claimId ?? undefined,
          designationId: filters.designationId ?? undefined,
          workLocationId: filters.workLocationId ?? undefined,
          stateId: filters.stateId ?? undefined,
          employeeId: filters.employeeId ?? undefined,
          employeeName: filters.employeeName ?? undefined,
          vehicleCode: filters.vehicleCode ?? undefined,
          claimStatusId: filters.claimStatusId ?? undefined,
          pendingOnly: filters.pendingOnly,
        },
        cursor: currentCursor,
        limit: pageSize,
      })

      if (!result.ok) {
        throw new Error(result.error)
      }

      return result.data
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const filterOptionsQuery = useQuery<AdminAnalyticsFilterOptions, Error>({
    queryKey: ['admin-dashboard-analytics-filter-options'],
    queryFn: async () => {
      const result = await getAdminAnalyticsFilterOptionsAction()

      if (!result.ok) {
        throw new Error(result.error)
      }

      return result.data
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const analyticsData = analyticsQuery.data
  const claimsPage = claimsPageQuery.data ?? null

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4 animate-slide-up stagger-1">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <Shield className="size-5 text-primary" />
              Admin Analytics Control Tower
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete financial and workflow observability with direct claim
              drill-down.
            </p>
          </div>
          <Link
            href="/admin/claims"
            className="group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md btn-press"
          >
            Open Claim Operations
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <AdminAnalyticsFiltersBar
          filters={filters}
          options={filterOptionsQuery.data ?? null}
          isLoadingOptions={filterOptionsQuery.isLoading}
          onApply={handleApplyFilters}
        />

        <ClaimAnalyticsCards
          cards={[
            {
              label: 'Total Claims',
              count: analyticsData?.kpi.total_count ?? 0,
              amount: analyticsData?.kpi.total_amount ?? 0,
              tone: 'neutral',
            },
            {
              label: 'Pending Queue',
              count: analyticsData?.kpi.pending_count ?? 0,
              amount: analyticsData?.kpi.pending_amount ?? 0,
              tone: 'finance',
            },
            {
              label: 'Payment Released',
              count: analyticsData?.kpi.payment_released_count ?? 0,
              amount: analyticsData?.kpi.payment_released_amount ?? 0,
              tone: 'approved',
            },
            {
              label: 'Rejected Claims',
              count: analyticsData?.kpi.rejected_count ?? 0,
              amount: analyticsData?.kpi.rejected_amount ?? 0,
              tone: 'rejected',
            },
          ]}
        />

        <AdminAnalyticsCharts
          data={analyticsData ?? null}
          isLoading={analyticsQuery.isLoading}
        />

        <AdminAnalyticsClaimsTable
          claimsPage={claimsPage}
          isLoading={claimsPageQuery.isLoading}
          hasPreviousPage={cursorTrail.length > 0}
          currentPage={cursorTrail.length + 1}
          pageSize={pageSize}
          pageSizeOptions={[...CURSOR_PAGE_SIZE_OPTIONS]}
          onPageSizeChange={handlePageSizeChange}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
        />

        {analyticsQuery.isError ? (
          <div className="rounded-lg border border-error/30 bg-error-light px-4 py-3 text-sm text-error">
            {analyticsQuery.error.message}
          </div>
        ) : null}

        {claimsPageQuery.isError ? (
          <div className="rounded-lg border border-error/30 bg-error-light px-4 py-3 text-sm text-error">
            {claimsPageQuery.error.message}
          </div>
        ) : null}
      </div>
    </main>
  )
}
