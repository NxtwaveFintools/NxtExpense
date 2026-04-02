import type { Locator, Page } from '@playwright/test'

const NAVIGATION_MAX_ATTEMPTS = 3
const NAVIGATION_RETRY_DELAY_MS = 500

export class ApprovalsPage {
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

  private get claimDateFromInput() {
    return this.page.locator('input[name="claimDateFrom"]')
  }

  private get claimDateToInput() {
    return this.page.locator('input[name="claimDateTo"]')
  }

  private get applyFiltersButton() {
    return this.page.getByRole('button', { name: /apply filters/i })
  }

  private parseClaimDateIsoFromClaimNumber(claimNumber: string): string | null {
    const dateMatch = claimNumber.match(/-(\d{2})(\d{2})(\d{2})-\d+$/)
    if (!dateMatch) {
      return null
    }

    const [, dd, mm, yy] = dateMatch
    return `20${yy}-${mm}-${dd}`
  }

  private async applyClaimDateFilterForClaimNumber(claimNumber: string) {
    const claimDateIso = this.parseClaimDateIsoFromClaimNumber(claimNumber)
    if (!claimDateIso) {
      return
    }

    const hasDateFilterInputs =
      (await this.claimDateFromInput.count()) > 0 &&
      (await this.claimDateToInput.count()) > 0

    if (!hasDateFilterInputs) {
      return
    }

    try {
      await this.claimDateFromInput
        .first()
        .fill(claimDateIso, { timeout: 5_000 })
      await this.claimDateToInput.first().fill(claimDateIso, { timeout: 5_000 })

      if ((await this.applyFiltersButton.count()) > 0) {
        await this.applyFiltersButton.first().click({ timeout: 5_000 })
        await this.page.waitForLoadState('networkidle')
      }
    } catch {
      // Allow retry loop in waitForPendingRowByClaimNumber to recover.
    }
  }

  async goto() {
    await this.navigateWithRetry('/approvals')
  }

  // ── Pending approvals ─────────────────────────────────────────────────

  get pendingSection() {
    return this.page
      .locator('section:has(h2:has-text("Pending Approvals"))')
      .first()
  }

  get pendingRows() {
    return this.pendingSection.locator('table tbody tr')
  }

  get pendingNextLink() {
    return this.pendingSection.getByRole('link', { name: /^Next$/i }).first()
  }

  getPendingRowByClaimNumber(claimNumber: string) {
    return this.pendingRows.filter({ hasText: claimNumber }).first()
  }

  getPendingRowByEmployeeName(employeeName: string) {
    return this.pendingRows.filter({ hasText: employeeName }).first()
  }

  private async moveToNextPendingPage(
    visitedNextHrefs: Set<string>
  ): Promise<boolean> {
    if ((await this.pendingNextLink.count()) === 0) {
      return false
    }

    const nextHref = await this.pendingNextLink.getAttribute('href')
    if (!nextHref || visitedNextHrefs.has(nextHref)) {
      return false
    }

    const previousUrl = this.page.url()
    visitedNextHrefs.add(nextHref)

    await this.pendingNextLink.click()
    await this.page.waitForLoadState('networkidle')

    return this.page.url() !== previousUrl
  }

  async hasPendingRowByClaimNumber(claimNumber: string): Promise<boolean> {
    const visitedNextHrefs = new Set<string>()
    const maxPendingPageHops = 250

    for (let hop = 0; hop <= maxPendingPageHops; hop += 1) {
      if ((await this.getPendingRowByClaimNumber(claimNumber).count()) > 0) {
        return true
      }

      const movedToNextPage = await this.moveToNextPendingPage(visitedNextHrefs)
      if (!movedToNextPage) {
        return false
      }
    }

    return false
  }

  async waitForPendingRowByClaimNumber(
    claimNumber: string,
    timeoutMs = 90_000
  ): Promise<Locator> {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      try {
        await this.goto()
        await this.applyClaimDateFilterForClaimNumber(claimNumber)

        const hasPendingRow = await this.hasPendingRowByClaimNumber(claimNumber)
        if (hasPendingRow) {
          return this.getPendingRowByClaimNumber(claimNumber)
        }
      } catch {
        // Transient server/page errors are retried until timeout.
      }

      await this.page.waitForTimeout(250)
    }

    throw new Error(
      `Pending approvals row not found for claim number ${claimNumber}.`
    )
  }

  async openPendingClaimByNumber(claimNumber: string) {
    const claimRow = await this.waitForPendingRowByClaimNumber(claimNumber)
    const claimLink = claimRow.locator('a[href*="/claims/"]').first()
    await claimLink.waitFor({ state: 'visible', timeout: 20_000 })

    const claimHref = await claimLink.getAttribute('href')
    if (!claimHref) {
      throw new Error(`Unable to resolve claim detail link for ${claimNumber}.`)
    }

    await this.page.goto(claimHref)
    await this.page.waitForURL(/\/claims\//)
    await this.page.waitForLoadState('networkidle')
  }

  get emptyPendingState() {
    return this.page.getByText(/no pending/i)
  }

  // Navigate into the first pending claim's detail page
  get reviewFirstClaim() {
    return this.page
      .locator('table:first-of-type tbody tr a[href*="/claims/"]')
      .first()
  }

  // ── Approval actions ──────────────────────────────────────────────────

  getApproveButton(claimId?: string) {
    if (claimId) {
      return this.page
        .locator(`[data-claim-id="${claimId}"]`)
        .getByRole('button', { name: /^Approve$/i })
    }
    // Exact match to avoid resolving to the disabled "Bulk Approve" button on the list page
    return this.page.getByRole('button', { name: /^Approve$/i })
  }

  getApproveButtonForClaimNumber(claimNumber: string) {
    return this.getPendingRowByClaimNumber(claimNumber).getByRole('button', {
      name: /^Approve$/i,
    })
  }

  getRejectButton(claimId?: string) {
    if (claimId) {
      return this.page
        .locator(`[data-claim-id="${claimId}"]`)
        .getByRole('button', { name: /reject/i })
    }
    return this.page.getByRole('button', { name: /reject/i }).first()
  }

  get notesInput() {
    return this.page.getByLabel(/notes|reason|comments/i)
  }

  get confirmButton() {
    return this.page.getByRole('button', { name: /confirm|submit/i })
  }

  // ── History ───────────────────────────────────────────────────────────

  get historyRows() {
    return this.page.locator('[data-testid="history-row"]')
  }

  // ── Bulk actions ──────────────────────────────────────────────────────

  get selectAllCheckbox() {
    return this.page.getByLabel(/select all/i)
  }

  get bulkApproveButton() {
    return this.page.getByRole('button', {
      name: /approve.*selected|bulk.*approve/i,
    })
  }
}
