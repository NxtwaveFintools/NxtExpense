import { useEffect, useState } from 'react'

/**
 * Returns `value` after it has stopped changing for `delayMs`. Useful for
 * search-as-you-type inputs that should only act once the user pauses.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [value, delayMs])

  return debouncedValue
}
