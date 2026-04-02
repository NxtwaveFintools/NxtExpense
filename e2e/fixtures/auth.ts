import { test as base, type Page } from '@playwright/test'

import { TEST_PASSWORD } from './test-accounts'

const LOGIN_MAX_ATTEMPTS = 2
const LOGIN_RETRY_DELAY_MS = 600
const LOGIN_REDIRECT_TIMEOUT_MS = 20_000

async function clearClientSession(page: Page): Promise<void> {
  try {
    await page.context().clearCookies()
  } catch {
    // Ignore context disposal races while tests are timing out.
  }

  try {
    await page.evaluate(() => {
      window.localStorage.clear()
      window.sessionStorage.clear()
    })
  } catch {
    // Ignore navigation/context races during login retries.
  }
}

async function getLoginErrorText(page: Page): Promise<string> {
  const alertTexts = await page.locator('[role="alert"]').allTextContents()
  const toastTexts = await page.locator('[data-sonner-toast]').allTextContents()

  return [...alertTexts, ...toastTexts].join(' ').trim()
}

/**
 * Authenticate as a dev email/password user and store session state.
 * The app must be running with NEXT_PUBLIC_DEV_AUTH_ENABLED or NODE_ENV=development.
 */
async function loginWithPassword(page: Page, email: string): Promise<void> {
  for (let attempt = 1; attempt <= LOGIN_MAX_ATTEMPTS; attempt += 1) {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.getByLabel('Email')
    const passwordInput = page.getByLabel('Password')

    await emailInput.fill(email)
    await passwordInput.fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    try {
      await page.waitForURL('**/dashboard', {
        timeout: LOGIN_REDIRECT_TIMEOUT_MS,
      })
      return
    } catch {
      if (attempt === LOGIN_MAX_ATTEMPTS) {
        const loginErrorText = await getLoginErrorText(page)
        const suffix = loginErrorText ? ` | UI error: ${loginErrorText}` : ''

        throw new Error(
          `Login failed for ${email} after ${LOGIN_MAX_ATTEMPTS} attempts${suffix}`
        )
      }

      await clearClientSession(page)
      await page.waitForTimeout(LOGIN_RETRY_DELAY_MS * attempt)
    }
  }
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
