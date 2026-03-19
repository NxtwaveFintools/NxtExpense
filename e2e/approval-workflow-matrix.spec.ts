import { type Page } from '@playwright/test'
import { test, expect } from './fixtures/auth'
import {
  ABH_TAMIL_NADU,
  BOA_KARNATAKA,
  FINANCE_1,
  FINANCE_2,
  PM_MANSOOR,
  SBH_AP,
  SBH_KARNATAKA,
  SBH_TN_KERALA,
  SRO_AP,
  SRO_KERALA,
  ZBH_MULTI_STATE,
} from './fixtures/test-accounts'
import { ClaimsPage } from './pages/claims.page'
import { ApprovalsPage } from './pages/approvals.page'
import { FinancePage } from './pages/finance.page'
type LoginAs = (email: string) => Promise<void>
type WorkflowPath = {
  submitterEmail: string
  level1ApproverEmail: string | null
  level3ApproverEmail: string | null
  financeEmail: string
}

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
  const randomOffset = Math.floor(Math.random() * 997)
  const candidateDaysBack = [
    ...Array.from({ length: 31 }, (_, i) => i + randomOffset),
    ...Array.from({ length: 30 }, (_, i) => 35 + i * 5 + randomOffset),
    ...Array.from({ length: 18 }, (_, i) => 210 + i * 30 + randomOffset),
    ...Array.from({ length: 25 }, (_, i) => 760 + i * 120 + randomOffset),
  ]
  let permanentlyClosedStreak = 0
  let submitted = false

  for (const daysBack of candidateDaysBack) {
    await claims.dateInput.fill(toIsoDateDaysBack(daysBack))
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

    if (navigatedToClaims || new URL(page.url()).pathname === '/claims') {
      submitted = true
      break
    }

    const currentPath = new URL(page.url()).pathname
    if (currentPath !== '/claims/new') {
      await claims.gotoNewClaim()
    }

    const duplicateDateError =
      (await page.getByText(/already have .*claim for this date/i).count()) > 0
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

  if (!submitted) {
    throw new Error(
      'Could not submit a fresh claim using fallback date search.'
    )
  }

  const claimNumber = await claims.getLatestClaimNumber()
  expect(claimNumber).toMatch(/^CLAIM-/i)
  return claimNumber
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
  const claimRow = approvals.getPendingRowByClaimNumber(claimNumber)
  await expect(claimRow).toBeVisible({ timeout: 20_000 })
  await approvals.getApproveButtonForClaimNumber(claimNumber).click()
  await expect(
    page
      .getByRole('region', { name: /notifications/i })
      .getByText(/approve applied\.|approval action submitted successfully\./i)
  ).toBeVisible({ timeout: 10_000 })

  await expect
    .poll(
      async () => approvals.getPendingRowByClaimNumber(claimNumber).count(),
      {
        timeout: 20_000,
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
    page.getByRole('region', { name: /notifications/i }).getByText(/issue/i)
  ).toBeVisible({ timeout: 10_000 })

  await expect
    .poll(async () => finance.getQueueRowByClaimNumber(claimNumber).count(), {
      timeout: 20_000,
    })
    .toBe(0)
}

async function runWorkflowPath(
  page: Page,
  loginAs: LoginAs,
  path: WorkflowPath
): Promise<void> {
  const claimNumber = await submitOfficeClaimAndGetClaimNumber(
    page,
    loginAs,
    path.submitterEmail
  )
  if (path.level1ApproverEmail) {
    await approveClaimAtCurrentLevel(
      page,
      loginAs,
      path.level1ApproverEmail,
      claimNumber
    )
  }

  if (path.level3ApproverEmail) {
    await approveClaimAtCurrentLevel(
      page,
      loginAs,
      path.level3ApproverEmail,
      claimNumber
    )
  }
  await issueClaimInFinanceQueue(page, loginAs, path.financeEmail, claimNumber)
}

test.describe
  .serial('Approval Workflow Matrix - Requested visible flow tests', () => {
  test.describe.configure({ timeout: 300_000 })

  test('Standard Flow 1: SRO AP -> SBH AP -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: SRO_AP.email,
      level1ApproverEmail: SBH_AP.email,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
    })
  })

  test('Standard Flow 2: SRO Kerala -> SBH TN/Kerala -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: SRO_KERALA.email,
      level1ApproverEmail: SBH_TN_KERALA.email,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
    })
  })

  test('Standard Flow 3: BOA Karnataka -> SBH Karnataka -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: BOA_KARNATAKA.email,
      level1ApproverEmail: SBH_KARNATAKA.email,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
    })
  })

  test('Standard Flow 4: ABH Tamil Nadu -> SBH TN/Kerala -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: ABH_TAMIL_NADU.email,
      level1ApproverEmail: SBH_TN_KERALA.email,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
    })
  })

  test('Direct Flow 1: SBH AP -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: SBH_AP.email,
      level1ApproverEmail: null,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_2.email,
    })
  })

  test('Direct Flow 2: SBH Karnataka -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: SBH_KARNATAKA.email,
      level1ApproverEmail: null,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_2.email,
    })
  })

  test('Direct Flow 3: ZBH Multi-State -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: ZBH_MULTI_STATE.email,
      level1ApproverEmail: null,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_2.email,
    })
  })

  test('Direct Flow 4: PM Mansoor -> Finance', async ({ page, loginAs }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: PM_MANSOOR.email,
      level1ApproverEmail: null,
      level3ApproverEmail: null,
      financeEmail: FINANCE_1.email,
    })
  })
})
