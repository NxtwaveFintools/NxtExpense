'use client'

import { AnimatedNumber } from '@/components/ui/animated-number'
import { Skeleton } from '@/components/ui/skeleton'
import type { FinanceDashboardKPI } from '@/features/dashboard/types/finance-dashboard'

type KPICardDef = {
  label: string
  value: number
  format: 'inr' | 'count'
  accentClass: string
  valueClass: string
}

function buildCards(kpi: FinanceDashboardKPI): KPICardDef[] {
  return [
    {
      label: 'Pending Claims',
      value: kpi.total_count,
      format: 'count',
      accentClass: 'border-l-primary',
      valueClass: 'text-foreground',
    },
    {
      label: 'Total Pending Amount',
      value: kpi.total_amount,
      format: 'inr',
      accentClass: 'border-l-teal-500',
      valueClass: 'text-teal-600 dark:text-teal-400',
    },
    {
      label: 'Food Allowance',
      value: kpi.food_amount,
      format: 'inr',
      accentClass: 'border-l-amber-500',
      valueClass: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Fuel Charges',
      value: kpi.fuel_amount,
      format: 'inr',
      accentClass: 'border-l-orange-500',
      valueClass: 'text-orange-600 dark:text-orange-400',
    },
    {
      label: 'Intercity Travel',
      value: kpi.intercity_travel_amount,
      format: 'inr',
      accentClass: 'border-l-indigo-500',
      valueClass: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Intracity Allowance',
      value: kpi.intracity_allowance_amount,
      format: 'inr',
      accentClass: 'border-l-violet-500',
      valueClass: 'text-violet-600 dark:text-violet-400',
    },
  ]
}

function KPISkeleton() {
  return (
    <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </section>
  )
}

type FinanceKPIStripProps = {
  kpi: FinanceDashboardKPI | null
  isLoading: boolean
}

export function FinanceKPIStrip({ kpi, isLoading }: FinanceKPIStripProps) {
  if (isLoading || !kpi) {
    return <KPISkeleton />
  }

  const cards = buildCards(kpi)

  return (
    <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 animate-slide-up stagger-2">
      {cards.map((card) => {
        const hasDecimals =
          card.format === 'inr' && Math.abs(card.value % 1) > 0

        return (
          <div
            key={card.label}
            className={`rounded-xl border border-border border-l-[3px] ${card.accentClass} bg-surface p-4 shadow-sm`}
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </p>
            <p
              className={`mt-2 text-xl font-semibold tabular-nums ${card.valueClass}`}
            >
              <AnimatedNumber
                value={card.value}
                format={card.format}
                includeDecimals={hasDecimals}
              />
            </p>
          </div>
        )
      })}
    </section>
  )
}
