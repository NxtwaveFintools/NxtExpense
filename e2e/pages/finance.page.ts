import type { Page } from '@playwright/test'

const NAVIGATION_MAX_ATTEMPTS = 3
const NAVIGATION_RETRY_DELAY_MS = 500

export class FinancePage {
  constructor(private page: Page) {}

  private async navigateWithRetry(pathname: string): Promise<void> {
    for (let attempt = 1; attempt <= NAVIGATION_MAX_ATTEMPTS; attempt += 1) {
      try {
        await this.page.goto(pathname, { timeout: 30_000 })
        await this.page.waitForLoadState('networkidle')
        return
      } catch (error) {
        if (attempt === NAVIGATION_MAX_ATTEMPTS) {
          throw error
        }

        await this.page.waitForTimeout(NAVIGATION_RETRY_DELAY_MS * attempt)
      }
    }
  }

  async goto() {
    await this.navigateWithRetry('/finance')
  }

  async gotoApprovedHistory() {
    await this.navigateWithRetry('/approved-history')
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
    return this.page
      .getByRole('button', {
        name: /approve|finance approved|issue|issued|mark as issued/i,
      })
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

  async filterHistoryByClaimNumber(claimNumber: string) {
    await this.filterByClaimNumber(claimNumber)
  }

  // ── History ───────────────────────────────────────────────────────────

  get historyRows() {
    return this.page.locator('[data-testid="finance-history-row"]')
  }

  get approvedHistoryAllCsvButton() {
    return this.page.getByRole('button', { name: /^All CSV$/i })
  }

  get approvedHistoryBcExpenseButton() {
    return this.page.getByRole('button', { name: /^BC Expense$/i })
  }

  get approvedHistoryPaymentJournalsButton() {
    return this.page.getByRole('button', { name: /^Payment Journals$/i })
  }

  getHistoryRowByClaimNumber(claimNumber: string) {
    return this.historyRows.filter({ hasText: claimNumber }).first()
  }

  getHistoryCheckboxByClaimNumber(claimNumber: string) {
    return this.getHistoryRowByClaimNumber(claimNumber).locator(
      'input[type="checkbox"]'
    )
  }

  // ── Bulk actions ──────────────────────────────────────────────────────

  get selectAllCheckbox() {
    return this.page.getByLabel(/select all/i)
  }

  get bulkIssueButton() {
    return this.page.getByRole('button', {
      name: /approve|finance approved|issue|issued|mark as issued/i,
    })
  }

  get bulkReleaseButton() {
    return this.page.getByRole('button', {
      name: /release payment|payment released|release/i,
    })
  }
}
