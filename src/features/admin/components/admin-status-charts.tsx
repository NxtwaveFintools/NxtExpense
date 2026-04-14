'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { AdminDashboardAnalytics } from '@/features/admin/types/analytics'

const AXIS_STYLE = {
  fontSize: 11,
  fill: '#64748b',
}

function getStatusColor(statusName: string): string {
  const normalized = statusName.toLowerCase()

  if (normalized.includes('reject') && normalized.includes('reclaim')) {
    return '#e11d48'
  }

  if (
    normalized.includes('submitted') &&
    normalized.includes('await') &&
    normalized.includes('sbh')
  ) {
    return '#2563eb'
  }

  if (
    normalized.includes('sbh') &&
    normalized.includes('await') &&
    normalized.includes('hod')
  ) {
    return '#1d4ed8'
  }

  if (
    normalized.includes('hod') &&
    normalized.includes('await') &&
    normalized.includes('finance')
  ) {
    return '#0891b2'
  }

  if (
    normalized.includes('finance') &&
    normalized.includes('approved') &&
    normalized.includes('await')
  ) {
    return '#0f766e'
  }

  if (normalized.includes('finance') && normalized.includes('approved')) {
    return '#0d9488'
  }

  if (normalized.includes('reject')) {
    return '#b91c1c'
  }

  if (normalized.includes('payment') || normalized.includes('released')) {
    return '#15803d'
  }

  if (normalized.includes('sbh')) {
    return '#3b82f6'
  }

  if (normalized.includes('zbh')) {
    return '#7c3aed'
  }

  if (normalized.includes('finance')) {
    return '#06b6d4'
  }

  if (normalized.includes('approve')) {
    return '#16a34a'
  }

  if (normalized.includes('pending') || normalized.includes('await')) {
    return '#d97706'
  }

  return '#64748b'
}

function getStatusStageOrder(statusName: string): number {
  const normalized = statusName.toLowerCase()

  if (normalized.includes('reject') && normalized.includes('reclaim')) {
    return 91
  }

  if (
    normalized.includes('submitted') &&
    normalized.includes('await') &&
    normalized.includes('sbh')
  ) {
    return 10
  }

  if (
    normalized.includes('sbh') &&
    normalized.includes('await') &&
    normalized.includes('hod')
  ) {
    return 20
  }

  if (
    normalized.includes('hod') &&
    normalized.includes('await') &&
    normalized.includes('finance')
  ) {
    return 30
  }

  if (
    normalized.includes('finance') &&
    normalized.includes('approved') &&
    normalized.includes('await')
  ) {
    return 40
  }

  if (normalized.includes('finance') && normalized.includes('approved')) {
    return 45
  }

  if (normalized.includes('payment') || normalized.includes('released')) {
    return 50
  }

  if (normalized.includes('reject')) {
    return 90
  }

  return 70
}

function formatINR(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function formatShortINR(value: number): string {
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return `${value}`
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-surface via-surface to-background/80 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/50 text-sm text-muted-foreground">
      No data available for the selected filters.
    </div>
  )
}

type TooltipEntry = {
  name?: string
  value?: number | string
}

function ChartTooltip({
  active,
  label,
  payload,
  valueType = 'amount',
}: {
  active?: boolean
  label?: string
  payload?: TooltipEntry[]
  valueType?: 'count' | 'amount'
}) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const value = Number(payload[0]?.value ?? 0)
  const metric =
    valueType === 'count'
      ? `${value.toLocaleString('en-IN')} claims`
      : formatINR(value)

  return (
    <div className="rounded-xl border border-border bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      {label ? <p className="font-semibold text-foreground">{label}</p> : null}
      <p className="mt-1 text-muted-foreground">{metric}</p>
    </div>
  )
}

export function TopStatusAmountChart({
  data,
}: {
  data: AdminDashboardAnalytics
}) {
  const chartData = data.by_status
    .map((row) => ({
      status_name: row.status_name,
      total_amount: Number(row.total_amount),
    }))
    .sort((left, right) => right.total_amount - left.total_amount)
    .slice(0, 6)

  if (chartData.length === 0) {
    return (
      <ChartCard
        title="Top Statuses by Amount"
        subtitle="Where the highest reimbursement value is currently concentrated"
      >
        <EmptyChart />
      </ChartCard>
    )
  }

  return (
    <ChartCard
      title="Top Statuses by Amount"
      subtitle="Where the highest reimbursement value is currently concentrated"
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData}>
          <CartesianGrid
            strokeDasharray="2 5"
            vertical={false}
            stroke="#cbd5e1"
            strokeOpacity={0.45}
          />
          <XAxis
            dataKey="status_name"
            angle={-20}
            textAnchor="end"
            height={60}
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatShortINR}
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: '#f1f5f9', opacity: 0.55 }}
          />
          <Bar dataKey="total_amount" radius={[12, 12, 0, 0]} barSize={22}>
            {chartData.map((entry) => (
              <Cell
                key={entry.status_name}
                fill={getStatusColor(entry.status_name)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function StatusSharePieChart({
  data,
}: {
  data: AdminDashboardAnalytics
}) {
  if (data.by_status.length === 0) {
    return (
      <ChartCard
        title="Status Stage Share"
        subtitle="Pending claim count across approval-to-payment stages"
      >
        <EmptyChart />
      </ChartCard>
    )
  }

  const chartData = data.by_status
    .map((row) => ({
      status_name: row.status_name,
      claim_count: row.claim_count,
    }))
    .sort((left, right) => {
      const rankDiff =
        getStatusStageOrder(left.status_name) -
        getStatusStageOrder(right.status_name)

      if (rankDiff !== 0) {
        return rankDiff
      }

      return right.claim_count - left.claim_count
    })

  return (
    <ChartCard
      title="Status Stage Share"
      subtitle="Pending claim count across approval-to-payment stages"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="claim_count"
              nameKey="status_name"
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={96}
              paddingAngle={3}
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.status_name}
                  fill={getStatusColor(entry.status_name)}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip valueType="count" />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="space-y-1.5 rounded-xl border border-border/70 bg-background/70 p-3">
          {chartData.map((entry) => (
            <div
              key={entry.status_name}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span
                className="inline-block size-2.5 rounded-full"
                style={{
                  backgroundColor: getStatusColor(entry.status_name),
                }}
              />
              <span className="truncate">{entry.status_name}</span>
              <span className="ml-auto font-semibold text-foreground">
                {entry.claim_count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  )
}
