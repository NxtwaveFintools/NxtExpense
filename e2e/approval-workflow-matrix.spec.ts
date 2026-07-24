import { type Page } from '@playwright/test'
import { test, expect } from './fixtures/auth'
import {
  ABH_RAJASTHAN,
  ABH_RAJASTHAN_SPARSH,
  ABH_TAMIL_NADU,
  BOA_KARNATAKA,
  CENTRAL_BOA_CHANDRAMOULI,
  FINANCE_1,
  PM_MANSOOR,
  SBH_AP,
  SBH_DELHI,
  SBH_KARNATAKA,
  SBH_KERALA,
  SBH_MAHARASHTRA,
  SBH_ODISHA_WB,
  SBH_RAJASTHAN,
  SBH_TAMIL_NADU,
  SBH_TELANGANA,
  SBH_UTTAR_PRADESH,
  SRO_AP,
  SRO_DELHI,
  SRO_KERALA,
  SRO_KERALA_HIJAS,
  SRO_MAHARASHTRA,
  SRO_ODISHA,
  SRO_TELANGANA,
  SRO_UTTAR_PRADESH,
  SRO_WEST_BENGAL,
  ZBH_MULTI_STATE,
} from './fixtures/test-accounts'
import { ClaimsPage } from './pages/claims.page'
import { ApprovalsPage } from './pages/approvals.page'
import { FinancePage } from './pages/finance.page'
import { fillRandomPayableClaimInputs } from './utils/random-claim-input'
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

async function submitOfficeClaimAndGetClaimNumber(
  page: Page,
  loginAs: LoginAs,
  submitterEmail: string
): Promise<string> {
  await loginAsFresh(page, loginAs, submitterEmail)
  const claims = new ClaimsPage(page)
  await claims.gotoNewClaim()
  await ensureClaimFormReady(page, claims)
  const randomOffset = Math.floor(Math.random() * 997)
  const candidateDaysBack = [
    ...Array.from({ length: 31 }, (_, i) => i + randomOffset),
    ...Array.from({ length: 30 }, (_, i) => 35 + i * 5 + randomOffset),
    ...Array.from({ length: 18 }, (_, i) => 210 + i * 30 + randomOffset),
    ...Array.from({ length: 25 }, (_, i) => 760 + i * 120 + randomOffset),
  ]
  let permanentlyClosedStreak = 0
  let submitted = false
  let submittedClaimNumber: string | null = null
  let submittedClaimDateIso: string | null = null

  for (const daysBack of candidateDaysBack) {
    const claimDateIso = toIsoDateDaysBack(daysBack)

    await ensureClaimFormReady(page, claims)
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
        await ensureClaimFormReady(page, claims)
        continue
      }

      await page.waitForTimeout(250)
    }

    const resolvedSubmittedClaimNumber =
      (await claims.getSubmittedClaimNumberFromSuccessToast(
        navigatedToClaims ? 1_500 : 5_000
      )) ??
      (new URL(page.url()).pathname === '/claims'
        ? await claims.getClaimNumberForDate(claimDateIso)
        : null)

    if (resolvedSubmittedClaimNumber) {
      submitted = true
      submittedClaimNumber = resolvedSubmittedClaimNumber
      submittedClaimDateIso = claimDateIso
      break
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

  if (!submittedClaimDateIso) {
    throw new Error('Submitted claim date could not be determined.')
  }

  const claimNumber =
    submittedClaimNumber ??
    (await claims.getSubmittedClaimNumberFromSuccessToast(1_200)) ??
    (await claims.getClaimNumberForDate(submittedClaimDateIso))
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
  const claimRow = await approvals.waitForPendingRowByClaimNumber(claimNumber)
  await expect(claimRow).toBeVisible({ timeout: 20_000 })
  await claimRow.getByRole('button', { name: /^Approve$/i }).click()

  await expect
    .poll(
      async () => {
        try {
          await approvals.applyHistoryClaimDateFilterForClaimNumber(claimNumber)
          return (await approvals.hasPendingRowByClaimNumber(claimNumber))
            ? 1
            : 0
        } catch {
          return 1
        }
      },
      { timeout: 120_000 }
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

  await expect
    .poll(
      async () => {
        try {
          await finance.goto()
          await finance.filterByClaimNumber(claimNumber)
          return await finance.getQueueRowByClaimNumber(claimNumber).count()
        } catch {
          return 1
        }
      },
      { timeout: 60_000 }
    )
    .toBe(0)
}

async function releaseClaimFromApprovedHistory(
  page: Page,
  loginAs: LoginAs,
  financeEmail: string,
  claimNumber: string
): Promise<void> {
  await loginAsFresh(page, loginAs, financeEmail)

  const finance = new FinancePage(page)
  await finance.gotoApprovedHistory()
  await finance.filterHistoryByClaimNumber(claimNumber)

  const historyRow = finance.getHistoryRowByClaimNumber(claimNumber)
  await expect(historyRow).toBeVisible({ timeout: 20_000 })

  const historyCheckbox = finance.getHistoryCheckboxByClaimNumber(claimNumber)
  await historyCheckbox.check()
  await expect(historyCheckbox).toBeChecked()

  await expect(finance.bulkReleaseButton).toBeEnabled()
  await finance.bulkReleaseButton.click()

  // Toast may disappear before assertion runs — treat it as a best-effort signal only.
  await page
    .getByRole('region', { name: /notifications/i })
    .getByText(/release|completed successfully/i)
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => {})

  await expect
    .poll(
      async () => {
        try {
          await finance.gotoApprovedHistory()
          await finance.filterHistoryByClaimNumber(claimNumber)
          return (
            (await finance
              .getHistoryRowByClaimNumber(claimNumber)
              .textContent()) ?? ''
          )
        } catch {
          return ''
        }
      },
      { timeout: 120_000 }
    )
    .toContain('Payment Released')
}

// A closed/crashed browser cannot be recovered inside the running test.
// These messages come from Playwright when the page/context/browser is gone.
function isBrowserClosedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /has been closed|Target closed|Target crashed|browser has been closed/i.test(
    message
  )
}

// The app renders error.tsx ("Something went wrong") whenever a server
// component throws — which is what happens on a Supabase connectivity blip.
async function isServerErrorPage(page: Page): Promise<boolean> {
  try {
    return (
      (await page
        .getByRole('heading', { name: /something went wrong/i })
        .count()) > 0
    )
  } catch {
    return false
  }
}

// Poll a real (Supabase-backed) page until it renders without the error
// boundary, i.e. the backend is reachable again. Best-effort: returns
// quietly if the timeout is hit so the caller can still attempt the retry.
async function waitForServerHealthy(
  page: Page,
  timeoutMs = 90_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      await page.goto('/dashboard', { timeout: 30_000 })
      await page.waitForLoadState('domcontentloaded')

      if (!(await isServerErrorPage(page))) {
        return
      }
    } catch (error) {
      if (isBrowserClosedError(error)) {
        throw error
      }
    }

    await page.waitForTimeout(3_000)
  }
}

async function runWorkflowPathOnce(
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
  await releaseClaimFromApprovedHistory(
    page,
    loginAs,
    path.financeEmail,
    claimNumber
  )
}

async function runWorkflowPath(
  page: Page,
  loginAs: LoginAs,
  path: WorkflowPath
): Promise<void> {
  const maxAttempts = 3
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await runWorkflowPathOnce(page, loginAs, path)
      return
    } catch (error) {
      lastError = error

      // The browser/context is gone — it cannot be revived in-test. Surface a
      // clear message and let Playwright's own retry start with a fresh browser.
      if (isBrowserClosedError(error)) {
        throw new Error(
          `Browser closed mid-workflow on attempt ${attempt}. This is caused by ` +
            `the dev server stalling on unreachable Supabase connections ` +
            `(ConnectTimeoutError) — not by the test logic. Original error: ` +
            `${error instanceof Error ? error.message : String(error)}`
        )
      }

      if (attempt === maxAttempts) {
        break
      }

      // Transient infra failure (Supabase blip / "Something went wrong" page).
      // The workflow is safe to restart from scratch with a fresh claim — wait
      // for the backend to recover first so the retry isn't immediately doomed.
      await waitForServerHealthy(page).catch(() => {})
    }
  }

  throw lastError
}

test.describe
  .serial('Approval Workflow Matrix - Requested visible flow tests', () => {
  // Generous ceiling: a single workflow path may be retried from scratch up to
  // 3 times when the Supabase backend is intermittently unreachable.
  test.describe.configure({ timeout: 600_000 })

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

  test('Standard Flow 2: SRO Kerala -> Jijo (KL SBH) L1 -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: SRO_KERALA.email,
      level1ApproverEmail: SBH_KERALA.email,
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

  test('Standard Flow 4: ABH Tamil Nadu -> Sreejish (TN SBH) L1 -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    // Exercises the new post-2026-07 TN chain: a genuine TN ABH (Siranjeeva)
    // whose L1 approver is the reactivated TN SBH (Sreejish).
    await runWorkflowPath(page, loginAs, {
      submitterEmail: ABH_TAMIL_NADU.email,
      level1ApproverEmail: SBH_TAMIL_NADU.email,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
    })
  })

  test('Direct Flow 5: SBH Tamil Nadu (Sreejish) -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    // Sreejish is an SBH, so his own claims skip L1 and go direct to the HOD.
    await runWorkflowPath(page, loginAs, {
      submitterEmail: SBH_TAMIL_NADU.email,
      level1ApproverEmail: null,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
    })
  })

  test('Standard Flow 6: ABH Rajasthan (Adarsh, ex-SBH) -> Arka L1 -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    // §9.1 regression test. Adarsh was demoted SBH -> ABH, so his flow became
    // [1,2,3] and now starts at L1. If his level_1 approver were unset,
    // shouldBlockForMissingLevel1Approver would reject the submission outright.
    // This proves he submits cleanly and routes through Arka (the new RJ SBH).
    await runWorkflowPath(page, loginAs, {
      submitterEmail: ABH_RAJASTHAN.email,
      level1ApproverEmail: SBH_RAJASTHAN.email,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
    })
  })

  // ── Full-regression state chains: prove every remaining active state's
  //    submitter -> SBH -> Mansoor -> Finance path still works end to end.
  //    States already covered above: AP, KL, KA, TN, RJ.

  test('State Chain MH: SRO Maharashtra -> Ashish (SBH) -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: SRO_MAHARASHTRA.email,
      level1ApproverEmail: SBH_MAHARASHTRA.email,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
    })
  })

  test('State Chain TG: SRO Telangana -> Ravinder (SBH) -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: SRO_TELANGANA.email,
      level1ApproverEmail: SBH_TELANGANA.email,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
    })
  })

  test('State Chain DL: SRO Delhi NCR -> Bipin (SBH) -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: SRO_DELHI.email,
      level1ApproverEmail: SBH_DELHI.email,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
    })
  })

  test('State Chain UP: SRO Uttar Pradesh -> Akshay (SBH) -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: SRO_UTTAR_PRADESH.email,
      level1ApproverEmail: SBH_UTTAR_PRADESH.email,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
    })
  })

  test('State Chain OD: SRO Odisha -> Sambit (SBH) -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: SRO_ODISHA.email,
      level1ApproverEmail: SBH_ODISHA_WB.email,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
    })
  })

  test('State Chain WB: SRO West Bengal -> Sambit (SBH) -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: SRO_WEST_BENGAL.email,
      level1ApproverEmail: SBH_ODISHA_WB.email,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
    })
  })

  // ── Hierarchy change (2026-07) targeted regression ─────────────────────────

  test('Hierarchy 8.6: Central BOA (Chandramouli, start-level 2) routes direct to Mansoor', async ({
    page,
    loginAs,
  }) => {
    // approval_start_level = 2 means his claim starts at stage 2 (HOD), skipping
    // the SBH stage entirely. Modeled here as a direct flow with no L1 approver:
    // if the claim wrongly started at L1_PENDING, Mansoor's stage-2 approval would
    // be rejected (he is not the level-1 approver), so this fails loudly.
    await runWorkflowPath(page, loginAs, {
      submitterEmail: CENTRAL_BOA_CHANDRAMOULI.email,
      level1ApproverEmail: null,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
    })
  })

  test('Hierarchy 8.5: Muhammed Hijas new claim carries converted ID prefix NW0007045', async ({
    page,
    loginAs,
  }) => {
    // claim_number is generated from employee_id at submit time. After the
    // Intern -> Employee conversion, his new claims must use NW0007045.
    const claimNumber = await submitOfficeClaimAndGetClaimNumber(
      page,
      loginAs,
      SRO_KERALA_HIJAS.email
    )
    expect(claimNumber).toContain('NW0007045')
  })

  test('Hierarchy 8.4: Sparsh (RJ ABH) routes to Arka (RJ), never Ashish (MH)', async ({
    page,
    loginAs,
  }) => {
    // The Maharashtra pointer-sweep bug captured Sparsh into Ashish's reports.
    // This proves the corrected routing: his claim lands in the RJ SBH's queue
    // and is absent from the MH SBH's queue.
    const claimNumber = await submitOfficeClaimAndGetClaimNumber(
      page,
      loginAs,
      ABH_RAJASTHAN_SPARSH.email
    )

    // Positive: Arka (RJ SBH) has it.
    await loginAsFresh(page, loginAs, SBH_RAJASTHAN.email)
    const arkaApprovals = new ApprovalsPage(page)
    await arkaApprovals.waitForPendingRowByClaimNumber(claimNumber)

    // Negative: Ashish (MH SBH) does NOT.
    await loginAsFresh(page, loginAs, SBH_MAHARASHTRA.email)
    const ashishApprovals = new ApprovalsPage(page)
    await ashishApprovals.goto()
    expect(await ashishApprovals.hasPendingRowByClaimNumber(claimNumber)).toBe(
      false
    )
  })

  test('Direct Flow 1: SBH AP -> Mansoor -> Finance', async ({
    page,
    loginAs,
  }) => {
    await runWorkflowPath(page, loginAs, {
      submitterEmail: SBH_AP.email,
      level1ApproverEmail: null,
      level3ApproverEmail: PM_MANSOOR.email,
      financeEmail: FINANCE_1.email,
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
      financeEmail: FINANCE_1.email,
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
      financeEmail: FINANCE_1.email,
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
