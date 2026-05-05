import type { Metadata } from 'next'

import { ClaimOperations } from '@/features/admin/components/claim-operations'

export const metadata: Metadata = { title: 'Admin Claims' }

export default function AdminClaimsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">
        Claim Operations
      </h2>
      <p className="text-sm text-foreground/60">
        Search for claims to perform administrative status reassignment and
        workflow correction actions.
      </p>
      <ClaimOperations />
    </div>
  )
}
