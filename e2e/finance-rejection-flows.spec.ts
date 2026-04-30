import { type Page } from '@playwright/test'

import { test, expect } from './fixtures/auth'
import {
  BOA_KARNATAKA,
  FINANCE_1,
  PM_MANSOOR,
  SBH_KARNATAKA,
  SBH_TN_KERALA,
} from './fixtures/test-accounts'
import { ApprovalsPage } from './pages/approvals.page'
import { ClaimsPage } from './pages/claims.page'
import { FinancePage } from './pages/finance.page'
import { fillRandomPayableClaimInputs } from './utils/random-claim-input'

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

  const randomOffset = Math.floor(Math.random() * 997)

  const candidateDaysBack = [
    ...Array.from({ length: 31 }, (_, i) => i + randomOffset),
    ...Array.from({ length: 30 }, (_, i) => 35 + i * 5 + randomOffset),
    ...Array.from({ length: 18 }, (_, i) => 210 + i * 30 + randomOffset),
    ...Array.from({ length: 25 }, (_, i) => 760 + i * 120 + randomOffset),
  ]

  for (const daysBack of candidateDaysBack) {
    const claimDateIso = toIsoDateDaysBack(daysBack)

    await claims.ensureNewClaimFormReady()
    await fillRandomPayableClaimInputs(page, claims, claimDateIso)
    await expect(claims.submitButton).toBeEnabled({ timeout: 60_000 })
    await claims.submitButton.click()

    let navigatedToClaims = false

    try {
      await page.waitForURL((url: URL) => url.pathname === '/claims', {
        timeout: 5_000,
      })
      navigatedToClaims = true
    } catch {
      let submitButtonEnabled = false

      for (let retry = 0; retry < 24; retry += 1) {
        try {
          submitButtonEnabled = await claims.submitButton.isEnabled()
          if (submitButtonEnabled) {
            break
          }
        } catch {
          submitButtonEnabled = false
        }

        await page.waitForTimeout(500)
      }

      if (!submitButtonEnabled) {
        await claims.gotoNewClaim()
        await claims.ensureNewClaimFormReady()
        continue
      }

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

async function rejectClaimInFinanceQueue(
  page: Page,
  loginAs: LoginAs,
  financeEmail: string,
  claimNumber: string,
  allowResubmit: boolean,
  notes: string
): Promise<void> {
  await loginAsFresh(page, loginAs, financeEmail)

  const finance = new FinancePage(page)
  await finance.goto()
  await finance.filterByClaimNumber(claimNumber)

  const queueRow = finance.getQueueRowByClaimNumber(claimNumber)
  await expect(queueRow).toBeVisible({ timeout: 20_000 })

  await finance.openQueueClaimByNumber(claimNumber)

  await page.getByLabel(/notes|reason|comments/i).fill(notes)

  if (allowResubmit) {
    await page
      .getByRole('button', { name: /reject\s*&\s*allow\s*reclaim/i })
      .click()
  } else {
    await page.getByRole('button', { name: /^Reject$/i }).click()
  }

  await expect
    .poll(() => new URL(page.url()).pathname, {
      timeout: 20_000,
    })
    .toMatch(/^\/(finance|login)$/)

  if (new URL(page.url()).pathname === '/login') {
    await loginAs(financeEmail)
    await finance.goto()
  }

  await finance.filterByClaimNumber(claimNumber)
  await expect
    .poll(async () => finance.getQueueRowByClaimNumber(claimNumber).count(), {
      timeout: 20_000,
    })
    .toBe(0)
}

async function assertClaimTerminalBanner(
  page: Page,
  loginAs: LoginAs,
  submitterEmail: string,
  claimNumber: string,
  expectedBanner: 'new-claim-permitted' | 'permanently-closed'
): Promise<void> {
  await loginAsFresh(page, loginAs, submitterEmail)

  const claims = new ClaimsPage(page)
  await claims.goto()

  await expect(claims.getClaimRowByNumber(claimNumber)).toBeVisible({
    timeout: 20_000,
  })

  await claims.openClaimByNumber(claimNumber)

  if (expectedBanner === 'new-claim-permitted') {
    await expect(page.getByText(/new claim permitted/i).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(
      page.getByText(
        /the approver has allowed you to raise a new claim for this date\./i
      )
    ).toBeVisible({ timeout: 10_000 })
  } else {
    await expect(page.getByText(/permanently closed/i).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(
      page.getByText(
        /this claim is permanently closed\. no new claim can be raised for this date\./i
      )
    ).toBeVisible({ timeout: 10_000 })
  }
}

test.describe.serial('Finance Rejection Flows - Requested E2E coverage', () => {
  test.describe.configure({ timeout: 360_000 })

  test('Finance Rejection 1: Finance reject marks claim permanently closed', async ({
    page,
    loginAs,
  }) => {
    const claimNumber = await submitOfficeClaimAndGetClaimNumber(
      page,
      loginAs,
      BOA_KARNATAKA.email
    )

    await approveClaimAtCurrentLevel(
      page,
      loginAs,
      SBH_KARNATAKA.email,
      claimNumber
    )
    await approveClaimAtCurrentLevel(
      page,
      loginAs,
      PM_MANSOOR.email,
      claimNumber
    )

    await rejectClaimInFinanceQueue(
      page,
      loginAs,
      FINANCE_1.email,
      claimNumber,
      false,
      'Finance rejection without reclaim for E2E validation'
    )

    await assertClaimTerminalBanner(
      page,
      loginAs,
      BOA_KARNATAKA.email,
      claimNumber,
      'permanently-closed'
    )
  })

  test('Finance Rejection 2: Finance reject with allow reclaim enables new SBH claim', async ({
    page,
    loginAs,
  }) => {
    const claimNumber = await submitOfficeClaimAndGetClaimNumber(
      page,
      loginAs,
      SBH_TN_KERALA.email
    )

    await approveClaimAtCurrentLevel(
      page,
      loginAs,
      PM_MANSOOR.email,
      claimNumber
    )

    await rejectClaimInFinanceQueue(
      page,
      loginAs,
      FINANCE_1.email,
      claimNumber,
      true,
      'Finance rejection with reclaim for E2E validation'
    )

    await assertClaimTerminalBanner(
      page,
      loginAs,
      SBH_TN_KERALA.email,
      claimNumber,
      'new-claim-permitted'
    )
  })
})
