import type { Page } from '@playwright/test'

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard')
    await this.page.waitForLoadState('networkidle')
  }

  get heading() {
    return this.page.getByRole('heading', { name: /dashboard/i })
  }

  get newClaimLink() {
    return this.page.getByRole('link', { name: /new claim/i })
  }

  get myClaimsLink() {
    return this.page.getByRole('link', { name: /my claims/i })
  }

  get approvalsLink() {
    return this.page.getByRole('link', { name: /pending approvals/i })
  }

  get financeLink() {
    return this.page.getByRole('link', { name: /finance queue/i })
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
