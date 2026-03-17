import { formatDate } from '@/lib/utils/date'

import { SubmittedClaimDetails } from '@/features/claims/components/submitted-claim-details'
import type { ClaimWithItems } from '@/features/claims/types'
import type { EmployeeRow } from '@/lib/services/employee-service'

function resolveNextApprover(
  claim: ClaimWithItems['claim'],
  owner: EmployeeRow
): string | null {
  const level = claim.current_approval_level
  if (!level || level > 2 || claim.is_terminal || claim.is_rejection)
    return null
  if (level === 1)
    return owner.approval_employee_id_level_1 ? 'Level 1 Approver (SBH)' : null
  if (level === 2)
    return owner.approval_employee_id_level_3 ? 'Level 2 Approver (HOD)' : null
  return null
}

type ApprovalDetailProps = {
  claim: ClaimWithItems['claim']
  items: ClaimWithItems['items']
  owner: EmployeeRow
}

export function ApprovalDetail({ claim, items, owner }: ApprovalDetailProps) {
  const nextApprover = resolveNextApprover(claim, owner)

  return (
    <section className="rounded-lg border border-border bg-surface p-6 animate-fade-in">
      <h2 className="text-lg font-semibold">Claim Review</h2>
      <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
        <div className="space-y-1 rounded-md border border-border bg-background p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Claim ID
          </dt>
          <dd className="font-mono font-semibold whitespace-nowrap text-primary">
            {claim.claim_number}
          </dd>
        </div>
        <div className="space-y-1 rounded-md border border-border bg-background p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Employee
          </dt>
          <dd className="font-medium">{owner.employee_name}</dd>
          <dd className="text-xs text-muted-foreground">
            {owner.designations?.designation_name ?? ''}
          </dd>
        </div>
        <div className="space-y-1 rounded-md border border-border bg-background p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Claim Date
          </dt>
          <dd className="font-medium">{formatDate(claim.claim_date)}</dd>
        </div>
        <div className="space-y-1 rounded-md border border-border bg-background p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Location
          </dt>
          <dd className="font-medium">{claim.work_location}</dd>
        </div>
        <div className="space-y-1 rounded-md border border-border bg-background p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </dt>
          <dd className="font-mono text-lg font-semibold">
            Rs. {Number(claim.total_amount).toFixed(2)}
          </dd>
        </div>
        {nextApprover ? (
          <div className="space-y-1 rounded-md border border-amber-200 bg-warning-light p-4 dark:border-amber-500/20">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pending Approval From
            </dt>
            <dd className="font-semibold text-amber-600 dark:text-amber-400">
              {nextApprover}
            </dd>
          </div>
        ) : null}
      </dl>

      <SubmittedClaimDetails claim={claim} />

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Line Items
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-md border border-border bg-background p-4"
          >
            <span className="capitalize font-medium">
              {item.item_type.replace('_', ' ')}
            </span>
            <span className="font-mono font-medium">
              Rs. {Number(item.amount).toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
