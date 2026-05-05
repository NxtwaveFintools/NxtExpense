import { Skeleton } from '@/components/ui/skeleton'

import {
  AmountByDesignationChart,
  ClaimsByStateChart,
  ClaimsByWorkLocationChart,
} from '../../dashboard/components/finance-chart-bars'
import { VehicleTypeDonut } from '../../dashboard/components/finance-chart-donuts'
import {
  TopStatusAmountChart,
  StatusSharePieChart,
} from './admin-status-charts'
import type { AdminDashboardAnalytics } from '@/features/admin/types/analytics'

type AdminAnalyticsChartsProps = {
  data: AdminDashboardAnalytics | null
  isLoading: boolean
}

function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {Array.from({ length: 7 }).map((_, index) => (
        <Skeleton key={index} className="h-[320px] rounded-xl" />
      ))}
    </div>
  )
}

export function AdminAnalyticsCharts({
  data,
  isLoading,
}: AdminAnalyticsChartsProps) {
  if (isLoading || !data) {
    return <ChartsSkeleton />
  }

  return (
    <div className="space-y-6 animate-slide-up stagger-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StatusSharePieChart data={data} />
        <TopStatusAmountChart data={data} />
        <AmountByDesignationChart data={data.by_designation} />
        <ClaimsByWorkLocationChart data={data.by_work_location} />
        <ClaimsByStateChart data={data.by_state} />
        <VehicleTypeDonut data={data.by_vehicle_type} />
      </div>
    </div>
  )
}
