const DDMMYYYY_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/
const IST_TIME_ZONE = 'Asia/Kolkata'

const IST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

export function parseDateDDMMYYYY(raw: string): Date {
  const match = DDMMYYYY_REGEX.exec(raw.trim())
  if (!match) {
    throw new Error('Date must be in DD/MM/YYYY format.')
  }

  const [, dayString, monthString, yearString] = match
  const day = Number(dayString)
  const month = Number(monthString)
  const year = Number(yearString)
  const parsed = new Date(Date.UTC(year, month - 1, day))

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('Invalid calendar date.')
  }

  return parsed
}

function getUTCDateParts(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value.')
  }

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hours: date.getUTCHours(),
    minutes: date.getUTCMinutes(),
  }
}

function getISTDateParts(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value.')
  }

  const parts = IST_DATE_TIME_FORMATTER.formatToParts(date)

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  const hours = Number(parts.find((part) => part.type === 'hour')?.value)
  const minutes = Number(parts.find((part) => part.type === 'minute')?.value)
  const dayPeriod =
    parts
      .find((part) => part.type === 'dayPeriod')
      ?.value.toUpperCase()
      .replace('.', '') ?? 'AM'

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    throw new Error('Invalid date value.')
  }

  return {
    year,
    month,
    day,
    hours,
    minutes,
    dayPeriod,
  }
}

function padTwo(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatDate(value: Date | string): string {
  const parts = getISTDateParts(value)
  return `${padTwo(parts.day)}/${padTwo(parts.month)}/${parts.year}`
}

export function formatDatetime(value: Date | string): string {
  const parts = getISTDateParts(value)
  return `${padTwo(parts.day)}/${padTwo(parts.month)}/${parts.year} ${padTwo(parts.hours)}:${padTwo(parts.minutes)} ${parts.dayPeriod}`
}

export function toISODate(value: Date): string {
  const parts = getUTCDateParts(value)
  return `${parts.year}-${padTwo(parts.month)}-${padTwo(parts.day)}`
}

export function isValidClaimDate(value: Date): boolean {
  const inputIso = toISODate(value)
  const todayIst = getISTDateParts(new Date())
  const todayIso = `${todayIst.year}-${padTwo(todayIst.month)}-${padTwo(todayIst.day)}`

  return inputIso <= todayIso
}
