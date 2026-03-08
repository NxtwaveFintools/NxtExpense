import { test, expect } from './fixtures/auth'
import { SRO_AP, SBH_AP, PM_MANSOOR, FINANCE_1 } from './fixtures/test-accounts'
import { DashboardPage } from './pages/dashboard.page'
import { ClaimsPage } from './pages/claims.page'
import { ApprovalsPage } from './pages/approvals.page'
import { FinancePage } from './pages/finance.page'

/**
 * E2E: Full approval workflow (SRO → SBH L1 → Mansoor L3 → Finance issue)
 *
 * Prerequisites:
 *   - App running on localhost:3000 with dev auth enabled
 *   - Test accounts provisioned (scripts/dev/provision-test-accounts.mjs)
 *   - No conflicting claim for today's date for the SRO
 */

test.describe.serial('Approval Workflow — SRO claim through full chain', () => {
  test('SUBMIT: SRO submits base location 2W claim', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SRO_AP.email)

    const dashboard = new DashboardPage(page)
    await expect(dashboard.heading).toBeVisible()
    await expect(dashboard.newClaimLink).toBeVisible()

    // Navigate to new claim form
    await dashboard.newClaimLink.click()
    await page.waitForURL('**/claims/new')

    const claims = new ClaimsPage(page)

    // Fill a base location 2W claim for a known past date
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yyyy = yesterday.getFullYear()
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0')
    const dd = String(yesterday.getDate()).padStart(2, '0')
    const dateStr = `${yyyy}-${mm}-${dd}`

    await claims.dateInput.fill(dateStr)
    await claims.workLocationSelect.selectOption('Field - Base Location')
    await claims.vehicleTypeSelect.selectOption('Two Wheeler')
    await claims.submitButton.click()

    // Should redirect to claims list or success toast
    await page.waitForURL('**/claims**', { timeout: 10_000 })
    await expect(page.getByText(/submitted|success/i)).toBeVisible({
      timeout: 5_000,
    })
  })

  test('APPROVE-L1: SBH approves the claim at Level 1', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SBH_AP.email)

    const approvals = new ApprovalsPage(page)
    await approvals.goto()

    // Should see at least one pending claim
    await expect(approvals.pendingRows.first()).toBeVisible({ timeout: 10_000 })

    // Navigate into the claim detail page to access the Approve button
    await approvals.reviewFirstClaim.click()
    await page.waitForLoadState('networkidle')

    // Approve action fires immediately — no secondary confirmation step
    await approvals.getApproveButton().click()

    await expect(page.getByText(/approved|success/i)).toBeVisible({
      timeout: 5_000,
    })
  })

  test('APPROVE-L3: Mansoor approves the claim at Level 3', async ({
    page,
    loginAs,
  }) => {
    await loginAs(PM_MANSOOR.email)

    const approvals = new ApprovalsPage(page)
    await approvals.goto()

    await expect(approvals.pendingRows.first()).toBeVisible({ timeout: 10_000 })

    await approvals.reviewFirstClaim.click()
    await page.waitForLoadState('networkidle')

    await approvals.getApproveButton().click()

    await expect(page.getByText(/approved|success/i)).toBeVisible({
      timeout: 5_000,
    })
  })

  test('FINANCE-ISSUE: Finance team issues the claim', async ({
    page,
    loginAs,
  }) => {
    await loginAs(FINANCE_1.email)

    const finance = new FinancePage(page)
    await finance.goto()

    await expect(finance.queueRows.first()).toBeVisible({ timeout: 10_000 })
    // Issue action fires immediately inline — no secondary confirmation step
    await finance.getIssueButton().click()

    await expect(page.getByText(/issued|success/i)).toBeVisible({
      timeout: 5_000,
    })
  })
})
