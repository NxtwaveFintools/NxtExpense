'use client'

import CountUp from 'react-countup'

type AnimatedNumberFormat = 'count' | 'inr'

type AnimatedNumberProps = {
  value: number
  durationSeconds?: number
  className?: string
  format?: AnimatedNumberFormat
  includeDecimals?: boolean
}

function formatValue(
  value: number,
  format: AnimatedNumberFormat,
  includeDecimals: boolean
): string {
  if (format === 'inr') {
    return `₹${value.toLocaleString('en-IN', {
      minimumFractionDigits: includeDecimals ? 2 : 0,
      maximumFractionDigits: includeDecimals ? 2 : 0,
    })}`
  }

  return Math.round(value).toLocaleString('en-IN')
}

export function AnimatedNumber({
  value,
  durationSeconds = 1,
  className,
  format = 'count',
  includeDecimals = false,
}: AnimatedNumberProps) {
  const safeValue = Number.isFinite(value) ? value : 0

  return (
    <CountUp
      className={className}
      start={0}
      end={safeValue}
      duration={durationSeconds}
      redraw
      useEasing
      formattingFn={(currentValue) =>
        formatValue(currentValue, format, includeDecimals)
      }
    />
  )
}
