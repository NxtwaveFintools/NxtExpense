import type { Page } from '@playwright/test'

export class ApprovalsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/approvals')
    await this.page.waitForLoadState('networkidle')
  }

  // ── Pending approvals ─────────────────────────────────────────────────

  get pendingRows() {
    return this.page.locator(
      '[data-testid="pending-row"], table:first-of-type tbody tr'
    )
  }

  get emptyPendingState() {
    return this.page.getByText(/no pending/i)
  }

  // Navigate into the first pending claim's detail page
  get reviewFirstClaim() {
    return this.page.getByRole('link', { name: /review/i }).first()
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
