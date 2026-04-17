import { test, expect } from './fixtures/auth'
import { FINANCE_1 } from './fixtures/test-accounts'
import { FinancePage } from './pages/finance.page'

test.describe('Approved History Payment Journals export', () => {
  test('Finance user can trigger Payment Journals CSV download', async ({
    page,
    loginAs,
  }) => {
    await loginAs(FINANCE_1.email)

    const finance = new FinancePage(page)
    await finance.gotoApprovedHistory()

    await expect(finance.approvedHistoryAllCsvButton).toBeVisible({
      timeout: 20_000,
    })
    await expect(finance.approvedHistoryBcExpenseButton).toBeVisible()
    await expect(finance.approvedHistoryPaymentJournalsButton).toBeVisible()

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20_000 }),
      finance.approvedHistoryPaymentJournalsButton.click(),
    ])

    expect(download.suggestedFilename()).toMatch(
      /^payment-journals-all-\d{4}-\d{2}-\d{2}\.csv$/
    )
  })
})
