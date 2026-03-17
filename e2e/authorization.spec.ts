import { test, expect } from './fixtures/auth'
import { SRO_AP, SBH_AP, FINANCE_1 } from './fixtures/test-accounts'

/**
 * E2E: Authorization boundaries — ensures users cannot access
 * routes or perform actions outside their role.
 */

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

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/login')

    await page.goto('/claims')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/login')

    await page.goto('/approvals')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/login')

    await page.goto('/finance')
    await page.waitForLoadState('networkidle')
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
    await page.goto('/approvals')
    await page.waitForLoadState('networkidle')

    // SRO without approver assignments should be redirected
    expect(page.url()).toContain('/dashboard')
  })

  test('SRO cannot access /finance', async ({ page, loginAs }) => {
    await loginAs(SRO_AP.email)
    await page.goto('/finance')
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/dashboard')
  })

  test('Finance user cannot access /claims', async ({ page, loginAs }) => {
    await loginAs(FINANCE_1.email)
    await page.goto('/claims')
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/dashboard')
  })

  test('Finance user cannot access /claims/new', async ({ page, loginAs }) => {
    await loginAs(FINANCE_1.email)
    await page.goto('/claims/new')
    await page.waitForLoadState('networkidle')

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
