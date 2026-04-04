import { type Page } from '@playwright/test'

import { test, expect } from './fixtures/auth'
import { PM_MANSOOR, SBH_AP, SRO_AP } from './fixtures/test-accounts'
import { ApprovalsPage } from './pages/approvals.page'
import { ClaimsPage } from './pages/claims.page'

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

  for (const daysBack of candidateDaysBack) {
    const claimDateIso = toIsoDateDaysBack(daysBack)

    await claims.ensureNewClaimFormReady()
    await claims.fillClaimDate(claimDateIso)
    await claims.selectWorkLocationByName('Office / WFH')
    await expect(claims.submitButton).toBeEnabled({ timeout: 60_000 })
    await claims.submitButton.click()

    const submittedClaimNumber =
      (await claims.getSubmittedClaimNumberFromSuccessToast(6_000)) ??
      (new URL(page.url()).pathname === '/claims'
        ? await claims.getClaimNumberForDate(claimDateIso)
        : null)

    if (submittedClaimNumber) {
      expect(submittedClaimNumber).toMatch(/^CLAIM-/i)
      return submittedClaimNumber
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

    if (duplicateDateError || duplicateConstraintError) {
      continue
    }

    await claims.gotoNewClaim()
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
      { timeout: 60_000 }
    )
    .toBe(0)
}

async function expectClaimVisibleInApprovalHistory(
  page: Page,
  loginAs: LoginAs,
  approverEmail: string,
  claimNumber: string
): Promise<void> {
  await loginAsFresh(page, loginAs, approverEmail)

  const approvals = new ApprovalsPage(page)
  await approvals.goto()
  await approvals.applyHistoryClaimDateFilterForClaimNumber(claimNumber)

  await expect
    .poll(async () => approvals.hasHistoryRowByClaimNumber(claimNumber), {
      timeout: 60_000,
    })
    .toBe(true)
}

async function expectClaimHiddenInApprovalHistory(
  page: Page,
  loginAs: LoginAs,
  approverEmail: string,
  claimNumber: string
): Promise<void> {
  await loginAsFresh(page, loginAs, approverEmail)

  const approvals = new ApprovalsPage(page)
  await approvals.goto()
  await approvals.applyHistoryClaimDateFilterForClaimNumber(claimNumber)

  await expect
    .poll(async () => approvals.hasHistoryRowByClaimNumber(claimNumber), {
      timeout: 30_000,
    })
    .toBe(false)
}

test.describe.serial('Approval History visibility', () => {
  test.describe.configure({ timeout: 420_000 })

  test('SBH/PM see acted claims but not their own submitted claims', async ({
    page,
    loginAs,
  }) => {
    const routedClaimNumber = await submitOfficeClaimAndGetClaimNumber(
      page,
      loginAs,
      SRO_AP.email
    )

    await approveClaimAtCurrentLevel(
      page,
      loginAs,
      SBH_AP.email,
      routedClaimNumber
    )
    await approveClaimAtCurrentLevel(
      page,
      loginAs,
      PM_MANSOOR.email,
      routedClaimNumber
    )

    const sbhOwnClaimNumber = await submitOfficeClaimAndGetClaimNumber(
      page,
      loginAs,
      SBH_AP.email
    )
    const pmOwnClaimNumber = await submitOfficeClaimAndGetClaimNumber(
      page,
      loginAs,
      PM_MANSOOR.email
    )

    await expectClaimVisibleInApprovalHistory(
      page,
      loginAs,
      SBH_AP.email,
      routedClaimNumber
    )
    await expectClaimHiddenInApprovalHistory(
      page,
      loginAs,
      SBH_AP.email,
      sbhOwnClaimNumber
    )

    await expectClaimVisibleInApprovalHistory(
      page,
      loginAs,
      PM_MANSOOR.email,
      routedClaimNumber
    )
    await expectClaimHiddenInApprovalHistory(
      page,
      loginAs,
      PM_MANSOOR.email,
      pmOwnClaimNumber
    )
  })
})
