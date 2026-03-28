import { type Page } from '@playwright/test'

import { test, expect } from './fixtures/auth'
import { FINANCE_1, PM_MANSOOR, SBH_AP, SRO_AP } from './fixtures/test-accounts'
import { ApprovalsPage } from './pages/approvals.page'
import { ClaimsPage } from './pages/claims.page'
import { FinancePage } from './pages/finance.page'

type LoginAs = (email: string) => Promise<void>

async function clearSession(page: Page): Promise<void> {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.evaluate(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
  await page.context().clearCookies()
}

async function loginAsFresh(
  page: Page,
  loginAs: LoginAs,
  email: string
): Promise<void> {
  await clearSession(page)
  await loginAs(email)
}

function toIsoDateDaysBack(daysBack: number): string {
  const candidateDate = new Date()
  candidateDate.setDate(candidateDate.getDate() - daysBack)
  const yyyy = candidateDate.getFullYear()
  const mm = String(candidateDate.getMonth() + 1).padStart(2, '0')
  const dd = String(candidateDate.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

async function submitOfficeClaimAndGetClaimNumber(
  page: Page,
  loginAs: LoginAs,
  submitterEmail: string
): Promise<string> {
  await loginAsFresh(page, loginAs, submitterEmail)

  const claims = new ClaimsPage(page)
  await claims.gotoNewClaim()
  await claims.ensureNewClaimFormReady()

  const randomOffset = Math.floor(Math.random() * 120)
  const candidateDaysBack = Array.from(
    { length: 120 },
    (_, i) => 1 + ((i + randomOffset) % 120)
  )

  let permanentlyClosedStreak = 0
  let submittedClaimDateIso: string | null = null

  for (const daysBack of candidateDaysBack) {
    const claimDateIso = toIsoDateDaysBack(daysBack)

    await claims.ensureNewClaimFormReady()
    await claims.fillClaimDate(claimDateIso)
    await claims.selectWorkLocationByName('Office / WFH')
    await expect(claims.submitButton).toBeEnabled({ timeout: 60_000 })
    await claims.submitButton.click()

    let navigatedToClaims = false

    try {
      await page.waitForURL((url: URL) => url.pathname === '/claims', {
        timeout: 5_000,
      })
      navigatedToClaims = true
    } catch {
      await expect(claims.submitButton).toBeEnabled({ timeout: 60_000 })
      await page.waitForTimeout(250)
    }

    const submittedClaimNumber =
      (await claims.getSubmittedClaimNumberFromSuccessToast(
        navigatedToClaims ? 1_500 : 5_000
      )) ??
      (new URL(page.url()).pathname === '/claims'
        ? await claims.getClaimNumberForDate(claimDateIso)
        : null)

    if (submittedClaimNumber) {
      submittedClaimDateIso = claimDateIso
      expect(submittedClaimNumber).toMatch(/^CLAIM-/i)
      return submittedClaimNumber
    }

    const currentPath = new URL(page.url()).pathname
    if (currentPath !== '/claims/new') {
      await claims.ensureNewClaimFormReady()
    }

    const duplicateDateError =
      (await page
        .getByText(
          /already have .*claim for this date|claim already submitted for this date/i
        )
        .count()) > 0
    const duplicateConstraintError =
      (await page
        .getByText(/duplicate key value violates unique constraint/i)
        .count()) > 0
    const permanentlyClosedError =
      (await page.getByText(/permanently closed/i).count()) > 0

    if (duplicateDateError || duplicateConstraintError) {
      permanentlyClosedStreak = 0
      continue
    }

    if (permanentlyClosedError) {
      permanentlyClosedStreak += 1
      if (permanentlyClosedStreak >= 30) {
        break
      }
      continue
    }

    if (currentPath === '/claims/new') {
      permanentlyClosedStreak = 0
      continue
    }

    throw new Error('Claim submission did not complete as expected.')
  }

  throw new Error('Could not submit a fresh claim using fallback date search.')
}

async function approveClaimAtCurrentLevel(
  page: Page,
  loginAs: LoginAs,
  approverEmail: string,
  claimNumber: string
): Promise<void> {
  await loginAsFresh(page, loginAs, approverEmail)

  const approvals = new ApprovalsPage(page)
  await approvals.goto()

  const claimRow = await approvals.waitForPendingRowByClaimNumber(claimNumber)
  await expect(claimRow).toBeVisible({ timeout: 20_000 })

  await claimRow.getByRole('button', { name: /^Approve$/i }).click()

  await expect
    .poll(
      async () => {
        await approvals.goto()
        return (await approvals.hasPendingRowByClaimNumber(claimNumber)) ? 1 : 0
      },
      {
        timeout: 60_000,
      }
    )
    .toBe(0)
}

async function issueClaimInFinanceQueue(
  page: Page,
  loginAs: LoginAs,
  financeEmail: string,
  claimNumber: string
): Promise<void> {
  await loginAsFresh(page, loginAs, financeEmail)

  const finance = new FinancePage(page)
  await finance.goto()
  await finance.filterByClaimNumber(claimNumber)

  const claimRow = finance.getQueueRowByClaimNumber(claimNumber)
  await expect(claimRow).toBeVisible({ timeout: 20_000 })

  const claimCheckbox = finance.getQueueCheckboxByClaimNumber(claimNumber)
  await claimCheckbox.check()
  await expect(claimCheckbox).toBeChecked()

  await expect(finance.bulkIssueButton).toBeEnabled()
  await finance.bulkIssueButton.click()

  await expect(
    page
      .getByRole('region', { name: /notifications/i })
      .getByText(/approve|issue|completed successfully/i)
  ).toBeVisible({ timeout: 10_000 })

  await expect
    .poll(async () => finance.getQueueRowByClaimNumber(claimNumber).count(), {
      timeout: 20_000,
    })
    .toBe(0)
}

test.describe.serial('Approval Workflow — SRO claim through full chain', () => {
  test.describe.configure({ timeout: 300_000 })

  test('SRO -> SBH -> Mansoor -> Finance issue', async ({ page, loginAs }) => {
    const claimNumber = await submitOfficeClaimAndGetClaimNumber(
      page,
      loginAs,
      SRO_AP.email
    )

    await approveClaimAtCurrentLevel(page, loginAs, SBH_AP.email, claimNumber)
    await approveClaimAtCurrentLevel(
      page,
      loginAs,
      PM_MANSOOR.email,
      claimNumber
    )
    await issueClaimInFinanceQueue(page, loginAs, FINANCE_1.email, claimNumber)
  })
})
