'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type {
  DesignationBreakdown,
  StateBreakdown,
  WorkLocationBreakdown,
} from '@/features/dashboard/types/finance-dashboard'

const AXIS_STYLE = {
  fontSize: 11,
  fill: '#64748b',
}

function getWorkLocationColor(locationName: string): string {
  const normalized = locationName.toLowerCase()

  if (normalized.includes('outstation')) {
    return '#0284c7'
  }

  if (normalized.includes('base')) {
    return '#0f766e'
  }

  if (normalized.includes('office') || normalized.includes('wfh')) {
    return '#64748b'
  }

  if (normalized.includes('leave') || normalized.includes('week-off')) {
    return '#b45309'
  }

  return '#6366f1'
}

function formatINR(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function formatShortINR(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value}`
}

type TooltipEntry = {
  name?: string
  value?: number | string
}

function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: string
  payload?: TooltipEntry[]
}) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const value = Number(payload[0]?.value ?? 0)

  return (
    <div className="rounded-xl border border-border bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      {label ? <p className="font-semibold text-foreground">{label}</p> : null}
      <p className="mt-1 text-muted-foreground">{formatINR(value)}</p>
    </div>
  )
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

export function AmountByDesignationChart({
  data,
}: {
  data: DesignationBreakdown[]
}) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Amount by Designation"
        subtitle="Claim amount concentration by designation"
      >
        <EmptyChart />
      </ChartCard>
    )
  }

  const chartData = data.map((row) => ({
    label: row.designation_name,
    amount: Number(row.total_amount),
  }))

  return (
    <ChartCard
      title="Amount by Designation"
      subtitle="Claim amount concentration by designation"
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
          <defs>
            <linearGradient
              id="designationAmountGradient"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.9} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="2 5"
            vertical={false}
            stroke="#cbd5e1"
            strokeOpacity={0.45}
          />
          <XAxis
            type="number"
            tickFormatter={formatShortINR}
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: '#f1f5f9', opacity: 0.55 }}
          />
          <Bar
            dataKey="amount"
            fill="url(#designationAmountGradient)"
            radius={[12, 12, 12, 12]}
            barSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function ClaimsByWorkLocationChart({
  data,
}: {
  data: WorkLocationBreakdown[]
}) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Claims by Work Location"
        subtitle="Volume and amount split across locations"
      >
        <EmptyChart />
      </ChartCard>
    )
  }

  const chartData = data.map((row) => ({
    label: row.location_name,
    amount: Number(row.total_amount),
    fill: getWorkLocationColor(row.location_name),
  }))

  return (
    <ChartCard
      title="Claims by Work Location"
      subtitle="Volume and amount split across locations"
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
            dataKey="label"
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
          <Bar dataKey="amount" radius={[12, 12, 0, 0]} barSize={26}>
            {chartData.map((entry) => (
              <Cell key={entry.label} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function ClaimsByStateChart({ data }: { data: StateBreakdown[] }) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Claims by State"
        subtitle="State-level reimbursement spend visibility"
      >
        <EmptyChart />
      </ChartCard>
    )
  }

  const chartData = data.map((row) => ({
    label: row.state_name,
    amount: Number(row.total_amount),
  }))

  return (
    <ChartCard
      title="Claims by State"
      subtitle="State-level reimbursement spend visibility"
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData}>
          <defs>
            <linearGradient
              id="stateAmountGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.85} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="2 5"
            vertical={false}
            stroke="#cbd5e1"
            strokeOpacity={0.45}
          />
          <XAxis
            dataKey="label"
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
          <Bar
            dataKey="amount"
            fill="url(#stateAmountGradient)"
            radius={[12, 12, 0, 0]}
            barSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function AvgAmountByDesignationChart({
  data,
}: {
  data: DesignationBreakdown[]
}) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Average Claim by Designation"
        subtitle="Average claim value for each designation"
      >
        <EmptyChart />
      </ChartCard>
    )
  }

  const chartData = data.map((row) => ({
    label: row.designation_name,
    average: Number(row.avg_amount),
  }))

  return (
    <ChartCard
      title="Average Claim by Designation"
      subtitle="Average claim value for each designation"
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
          <defs>
            <linearGradient
              id="designationAverageGradient"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.9} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="2 5"
            vertical={false}
            stroke="#cbd5e1"
            strokeOpacity={0.45}
          />
          <XAxis
            type="number"
            tickFormatter={formatShortINR}
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: '#f1f5f9', opacity: 0.55 }}
          />
          <Bar
            dataKey="average"
            fill="url(#designationAverageGradient)"
            radius={[12, 12, 12, 12]}
            barSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
