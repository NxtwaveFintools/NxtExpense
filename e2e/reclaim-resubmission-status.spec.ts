import { type Page } from '@playwright/test'

import { test, expect } from './fixtures/auth'
import { PM_MANSOOR, SBH_AP, SRO_AP } from './fixtures/test-accounts'
import { ApprovalsPage } from './pages/approvals.page'
import { ClaimsPage } from './pages/claims.page'

type LoginAs = (email: string) => Promise<void>

type ClaimSubmissionResult = {
  claimNumber: string
  claimDateIso: string
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
): Promise<ClaimSubmissionResult> {
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
      expect(submittedClaimNumber).toMatch(/^CLAIM-/i)
      return { claimNumber: submittedClaimNumber, claimDateIso }
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

async function submitOfficeClaimForExactDate(
  page: Page,
  loginAs: LoginAs,
  submitterEmail: string,
  claimDateIso: string
): Promise<{ ok: boolean; claimNumber?: string }> {
  await loginAsFresh(page, loginAs, submitterEmail)

  const claims = new ClaimsPage(page)
  await claims.gotoNewClaim()
  await claims.ensureNewClaimFormReady()

  await claims.fillClaimDate(claimDateIso)
  await claims.selectWorkLocationByName('Office / WFH')
  await expect(claims.submitButton).toBeEnabled({ timeout: 60_000 })
  await claims.submitButton.click()

  const submittedClaimNumber =
    await claims.getSubmittedClaimNumberFromSuccessToast(5_000)

  if (submittedClaimNumber) {
    expect(submittedClaimNumber).toMatch(/^CLAIM-/i)
    return { ok: true, claimNumber: submittedClaimNumber }
  }

  try {
    await page.waitForURL((url: URL) => url.pathname === '/claims', {
      timeout: 7_000,
    })
    const claimNumber = await claims.getClaimNumberForDate(claimDateIso)
    expect(claimNumber).toMatch(/^CLAIM-/i)
    return { ok: true, claimNumber }
  } catch {
    await expect(claims.submitButton).toBeEnabled({ timeout: 10_000 })
    return { ok: false }
  }
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

async function rejectClaimWithReclaimAtCurrentLevel(
  page: Page,
  loginAs: LoginAs,
  approverEmail: string,
  claimNumber: string,
  notes: string
): Promise<void> {
  await loginAsFresh(page, loginAs, approverEmail)

  const approvals = new ApprovalsPage(page)
  await approvals.goto()

  const claimRow = await approvals.waitForPendingRowByClaimNumber(claimNumber)
  await expect(claimRow).toBeVisible({ timeout: 20_000 })

  await approvals.openPendingClaimByNumber(claimNumber)
  await page.getByLabel(/notes|reason|comments/i).fill(notes)
  await page
    .getByRole('button', { name: /reject\s*&\s*allow\s*reclaim/i })
    .click()

  await page.waitForURL((url: URL) => url.pathname === '/approvals', {
    timeout: 20_000,
  })

  await expect
    .poll(
      async () => approvals.getPendingRowByClaimNumber(claimNumber).count(),
      {
        timeout: 20_000,
      }
    )
    .toBe(0)
}

async function assertSupersededClaimStatusClarity(
  page: Page,
  loginAs: LoginAs,
  submitterEmail: string,
  oldClaimNumber: string
): Promise<void> {
  await loginAsFresh(page, loginAs, submitterEmail)

  const claims = new ClaimsPage(page)
  await claims.goto()

  await expect(claims.getClaimRowByNumber(oldClaimNumber)).toBeVisible({
    timeout: 20_000,
  })

  await claims.openClaimByNumber(oldClaimNumber)

  await expect(page.getByText(/new claim permitted/i).first()).toBeVisible({
    timeout: 10_000,
  })

  const currentStatusSection = page
    .locator('section')
    .filter({ hasText: /current status/i })
    .first()

  await expect(currentStatusSection).toContainText(/reclaim allowed/i)
}

test.describe.serial('Claim Reclaim Status Clarity', () => {
  test.describe.configure({ timeout: 360_000 })

  test('shows reclaim-allowed status for superseded rejected claim and blocks third same-date submit with friendly error', async ({
    page,
    loginAs,
  }) => {
    const initialClaim = await submitOfficeClaimAndGetClaimNumber(
      page,
      loginAs,
      SRO_AP.email
    )

    await approveClaimAtCurrentLevel(
      page,
      loginAs,
      SBH_AP.email,
      initialClaim.claimNumber
    )

    await rejectClaimWithReclaimAtCurrentLevel(
      page,
      loginAs,
      PM_MANSOOR.email,
      initialClaim.claimNumber,
      'Rejecting with reclaim allowed for superseded claim regression coverage'
    )

    const replacementSubmit = await submitOfficeClaimForExactDate(
      page,
      loginAs,
      SRO_AP.email,
      initialClaim.claimDateIso
    )

    expect(replacementSubmit.ok).toBe(true)
    expect(replacementSubmit.claimNumber).toBeTruthy()
    expect(replacementSubmit.claimNumber).not.toBe(initialClaim.claimNumber)

    await assertSupersededClaimStatusClarity(
      page,
      loginAs,
      SRO_AP.email,
      initialClaim.claimNumber
    )

    const duplicateSubmit = await submitOfficeClaimForExactDate(
      page,
      loginAs,
      SRO_AP.email,
      initialClaim.claimDateIso
    )

    expect(duplicateSubmit.ok).toBe(false)
    await expect(
      page.getByText(/claim already submitted for this date/i)
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByText(/unexpected error while submitting claim\./i)
    ).toHaveCount(0)
  })
})
