import { AnimatedNumber } from '@/components/ui/animated-number'

type ClaimAnalyticsTone =
  | 'neutral'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'finance'

type ClaimAnalyticsCard = {
  label: string
  count: number
  amount: number
  tone: ClaimAnalyticsTone
}

type ClaimAnalyticsCardsProps = {
  cards: ClaimAnalyticsCard[]
  columnsClassName?: string
  className?: string
}

const TONE_STYLES: Record<
  ClaimAnalyticsTone,
  {
    accentClass: string
    countClass: string
  }
> = {
  neutral: {
    accentClass: 'border-l-primary',
    countClass: 'text-foreground',
  },
  pending: {
    accentClass: 'border-l-amber-500',
    countClass: 'text-amber-600 dark:text-amber-400',
  },
  approved: {
    accentClass: 'border-l-emerald-500',
    countClass: 'text-emerald-600 dark:text-emerald-400',
  },
  rejected: {
    accentClass: 'border-l-rose-500',
    countClass: 'text-rose-600 dark:text-rose-400',
  },
  finance: {
    accentClass: 'border-l-cyan-500',
    countClass: 'text-cyan-600 dark:text-cyan-400',
  },
}

export function ClaimAnalyticsCards({
  cards,
  columnsClassName = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4',
  className,
}: ClaimAnalyticsCardsProps) {
  const wrapperClassName = className
    ? `${columnsClassName} ${className}`
    : columnsClassName

  return (
    <section className={wrapperClassName}>
      {cards.map((card) => {
        const tone = TONE_STYLES[card.tone]
        const amountHasDecimals = Math.abs(card.amount % 1) > 0

        return (
          <div
            key={card.label}
            className={`rounded-lg border border-border border-l-[3px] ${tone.accentClass} bg-surface p-5`}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </p>
            <p
              className={`mt-2 text-2xl font-semibold tabular-nums ${tone.countClass}`}
            >
              <AnimatedNumber value={card.count} format="count" />
            </p>
            <p className="mt-1.5 text-sm font-medium text-muted-foreground">
              Amount{' '}
              <AnimatedNumber
                value={card.amount}
                format="inr"
                includeDecimals={amountHasDecimals}
              />
            </p>
          </div>
        )
      })}
    </section>
  )
}
