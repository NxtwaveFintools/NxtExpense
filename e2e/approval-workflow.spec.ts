import { test, expect } from './fixtures/auth'
import { SRO_AP, SBH_AP, PM_MANSOOR, FINANCE_1 } from './fixtures/test-accounts'
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

test.describe
  .skip('Approval Workflow — SRO claim through full chain (legacy)', () => {
  test('SUBMIT: SRO submits base location 2W claim', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SRO_AP.email)

    await page.goto('/claims/new')
    await page.waitForLoadState('networkidle')

    const claims = new ClaimsPage(page)

    const randomOffset = Math.floor(Math.random() * 997)
    const candidateDaysBack = [
      ...Array.from({ length: 31 }, (_, i) => i + randomOffset),
      ...Array.from({ length: 30 }, (_, i) => 35 + i * 5 + randomOffset),
      ...Array.from({ length: 18 }, (_, i) => 210 + i * 30 + randomOffset),
      ...Array.from({ length: 25 }, (_, i) => 760 + i * 120 + randomOffset),
    ]
    let submitted = false

    for (const daysBack of candidateDaysBack) {
      const candidateDate = new Date()
      candidateDate.setDate(candidateDate.getDate() - daysBack)
      const yyyy = candidateDate.getFullYear()
      const mm = String(candidateDate.getMonth() + 1).padStart(2, '0')
      const dd = String(candidateDate.getDate()).padStart(2, '0')
      const dateStr = `${yyyy}-${mm}-${dd}`

      await claims.dateInput.fill(dateStr)
      await claims.workLocationSelect.selectOption('Field - Base Location')
      await claims.vehicleTypeSelect.selectOption('Two Wheeler')
      await claims.submitButton.click()

      let navigatedToClaims = false
      try {
        await page.waitForURL((url) => new URL(url).pathname === '/claims', {
          timeout: 1_200,
        })
        navigatedToClaims = true
      } catch {
        await page.waitForTimeout(250)
      }

      if (navigatedToClaims || new URL(page.url()).pathname === '/claims') {
        submitted = true
        break
      }

      const currentPath = new URL(page.url()).pathname
      if (currentPath !== '/claims/new') {
        await claims.gotoNewClaim()
      }

      const duplicateDateError =
        (await page.getByText(/already have .*claim for this date/i).count()) >
        0
      const duplicateConstraintError =
        (await page
          .getByText(/duplicate key value violates unique constraint/i)
          .count()) > 0
      const permanentlyClosedError =
        (await page.getByText(/permanently closed/i).count()) > 0

      if (
        duplicateDateError ||
        duplicateConstraintError ||
        permanentlyClosedError
      ) {
        continue
      }

      if (currentPath === '/claims/new') {
        continue
      }

      throw new Error('Claim submission did not complete as expected.')
    }

    expect(submitted).toBe(true)
  })

  test('APPROVE-L1: SBH approves the claim at Level 1', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SBH_AP.email)

    const approvals = new ApprovalsPage(page)
    await approvals.goto()

    const approveButtons = approvals.getApproveButton()
    const approveCount = await approveButtons.count()
    test.skip(
      approveCount === 0,
      'No actionable SBH approvals in current fixture state.'
    )
    const pendingCountBefore = await approvals.pendingRows.count()

    await approveButtons.first().click()

    await expect(
      page
        .getByRole('region', { name: /notifications/i })
        .getByText(
          /approve applied\.|approval action submitted successfully\./i
        )
    ).toBeVisible({
      timeout: 5_000,
    })

    await expect
      .poll(async () => approvals.pendingRows.count(), { timeout: 10_000 })
      .toBeLessThan(pendingCountBefore)
  })

  test('APPROVE-L3: Mansoor approves the claim at Level 3', async ({
    page,
    loginAs,
  }) => {
    await loginAs(PM_MANSOOR.email)

    const approvals = new ApprovalsPage(page)
    await approvals.goto()

    const approveButtons = approvals.getApproveButton()
    const approveCount = await approveButtons.count()
    test.skip(
      approveCount === 0,
      'No actionable L3 approvals in current fixture state.'
    )
    const pendingCountBefore = await approvals.pendingRows.count()

    await approveButtons.first().click()

    await expect(
      page
        .getByRole('region', { name: /notifications/i })
        .getByText(
          /approve applied\.|approval action submitted successfully\./i
        )
    ).toBeVisible({
      timeout: 5_000,
    })

    await expect
      .poll(async () => approvals.pendingRows.count(), { timeout: 10_000 })
      .toBeLessThan(pendingCountBefore)
  })

  test('FINANCE-ISSUE: Finance team issues the claim', async ({
    page,
    loginAs,
  }) => {
    await loginAs(FINANCE_1.email)

    const finance = new FinancePage(page)
    await finance.goto()

    await expect(finance.queueRows.first()).toBeVisible({ timeout: 10_000 })
    const queueCountBefore = await finance.queueRows.count()
    // Issue action fires immediately inline — no secondary confirmation step
    await finance.getIssueButton().click()

    await expect
      .poll(async () => finance.queueRows.count(), { timeout: 10_000 })
      .toBeLessThan(queueCountBefore)
  })
})
