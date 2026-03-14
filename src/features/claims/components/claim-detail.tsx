import { formatDate } from '@/lib/utils/date'

import type { ClaimWithItems } from '@/features/claims/types'
import type { EmployeeRow } from '@/lib/services/employee-service'

function resolveNextApprover(
  claim: ClaimWithItems['claim'],
  owner: EmployeeRow | null
): string | null {
  if (!owner) return null
  const level = claim.current_approval_level
  if (!level || level > 2 || claim.is_terminal || claim.is_rejection)
    return null
  if (level === 1)
    return owner.approval_employee_id_level_1 ? 'Level 1 Approver (SBH)' : null
  if (level === 2)
    return owner.approval_employee_id_level_3 ? 'Level 2 Approver (HOD)' : null
  return null
}

type ClaimDetailProps = {
  claim: ClaimWithItems['claim']
  items: ClaimWithItems['items']
  employeeName: string
  owner?: EmployeeRow | null
}

export function ClaimDetail({
  claim,
  items,
  employeeName,
  owner = null,
}: ClaimDetailProps) {
  const nextApprover = resolveNextApprover(claim, owner)

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Claim Details</h2>
      <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-foreground/60">Claim ID</dt>
          <dd className="font-medium whitespace-nowrap">
            {claim.claim_number}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-foreground/60">Employee</dt>
          <dd>{employeeName}</dd>
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

      {claim.is_terminal && claim.is_rejection ? (
        claim.allow_resubmit ? (
          <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm">
            <p className="font-medium text-green-700 dark:text-green-400">
              New claim permitted
            </p>
            <p className="mt-0.5 text-green-700/80 dark:text-green-400/80">
              The approver has allowed you to raise a new claim for this date.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
            <p className="font-medium text-red-700 dark:text-red-400">
              Permanently closed
            </p>
            <p className="mt-0.5 text-red-700/80 dark:text-red-400/80">
              This claim is permanently closed. No new claim can be raised for
              this date.
            </p>
          </div>
        )
      ) : null}

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
              {item.item_type.replaceAll('_', ' ')}
            </span>
            <span>Rs. {Number(item.amount).toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
