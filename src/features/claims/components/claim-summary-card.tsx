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
    <aside className="rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-24 self-start">
      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Claim Summary
      </h3>
      <ul className="mt-4 space-y-2.5 text-sm">
        {lineItems.map((lineItem) => (
          <li
            key={lineItem.label}
            className="flex items-center justify-between"
          >
            <span className="text-muted-foreground">{lineItem.label}</span>
            {typeof lineItem.amount === 'number' ? (
              <span className="font-mono font-medium">
                Rs. {lineItem.amount.toFixed(2)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-border pt-4">
        <p className="flex items-center justify-between text-sm font-semibold">
          <span>Total</span>
          <span className="text-base text-primary">
            {typeof totalAmount === 'number'
              ? `Rs. ${totalAmount.toFixed(2)}`
              : 'Calculated by backend policy'}
          </span>
        </p>
      </div>
    </aside>
  )
}
