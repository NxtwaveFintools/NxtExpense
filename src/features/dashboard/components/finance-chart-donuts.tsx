'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type {
  ExpenseTypeBreakdown,
  VehicleTypeBreakdown,
} from '@/features/dashboard/types/finance-dashboard'

function getVehicleTypeColor(vehicleName: string): string {
  const normalized = vehicleName.toLowerCase()

  if (normalized.includes('two')) {
    return '#2563eb'
  }

  if (normalized.includes('four')) {
    return '#7c3aed'
  }

  if (normalized.includes('taxi') || normalized.includes('no vehicle')) {
    return '#d97706'
  }

  return '#0f766e'
}

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  food_base: 'Food - Base Location',
  food_outstation: 'Food - Outstation',
  fuel: 'Fuel Charges',
  intercity_travel: 'Intercity Travel (KM)',
  intracity_allowance: 'Intracity Local Travel',
  taxi_bill: 'Taxi Bills',
  accommodation: 'Accommodation',
  food_with_principals: 'Food with Principals',
}

const EXPENSE_TYPE_SORT_ORDER = [
  'food_base',
  'food_outstation',
  'fuel',
  'intercity_travel',
  'intracity_allowance',
  'taxi_bill',
  'accommodation',
  'food_with_principals',
]

const AXIS_STYLE = {
  fontSize: 11,
  fill: '#64748b',
}

function formatINR(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function formatShortINR(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value}`
}

function toTitleCaseSnake(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

function toExpenseTypeLabel(value: string): string {
  return EXPENSE_TYPE_LABELS[value] ?? toTitleCaseSnake(value)
}

function toSortedBreakdown(data: ExpenseTypeBreakdown[]) {
  const orderIndex = new Map(
    EXPENSE_TYPE_SORT_ORDER.map((key, index) => [key, index])
  )

  return [...data]
    .map((entry) => ({
      label: toExpenseTypeLabel(entry.expense_type),
      amount: Number(entry.total_amount),
      sortIndex: orderIndex.get(entry.expense_type) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => {
      if (left.sortIndex !== right.sortIndex) {
        return left.sortIndex - right.sortIndex
      }

      return left.label.localeCompare(right.label)
    })
}

function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: string
  payload?: Array<{
    value?: number | string
    payload?: {
      claimCount?: number
    }
  }>
}) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const claimCount = payload[0]?.payload?.claimCount

  return (
    <div className="rounded-xl border border-border bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      {label ? <p className="font-semibold text-foreground">{label}</p> : null}
      <p className="mt-1 text-muted-foreground">
        {formatINR(Number(payload[0]?.value ?? 0))}
      </p>
      {typeof claimCount === 'number' ? (
        <p className="mt-0.5 text-muted-foreground">
          {claimCount.toLocaleString('en-IN')} claims
        </p>
      ) : null}
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
    <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/50 text-sm text-muted-foreground">
      No data available for the selected filters.
    </div>
  )
}

export function ExpenseTypeBreakdownLineChart({
  data,
}: {
  data: ExpenseTypeBreakdown[]
}) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Expenses"
        subtitle="Breakdown across major expense categories"
      >
        <EmptyChart />
      </ChartCard>
    )
  }

  const chartData = toSortedBreakdown(data)

  return (
    <ChartCard
      title="Expenses"
      subtitle="Breakdown across major expense categories"
    >
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 8, bottom: 72 }}
        >
          <defs>
            <linearGradient
              id="expenseAreaGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.1} />
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
            interval={0}
            angle={-20}
            textAnchor="end"
            height={72}
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
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#0f766e"
            strokeWidth={2.5}
            fill="url(#expenseAreaGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function VehicleTypeDonut({ data }: { data: VehicleTypeBreakdown[] }) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Vehicle Type Share"
        subtitle="Distribution of reimbursement amount by vehicle"
      >
        <EmptyChart />
      </ChartCard>
    )
  }

  const chartData = data.map((row) => ({
    name: row.vehicle_name,
    value: Number(row.total_amount),
    claimCount: Number(row.claim_count),
  }))

  const total = chartData.reduce((sum, row) => sum + row.value, 0)
  const totalClaims = chartData.reduce((sum, row) => sum + row.claimCount, 0)

  return (
    <ChartCard
      title="Vehicle Type Share"
      subtitle="Distribution of reimbursement amount by vehicle"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={98}
              paddingAngle={3}
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={getVehicleTypeColor(entry.name)} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total Amount
          </p>
          <p className="text-lg font-semibold text-foreground">
            {formatINR(total)}
          </p>
          <p className="text-xs text-muted-foreground">
            {totalClaims.toLocaleString('en-IN')} claims
          </p>
          <div className="space-y-1.5">
            {chartData.map((entry) => (
              <div
                key={entry.name}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: getVehicleTypeColor(entry.name) }}
                />
                <span className="truncate">{entry.name}</span>
                <span className="ml-auto whitespace-nowrap font-medium text-foreground">
                  {entry.claimCount.toLocaleString('en-IN')} /{' '}
                  {formatINR(entry.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ChartCard>
  )
}
