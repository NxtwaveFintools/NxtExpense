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
    <aside className="self-start rounded-2xl border border-border bg-surface p-5 shadow-sm lg:sticky lg:top-24">
      <div className="rounded-xl border border-border bg-background p-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Claim Summary
        </h3>

        <div className="mt-4 space-y-2">
          {lineItems.map((lineItem) => (
            <div
              key={lineItem.label}
              className="grid grid-cols-[1fr_auto] items-end gap-3"
            >
              <p className="text-sm text-foreground">{lineItem.label}</p>
              <p className="font-mono text-sm font-semibold text-foreground">
                {typeof lineItem.amount === 'number'
                  ? `Rs. ${lineItem.amount.toFixed(2)}`
                  : 'Rs. 0.00'}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-dashed border-border pt-3">
          <p className="text-right text-muted-foreground">+</p>
          <div className="mt-2 flex items-center justify-between text-sm font-semibold">
            <span>Payable Total</span>
            <span className="font-mono text-base text-primary">
              {typeof totalAmount === 'number'
                ? `Rs. ${totalAmount.toFixed(2)}`
                : 'Rs. 0.00'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
