import { formatDate } from '@/lib/utils/date'

import type { ClaimWithItems } from '@/features/claims/types'

type ClaimDetailProps = {
  claim: ClaimWithItems['claim']
  items: ClaimWithItems['items']
  employeeName: string
}

export function ClaimDetail({ claim, items, employeeName }: ClaimDetailProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Claim Details</h2>
      <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-foreground/60">Claim ID</dt>
          <dd className="font-medium">{claim.claim_number}</dd>
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
              {item.item_type.replaceAll('_', ' ')}
            </span>
            <span>Rs. {Number(item.amount).toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
