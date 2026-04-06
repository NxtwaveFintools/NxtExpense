'use client'

import type { FinanceDashboardData } from '../types/finance-dashboard'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ExpenseTypeBreakdownLineChart,
  VehicleTypeDonut,
} from './finance-chart-donuts'
import {
  AmountByDesignationChart,
  ClaimsByWorkLocationChart,
  ClaimsByStateChart,
  AvgAmountByDesignationChart,
} from './finance-chart-bars'

function ChartsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[300px] rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[320px] rounded-xl" />
        ))}
      </div>
    </div>
  )
}

type FinanceDashboardChartsProps = {
  data: FinanceDashboardData | null
  isLoading: boolean
}

export function FinanceDashboardCharts({
  data,
  isLoading,
}: FinanceDashboardChartsProps) {
  if (isLoading || !data) {
    return <ChartsSkeleton />
  }

  return (
    <div className="space-y-6 animate-slide-up stagger-4">
      <ExpenseTypeBreakdownLineChart data={data.by_expense_type} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AmountByDesignationChart data={data.by_designation} />
        <ClaimsByWorkLocationChart data={data.by_work_location} />
        <ClaimsByStateChart data={data.by_state} />
        <VehicleTypeDonut data={data.by_vehicle_type} />
        <AvgAmountByDesignationChart data={data.by_designation} />
      </div>
    </div>
  )
}
