import { type Page } from '@playwright/test'

import { test, expect } from './fixtures/auth'
import {
  PM_MANSOOR,
  SBH_AP,
  SBH_TN_KERALA,
  SRO_AP,
  SRO_KERALA,
} from './fixtures/test-accounts'
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

function normalizeLocationLabelForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s*\/\s*/g, '/')
    .replace(/[^a-z0-9/]/g, '')
}

function isOfficeWfhLocationLabel(value: string): boolean {
  const normalized = normalizeLocationLabelForMatch(value)

  return normalized === 'office/wfh'
    ? true
    : normalized.includes('office') && normalized.includes('wfh')
}

async function ensureClaimFormReady(
  page: Page,
  claims: ClaimsPage
): Promise<void> {
  if (new URL(page.url()).pathname !== '/claims/new') {
    await claims.gotoNewClaim()
  }

  await expect(page).toHaveURL(/\/claims\/new(?:\?.*)?$/, {
    timeout: 20_000,
  })
  await expect(claims.dateInput).toBeVisible({ timeout: 20_000 })
  await expect(claims.workLocationSelect).toBeVisible({ timeout: 20_000 })
}

async function selectOfficeWorkLocation(
  page: Page,
  claims: ClaimsPage
): Promise<void> {
  const maxAttempts = 3

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await ensureClaimFormReady(page, claims)

    const options = await claims.getWorkLocationOptions()
    const officeOption = options.find((option) =>
      isOfficeWfhLocationLabel(option.label)
    )

    if (officeOption) {
      await claims.selectWorkLocationByValue(officeOption.value)
      return
    }

    await page.waitForTimeout(250)
  }

  const options = await claims.getWorkLocationOptions()
  throw new Error(
    `Unable to find Office/WFH work location. Available options: ${options
      .map((option) => option.label)
      .join(', ')}`
  )
}

async function submitOfficeClaimAndGetClaimNumber(
  page: Page,
  loginAs: LoginAs,
  submitterEmail: string
): Promise<string> {
  await loginAsFresh(page, loginAs, submitterEmail)

  const claims = new ClaimsPage(page)
  await claims.gotoNewClaim()
  await ensureClaimFormReady(page, claims)

  const randomOffset = Math.floor(Math.random() * 120)
  const candidateDaysBack = Array.from(
    { length: 120 },
    (_, i) => 1 + ((i + randomOffset) % 120)
  )

  for (const daysBack of candidateDaysBack) {
    await ensureClaimFormReady(page, claims)

    const claimDateIso = toIsoDateDaysBack(daysBack)
    await claims.fillClaimDate(claimDateIso)
    await selectOfficeWorkLocation(page, claims)
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
        await ensureClaimFormReady(page, claims)
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
      await ensureClaimFormReady(page, claims)
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

async function rejectClaimAtCurrentLevel(
  page: Page,
  loginAs: LoginAs,
  approverEmail: string,
  claimNumber: string,
  allowResubmit: boolean,
  notes: string
): Promise<void> {
  await loginAsFresh(page, loginAs, approverEmail)

  const approvals = new ApprovalsPage(page)
  await approvals.goto()

  const claimRow = await approvals.waitForPendingRowByClaimNumber(claimNumber)
  await expect(claimRow).toBeVisible({ timeout: 20_000 })

  await approvals.openPendingClaimByNumber(claimNumber)

  await page.getByLabel(/notes|reason|comments/i).fill(notes)

  if (allowResubmit) {
    await page
      .getByRole('button', { name: /reject\s*&\s*allow\s*reclaim/i })
      .click()
  } else {
    await page.getByRole('button', { name: /^Reject$/i }).click()
  }

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
    await expect(
      page.getByText(
        /this claim is permanently closed\. no new claim can be raised for this date\./i
      )
    ).toHaveCount(0)
  } else {
    await expect(page.getByText(/permanently closed/i).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(
      page.getByText(
        /this claim is permanently closed\. no new claim can be raised for this date\./i
      )
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByText(
        /the approver has allowed you to raise a new claim for this date\./i
      )
    ).toHaveCount(0)
  }
}

test.describe
  .serial('Approval Rejection Flows - Requested E2E coverage', () => {
  test.describe.configure({ timeout: 300_000 })

  test('Rejection Flow 1: L1 reject marks claim permanently closed', async ({
    page,
    loginAs,
  }) => {
    const claimNumber = await submitOfficeClaimAndGetClaimNumber(
      page,
      loginAs,
      SRO_KERALA.email
    )

    await rejectClaimAtCurrentLevel(
      page,
      loginAs,
      SBH_TN_KERALA.email,
      claimNumber,
      false,
      'L1 rejection for E2E validation'
    )

    await assertClaimTerminalBanner(
      page,
      loginAs,
      SRO_KERALA.email,
      claimNumber,
      'permanently-closed'
    )
  })

  test('Rejection Flow 2: L3 reject with allow reclaim enables new claim', async ({
    page,
    loginAs,
  }) => {
    const claimNumber = await submitOfficeClaimAndGetClaimNumber(
      page,
      loginAs,
      SRO_AP.email
    )

    await approveClaimAtCurrentLevel(page, loginAs, SBH_AP.email, claimNumber)

    await rejectClaimAtCurrentLevel(
      page,
      loginAs,
      PM_MANSOOR.email,
      claimNumber,
      true,
      'L3 rejection with reclaim for E2E validation'
    )

    await assertClaimTerminalBanner(
      page,
      loginAs,
      SRO_AP.email,
      claimNumber,
      'new-claim-permitted'
    )
  })
})
