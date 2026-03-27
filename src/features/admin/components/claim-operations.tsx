'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  changeClaimStatusAction,
  getClaimStatusOptionsAction,
  searchClaimsAction,
} from '@/features/admin/actions'
import type {
  AdminClaimRow,
  AdminClaimStatusOption,
} from '@/features/admin/queries'
import { formatDate } from '@/lib/utils/date'

export function ClaimOperations() {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')

  // Status change state
  const [selectedClaim, setSelectedClaim] = useState<AdminClaimRow | null>(null)
  const [targetStatusId, setTargetStatusId] = useState('')
  const [statusChangeReason, setStatusChangeReason] = useState('')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const statusOptionsQuery = useQuery<AdminClaimStatusOption[], Error>({
    queryKey: ['admin-claim-status-options'],
    queryFn: async () => {
      const result = await getClaimStatusOptionsAction()

      if (!result.ok) {
        throw new Error(result.error ?? 'Failed to load status options.')
      }

      return result.data
    },
    gcTime: 5 * 60 * 1000,
  })

  const claimsQuery = useQuery<AdminClaimRow[], Error>({
    queryKey: ['admin-claims-search', submittedQuery],
    queryFn: async () => {
      const result = await searchClaimsAction(submittedQuery)

      if (!result.ok) {
        throw new Error(result.error ?? 'Search failed.')
      }

      return result.data
    },
    enabled: submittedQuery.length > 0,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  const claims = claimsQuery.data ?? []
  const isSearching = claimsQuery.isFetching
  const searchError = claimsQuery.isError ? claimsQuery.error.message : null
  const statusOptions = statusOptionsQuery.data ?? []
  const isLoadingStatusOptions = statusOptionsQuery.isFetching

  async function handleSearch() {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) {
      return
    }

    setSubmittedQuery(normalizedQuery)
  }

  async function handleStatusChange() {
    if (!selectedClaim || !targetStatusId || !statusChangeReason.trim()) {
      return
    }

    setIsUpdatingStatus(true)

    const result = await changeClaimStatusAction({
      claimId: selectedClaim.id,
      targetStatusId,
      reason: statusChangeReason.trim(),
      confirmation: 'CONFIRM',
    })

    setIsUpdatingStatus(false)

    if (!result.ok) {
      toast.error(result.error ?? 'Status update failed')
      return
    }

    toast.success(
      `Claim ${selectedClaim.claim_number} moved from ${result.previousStatusCode ?? 'unknown'} to ${result.updatedStatusCode ?? 'unknown'}.`
    )
    setSelectedClaim(null)
    setTargetStatusId('')
    setStatusChangeReason('')

    if (submittedQuery) {
      void claimsQuery.refetch()
    }
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
      {statusOptionsQuery.isError ? (
        <p className="text-sm text-red-600">
          {statusOptionsQuery.error.message}
        </p>
      ) : null}

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
                      onClick={() => {
                        setSelectedClaim(claim)
                        setTargetStatusId('')
                        setStatusChangeReason('')
                      }}
                      className="rounded-md border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      Change Status
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Status update panel */}
      {selectedClaim && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <h3 className="font-semibold text-primary">
            Change Claim Status: {selectedClaim.claim_number}
          </h3>
          <p className="mt-1 text-sm text-foreground/80">
            Current status: <strong>{selectedClaim.status}</strong> — Employee:{' '}
            {selectedClaim.employee_name}
          </p>

          <div className="mt-3">
            <label
              htmlFor="target-status"
              className="block text-sm font-medium text-foreground"
            >
              New status (required)
            </label>
            <select
              id="target-status"
              value={targetStatusId}
              onChange={(event) => setTargetStatusId(event.target.value)}
              disabled={isLoadingStatusOptions}
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">
                {isLoadingStatusOptions
                  ? 'Loading statuses...'
                  : 'Select target status'}
              </option>
              {statusOptions.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.status_name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <label
              htmlFor="status-change-reason"
              className="block text-sm font-medium text-foreground"
            >
              Reason (required)
            </label>
            <textarea
              id="status-change-reason"
              value={statusChangeReason}
              onChange={(event) => setStatusChangeReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Explain why this claim status needs to be changed..."
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleStatusChange}
              disabled={
                isUpdatingStatus ||
                !targetStatusId ||
                !statusChangeReason.trim()
              }
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isUpdatingStatus ? 'Updating...' : 'Confirm Status Change'}
            </button>
            <button
              onClick={() => {
                setSelectedClaim(null)
                setTargetStatusId('')
                setStatusChangeReason('')
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
