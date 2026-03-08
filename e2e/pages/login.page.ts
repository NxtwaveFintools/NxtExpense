import type { Page } from '@playwright/test'

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login')
    await this.page.waitForLoadState('networkidle')
  }

  get emailInput() {
    return this.page.getByLabel('Email')
  }

  get passwordInput() {
    return this.page.getByLabel('Password')
  }

  get signInButton() {
    return this.page.getByRole('button', { name: /sign in/i })
  }

  get microsoftButton() {
    return this.page.getByRole('button', { name: /microsoft/i })
  }

  get errorMessage() {
    return this.page.locator('[role="alert"]')
  }
}
