'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import {
  searchClaimsAction,
  rollbackClaimStatusAction,
} from '@/features/admin/actions'
import type { AdminClaimRow } from '@/features/admin/queries'
import { formatDate } from '@/lib/utils/date'

export function ClaimOperations() {
  const [query, setQuery] = useState('')
  const [claims, setClaims] = useState<AdminClaimRow[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Rollback state
  const [selectedClaim, setSelectedClaim] = useState<AdminClaimRow | null>(null)
  const [rollbackReason, setRollbackReason] = useState('')
  const [isRollingBack, setIsRollingBack] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return
    setIsSearching(true)
    setSearchError(null)

    const result = await searchClaimsAction(query.trim())
    setIsSearching(false)

    if (!result.ok) {
      setSearchError(result.error)
      return
    }
    setClaims(result.data)
  }

  async function handleRollback() {
    if (!selectedClaim || !rollbackReason.trim()) return
    setIsRollingBack(true)

    const result = await rollbackClaimStatusAction({
      claimId: selectedClaim.id,
      reason: rollbackReason.trim(),
      confirmation: 'CONFIRM',
    })

    setIsRollingBack(false)

    if (!result.ok) {
      toast.error(result.error ?? 'Rollback failed')
      return
    }

    toast.success(
      `Claim ${selectedClaim.claim_number} rolled back to ${result.rolledBackTo}`
    )
    setSelectedClaim(null)
    setRollbackReason('')
    // Re-search to refresh statuses
    handleSearch()
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by claim number or employee name..."
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {searchError && <p className="text-sm text-red-600">{searchError}</p>}

      {/* Results table */}
      {claims.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-foreground/70">
                  Claim #
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground/70">
                  Employee
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground/70">
                  Date
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground/70">
                  Status
                </th>
                <th className="px-3 py-2 text-right font-medium text-foreground/70">
                  Amount
                </th>
                <th className="px-3 py-2 text-center font-medium text-foreground/70">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {claims.map((claim) => (
                <tr key={claim.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2 font-mono text-xs">
                    {claim.claim_number}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{claim.employee_name}</p>
                    <p className="text-xs text-foreground/50">
                      {claim.designation}
                    </p>
                  </td>
                  <td className="px-3 py-2">{formatDate(claim.claim_date)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {claim.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    ₹{claim.total_amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => setSelectedClaim(claim)}
                      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                    >
                      Rollback
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rollback confirmation dialog */}
      {selectedClaim && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-900/20">
          <h3 className="font-semibold text-amber-800 dark:text-amber-300">
            Rollback Claim: {selectedClaim.claim_number}
          </h3>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            Current status: <strong>{selectedClaim.status}</strong> — Employee:{' '}
            {selectedClaim.employee_name}
          </p>
          <div className="mt-3">
            <label
              htmlFor="rollback-reason"
              className="block text-sm font-medium text-amber-800 dark:text-amber-300"
            >
              Reason (required)
            </label>
            <textarea
              id="rollback-reason"
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Explain why this claim status needs to be rolled back..."
              className="mt-1 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none dark:border-amber-600 dark:bg-surface"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleRollback}
              disabled={isRollingBack || !rollbackReason.trim()}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {isRollingBack ? 'Rolling back...' : 'Confirm Rollback'}
            </button>
            <button
              onClick={() => {
                setSelectedClaim(null)
                setRollbackReason('')
              }}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {claims.length === 0 && !isSearching && query && !searchError && (
        <p className="text-center text-sm text-foreground/50">
          No claims found matching &ldquo;{query}&rdquo;.
        </p>
      )}
    </div>
  )
}
