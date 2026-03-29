import { type Page } from '@playwright/test'

import { test, expect } from './fixtures/auth'
import { SRO_AP, SBH_AP, FINANCE_1 } from './fixtures/test-accounts'

/**
 * E2E: Authorization boundaries — ensures users cannot access
 * routes or perform actions outside their role.
 */

async function navigateAndExpectUrl(
  page: Page,
  pathname: string,
  expectedUrl: RegExp,
  timeoutMs = 20_000
): Promise<void> {
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await page.goto(pathname)

    try {
      await page.waitForURL(expectedUrl, { timeout: timeoutMs })
      return
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error
      }

      await page.waitForTimeout(500)
    }
  }
}

test.describe('Authorization Boundaries', () => {
  test('unauthenticated user is redirected to /login from protected routes', async ({
    page,
  }) => {
    await page.context().clearCookies()
    await page.goto('/login')
    await page.evaluate(() => {
      window.localStorage.clear()
      window.sessionStorage.clear()
    })
    await page.context().clearCookies()

    await navigateAndExpectUrl(page, '/dashboard', /\/login/)
    expect(page.url()).toContain('/login')

    await navigateAndExpectUrl(page, '/claims', /\/login/)
    expect(page.url()).toContain('/login')

    await navigateAndExpectUrl(page, '/approvals', /\/login/)
    expect(page.url()).toContain('/login')

    await navigateAndExpectUrl(page, '/finance', /\/login/)
    expect(page.url()).toContain('/login')
  })

  test('authenticated user on /login is redirected to /dashboard', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SRO_AP.email)

    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/dashboard')
  })

  test('SRO cannot access /approvals (no approver assignments)', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SRO_AP.email)
    await navigateAndExpectUrl(page, '/approvals', /\/dashboard/)

    // SRO without approver assignments should be redirected
    expect(page.url()).toContain('/dashboard')
  })

  test('SRO cannot access /finance', async ({ page, loginAs }) => {
    await loginAs(SRO_AP.email)
    await navigateAndExpectUrl(page, '/finance', /\/dashboard/)

    expect(page.url()).toContain('/dashboard')
  })

  test('Finance user cannot access /claims', async ({ page, loginAs }) => {
    await loginAs(FINANCE_1.email)
    await navigateAndExpectUrl(page, '/claims', /\/dashboard/)

    expect(page.url()).toContain('/dashboard')
  })

  test('Finance user cannot access /claims/new', async ({ page, loginAs }) => {
    await loginAs(FINANCE_1.email)
    await navigateAndExpectUrl(page, '/claims/new', /\/dashboard/)

    expect(page.url()).toContain('/dashboard')
  })

  test('SBH can access /approvals (has approver assignments)', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SBH_AP.email)
    await page.goto('/approvals')
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/approvals')
  })

  test('Finance user can access /finance', async ({ page, loginAs }) => {
    await loginAs(FINANCE_1.email)
    await page.goto('/finance')
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/finance')
  })
})
