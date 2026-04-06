'use client'

import { useMemo, useState } from 'react'

type EmployeeNameSuggestionInputProps = {
  value: string
  onValueChange: (value: string) => void
  suggestions: string[]
  isLoading?: boolean
  placeholder?: string
  minSearchLength?: number
  inputClassName?: string
}

const DEFAULT_INPUT_CLASSNAME =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground'

export function EmployeeNameSuggestionInput({
  value,
  onValueChange,
  suggestions,
  isLoading = false,
  placeholder = 'Search by employee name',
  minSearchLength = 2,
  inputClassName,
}: EmployeeNameSuggestionInputProps) {
  const [isFocused, setIsFocused] = useState(false)

  const trimmedValue = value.trim()

  const visibleSuggestions = useMemo(
    () => suggestions.filter((name) => name !== value),
    [suggestions, value]
  )

  const shouldShowDropdown =
    isFocused &&
    trimmedValue.length >= minSearchLength &&
    (isLoading || visibleSuggestions.length > 0)

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setIsFocused(false)
          }, 120)
        }}
        className={inputClassName ?? DEFAULT_INPUT_CLASSNAME}
        placeholder={placeholder}
        autoComplete="off"
      />

      {shouldShowDropdown ? (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          {isLoading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Searching employee names...
            </p>
          ) : (
            <ul className="max-h-48 overflow-y-auto py-1">
              {visibleSuggestions.map((employeeName) => (
                <li key={employeeName}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onValueChange(employeeName)
                      setIsFocused(false)
                    }}
                  >
                    {employeeName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
