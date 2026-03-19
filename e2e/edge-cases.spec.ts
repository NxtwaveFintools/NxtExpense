import { test, expect } from './fixtures/auth'
import { SRO_AP, FINANCE_1 } from './fixtures/test-accounts'
import { ClaimsPage } from './pages/claims.page'

/**
 * E2E: Edge cases — validates the system correctly handles
 * boundary conditions and invalid inputs.
 */

test.describe('Edge Cases', () => {
  test('EDGE-004: claim form rejects future date (client-side)', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SRO_AP.email)
    await page.goto('/claims/new')
    await page.waitForLoadState('networkidle')

    const claims = new ClaimsPage(page)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const yyyy = tomorrow.getFullYear()
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const dd = String(tomorrow.getDate()).padStart(2, '0')

    await claims.dateInput.fill(`${yyyy}-${mm}-${dd}`)
    await claims.selectWorkLocationByName('Office / WFH')
    await claims.submitButton.click()

    // Browser's HTML5 constraint validation (max attribute) blocks form submit
    // — no React error text is emitted; verify via native input validity state
    const rangeOverflow = await claims.dateInput.evaluate(
      (el) => (el as HTMLInputElement).validity.rangeOverflow
    )
    expect(rangeOverflow).toBe(true)
    expect(page.url()).toContain('/claims/new')
  })

  test('EDGE-005: 2W KM limit enforced at 150 (client-side)', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SRO_AP.email)
    await page.goto('/claims/new')
    await page.waitForLoadState('networkidle')

    const claims = new ClaimsPage(page)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yyyy = yesterday.getFullYear()
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0')
    const dd = String(yesterday.getDate()).padStart(2, '0')

    await claims.dateInput.fill(`${yyyy}-${mm}-${dd}`)
    await claims.selectWorkLocationByName('Field - Outstation')
    await claims.intercityOwnVehicleYesButton.click()
    await claims.outstationStateSelect.selectOption({ index: 1 })
    await claims.vehicleTypeSelect.selectOption('Two Wheeler')
    await expect
      .poll(async () => claims.fromCityInput.locator('option').count())
      .toBeGreaterThan(1)
    await claims.fromCityInput.selectOption({ index: 1 })

    await expect
      .poll(async () => claims.toCityInput.locator('option').count())
      .toBeGreaterThan(1)
    const toCityOptionCount = await claims.toCityInput.locator('option').count()
    await claims.toCityInput.selectOption({
      index: toCityOptionCount > 2 ? 2 : 1,
    })

    let kmLimitErrorVisible = false
    for (let daysBack = 1; daysBack <= 3650; daysBack++) {
      const candidateDate = new Date()
      candidateDate.setDate(candidateDate.getDate() - daysBack)
      const yyyy = candidateDate.getFullYear()
      const mm = String(candidateDate.getMonth() + 1).padStart(2, '0')
      const dd = String(candidateDate.getDate()).padStart(2, '0')

      await claims.dateInput.fill(`${yyyy}-${mm}-${dd}`)
      await claims.kmInput.fill('151')
      await claims.submitButton.click()

      try {
        await page.waitForURL((url) => new URL(url).pathname === '/claims', {
          timeout: 3_000,
        })
      } catch {
        await expect(claims.submitButton).toBeEnabled({ timeout: 15_000 })
      }

      if (new URL(page.url()).pathname === '/claims') {
        throw new Error(
          'Claim submission unexpectedly succeeded for KM > max limit.'
        )
      }

      const duplicateDateError =
        (await page
          .getByText(/already have a pending or approved claim for this date/i)
          .count()) > 0

      if (duplicateDateError) {
        continue
      }

      await expect(page.getByText(/150|km.*limit|exceed/i).first()).toBeVisible(
        {
          timeout: 5_000,
        }
      )
      kmLimitErrorVisible = true
      break
    }

    expect(kmLimitErrorVisible).toBe(true)
    expect(page.url()).toContain('/claims/new')
  })

  test('EDGE-008: empty claims list shows empty state', async ({
    page,
    loginAs,
  }) => {
    // Finance user has no claims access, but let's test with SRO
    // who may have no claims
    await loginAs(SRO_AP.email)
    await page.goto('/claims')
    await page.waitForLoadState('networkidle')

    const claims = new ClaimsPage(page)
    // Either claims exist (rows visible) or empty state is shown
    const hasRows = (await claims.claimRows.count()) > 0
    const hasEmptyState = await claims.emptyState.isVisible().catch(() => false)

    expect(hasRows || hasEmptyState).toBe(true)
  })

  test('EDGE-016: Finance user cannot reach claim submission', async ({
    page,
    loginAs,
  }) => {
    await loginAs(FINANCE_1.email)
    await page.goto('/claims/new')
    await page.waitForLoadState('networkidle')

    // Should be redirected away
    expect(page.url()).not.toContain('/claims/new')
    expect(page.url()).toContain('/dashboard')
  })

  test('Non-existent route returns to login or 404', async ({ page }) => {
    const response = await page.goto('/nonexistent-page')
    // Either 404 or redirect to login
    const status = response?.status()
    expect(status === 404 || page.url().includes('/login')).toBe(true)
  })
})
