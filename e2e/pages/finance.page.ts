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
      '[data-testid="finance-queue-row"], table:has(th:has-text("Select")) tbody tr'
    )
  }

  getQueueRowByClaimNumber(claimNumber: string) {
    return this.queueRows.filter({ hasText: claimNumber }).first()
  }

  async openQueueClaimByNumber(claimNumber: string) {
    const claimRow = this.getQueueRowByClaimNumber(claimNumber)
    await claimRow.locator('a[href*="/claims/"]').first().click()
    await this.page.waitForURL(/\/claims\//)
    await this.page.waitForLoadState('networkidle')
  }

  getQueueCheckboxByClaimNumber(claimNumber: string) {
    return this.getQueueRowByClaimNumber(claimNumber).locator(
      'input[type="checkbox"]'
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
    return this.page.getByRole('button', { name: /^Issue$/i }).first()
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

  get claimNumberFilter() {
    return this.page.getByLabel(/claim number/i)
  }

  get statusFilter() {
    return this.page.getByLabel(/status/i)
  }

  get applyFiltersButton() {
    return this.page.getByRole('button', { name: /apply filters/i })
  }

  async filterByClaimNumber(claimNumber: string) {
    await this.claimNumberFilter.fill(claimNumber)
    await this.applyFiltersButton.click()
    await this.page.waitForLoadState('networkidle')
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
      name: /^Issue$/i,
    })
  }
}
