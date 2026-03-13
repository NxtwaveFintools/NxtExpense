import type { Page } from '@playwright/test'

export class FinancePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/finance')
    await this.page.waitForLoadState('networkidle')
  }

  // ── Queue ─────────────────────────────────────────────────────────────

  get queueRows() {
    return this.page.locator(
      '[data-testid="finance-queue-row"], table:first-of-type tbody tr'
    )
  }

  get emptyQueueState() {
    return this.page.getByText(/no claims|empty|nothing/i)
  }

  // ── Finance actions ───────────────────────────────────────────────────

  getIssueButton(claimId?: string) {
    if (claimId) {
      return this.page
        .locator(`[data-claim-id="${claimId}"]`)
        .getByRole('button', { name: /issue/i })
    }
    return this.queueRows
      .first()
      .getByRole('button', { name: /issue/i })
      .first()
  }

  getRejectButton(claimId?: string) {
    if (claimId) {
      return this.page
        .locator(`[data-claim-id="${claimId}"]`)
        .getByRole('button', { name: /reject/i })
    }
    return this.queueRows
      .first()
      .getByRole('button', { name: /reject/i })
      .first()
  }

  get notesInput() {
    return this.page.getByLabel(/notes|reason|comments/i)
  }

  get confirmButton() {
    return this.page.getByRole('button', { name: /confirm|submit/i })
  }

  // ── Filters ───────────────────────────────────────────────────────────

  get employeeNameFilter() {
    return this.page.getByLabel(/employee.*name/i)
  }

  get statusFilter() {
    return this.page.getByLabel(/status/i)
  }

  // ── History ───────────────────────────────────────────────────────────

  get historyRows() {
    return this.page.locator('[data-testid="finance-history-row"]')
  }

  // ── Bulk actions ──────────────────────────────────────────────────────

  get selectAllCheckbox() {
    return this.page.getByLabel(/select all/i)
  }

  get bulkIssueButton() {
    return this.page.getByRole('button', {
      name: /issue.*selected|bulk.*issue/i,
    })
  }
}
