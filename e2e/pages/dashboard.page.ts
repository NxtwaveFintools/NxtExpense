import type { Page } from '@playwright/test'

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard')
    await this.page.waitForLoadState('networkidle')
  }

  get heading() {
    return this.page.getByRole('heading', { level: 1 }).first()
  }

  get newClaimLink() {
    return this.page.getByRole('link', { name: /new claim/i })
  }

  get myClaimsLink() {
    return this.page.locator('a[href="/claims"]').first()
  }

  get approvalsLink() {
    return this.page.getByRole('link', { name: /pending approvals/i })
  }

  get financeLink() {
    return this.page.locator('a[href="/finance"]').first()
  }

  get approvedHistoryLink() {
    return this.page.locator('a[href="/approved-history"]').first()
  }

  get designation() {
    return this.page
      .locator('dd')
      .filter({ hasText: /officer|associate|head|manager|finance/i })
  }

  get logoutButton() {
    return this.page.getByRole('button', { name: /log\s?out|sign\s?out/i })
  }
}
