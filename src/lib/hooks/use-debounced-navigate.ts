import { useEffect, useRef } from 'react'

/**
 * Fires navigate(buildHref()) whenever any debounced text value diverges from
 * its corresponding applied value. Both buildHref and navigate are captured via
 * refs so they are always called with the latest render's closures without being
 * deps — the only dep is the JSON-serialized debounced-key string, which changes
 * only when a text field's debounced value changes.
 */
export function useDebouncedNavigate(
  debouncedValues: string[],
  appliedValues: string[],
  navigate: (href: string) => void,
  buildHref: () => string
): void {
  const appliedKeyRef = useRef(JSON.stringify(appliedValues))
  const buildHrefRef = useRef(buildHref)
  const navigateRef = useRef(navigate)

  useEffect(() => {
    appliedKeyRef.current = JSON.stringify(appliedValues)
    buildHrefRef.current = buildHref
    navigateRef.current = navigate
  })

  const debouncedKey = JSON.stringify(debouncedValues)

  useEffect(() => {
    if (debouncedKey === appliedKeyRef.current) return
    navigateRef.current(buildHrefRef.current())
  }, [debouncedKey])
}
