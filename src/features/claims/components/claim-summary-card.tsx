type ClaimSummaryCardProps = {
  totalAmount: number | null
  lineItems: Array<{
    label: string
    amount?: number
  }>
}

export function ClaimSummaryCard({
  totalAmount,
  lineItems,
}: ClaimSummaryCardProps) {
  return (
    <aside className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-foreground/70">
        Claim Summary
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        {lineItems.map((lineItem) => (
          <li
            key={lineItem.label}
            className="flex items-center justify-between"
          >
            <span>{lineItem.label}</span>
            {typeof lineItem.amount === 'number' ? (
              <span className="font-medium">
                Rs. {lineItem.amount.toFixed(2)}
              </span>
            ) : (
              <span className="text-xs text-foreground/60">-</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-border pt-3">
        <p className="flex items-center justify-between text-sm font-semibold">
          <span>Total</span>
          <span>
            {typeof totalAmount === 'number'
              ? `Rs. ${totalAmount.toFixed(2)}`
              : 'Calculated by backend policy'}
          </span>
        </p>
      </div>
    </aside>
  )
}
