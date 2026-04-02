import { test, expect } from './fixtures/auth'
import { SRO_AP, SBH_AP, PM_MANSOOR, FINANCE_1 } from './fixtures/test-accounts'
import { DashboardPage } from './pages/dashboard.page'
import { ClaimsPage } from './pages/claims.page'

/**
 * E2E: Designation-based business rules enforced in the UI.
 *
 * Validates that:
 * - SRO only sees Two Wheeler option (no Four Wheeler)
 * - SBH sees both Two Wheeler and Four Wheeler
 * - Dashboard shows correct links per role
 * - Finance users cannot access claims/new
 */

test.describe('Designation Rules — UI enforcement', () => {
  test('SRO sees only Two Wheeler option on claim form', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SRO_AP.email)
    await page.goto('/claims/new')
    await page.waitForLoadState('networkidle')

    const claims = new ClaimsPage(page)
    await claims.selectWorkLocationByName('Field - Base Location')

    // Two Wheeler should be available
    const vehicleOptions = claims.vehicleTypeSelect.locator('option')
    const optionTexts = await vehicleOptions.allTextContents()

    expect(optionTexts.some((t) => t.includes('Two Wheeler'))).toBe(true)
    expect(optionTexts.some((t) => t.includes('Four Wheeler'))).toBe(false)
  })

  test('SBH sees Two Wheeler and Four Wheeler on claim form', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SBH_AP.email)
    await page.goto('/claims/new')
    await page.waitForLoadState('networkidle')

    const claims = new ClaimsPage(page)
    await claims.selectWorkLocationByName('Field - Base Location')

    const vehicleOptions = claims.vehicleTypeSelect.locator('option')
    const optionTexts = await vehicleOptions.allTextContents()

    expect(optionTexts.some((t) => t.includes('Two Wheeler'))).toBe(true)
    expect(optionTexts.some((t) => t.includes('Four Wheeler'))).toBe(true)
  })

  test('SRO dashboard shows My Claims but not Finance Queue', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SRO_AP.email)

    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    await expect(dashboard.myClaimsLink).toBeVisible()
    await expect(dashboard.financeLink).not.toBeVisible()
  })

  test('SBH dashboard shows My Claims and Pending Approvals', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SBH_AP.email)

    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    await expect(dashboard.myClaimsLink).toBeVisible()
    await expect(dashboard.approvalsLink).toBeVisible()
  })

  test('PM dashboard shows My Claims, Approvals, but not Finance', async ({
    page,
    loginAs,
  }) => {
    await loginAs(PM_MANSOOR.email)

    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    await expect(dashboard.myClaimsLink).toBeVisible()
    await expect(dashboard.approvalsLink).toBeVisible()
    await expect(dashboard.financeLink).not.toBeVisible()
  })

  test('Finance user dashboard shows Finance and Approved History but not My Claims', async ({
    page,
    loginAs,
  }) => {
    await loginAs(FINANCE_1.email)

    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    await expect(dashboard.financeLink).toBeVisible()
    await expect(dashboard.approvedHistoryLink).toBeVisible()
    await expect(dashboard.myClaimsLink).not.toBeVisible()
  })

  test('Finance user is redirected away from /claims', async ({
    page,
    loginAs,
  }) => {
    await loginAs(FINANCE_1.email)
    await page.goto('/claims')
    await page.waitForLoadState('networkidle')

    // Finance users should be redirected to /dashboard
    expect(page.url()).toContain('/dashboard')
  })

  test('SRO is redirected away from /finance', async ({ page, loginAs }) => {
    await loginAs(SRO_AP.email)
    await page.goto('/finance')
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/dashboard')
  })
})
