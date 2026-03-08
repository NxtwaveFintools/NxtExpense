import { test as base, type Page } from '@playwright/test'

import { TEST_PASSWORD } from './test-accounts'

/**
 * Authenticate as a dev email/password user and store session state.
 * The app must be running with NEXT_PUBLIC_DEV_AUTH_ENABLED or NODE_ENV=development.
 */
async function loginWithPassword(page: Page, email: string): Promise<void> {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  const emailInput = page.getByLabel('Email')
  const passwordInput = page.getByLabel('Password')

  await emailInput.fill(email)
  await passwordInput.fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
}

type AuthFixtures = {
  loginAs: (email: string) => Promise<void>
}

/**
 * Extended Playwright test that provides a `loginAs` fixture
 * for authenticating as any test account.
 */
export const test = base.extend<AuthFixtures>({
  loginAs: async ({ page }, applyFixture) => {
    const fn = async (email: string) => {
      await loginWithPassword(page, email)
    }
    await applyFixture(fn)
  },
})

export { expect } from '@playwright/test'
