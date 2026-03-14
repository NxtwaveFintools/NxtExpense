import { formatDate } from '@/lib/utils/date'

import type { ClaimWithItems } from '@/features/claims/types'
import type { EmployeeRow } from '@/lib/services/employee-service'

function resolveNextApprover(
  claim: ClaimWithItems['claim'],
  owner: EmployeeRow
): string | null {
  // current_approval_level is the DB-sourced numeric level (1 = SBH, 2 = HOD).
  // Only show the next approver when the claim is actively waiting at L1 or L2.
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
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Claim Review</h2>
      <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-foreground/60">Claim ID</dt>
          <dd className="font-medium whitespace-nowrap">
            {claim.claim_number}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-foreground/60">Employee</dt>
          <dd>{owner.employee_name}</dd>
          <dd className="text-xs text-foreground/60">
            {owner.designations?.designation_name ?? ''}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-foreground/60">Claim Date</dt>
          <dd>{formatDate(claim.claim_date)}</dd>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-foreground/60">Location</dt>
          <dd>{claim.work_location}</dd>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-foreground/60">Total</dt>
          <dd>Rs. {Number(claim.total_amount).toFixed(2)}</dd>
        </div>
        {nextApprover ? (
          <div className="rounded-lg border border-border bg-background p-3">
            <dt className="text-foreground/60">Pending Approval From</dt>
            <dd className="font-medium text-amber-500">{nextApprover}</dd>
          </div>
        ) : null}
      </dl>

      <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.12em] text-foreground/70">
        Line Items
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
          >
            <span className="capitalize">
              {item.item_type.replace('_', ' ')}
            </span>
            <span>Rs. {Number(item.amount).toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
