import { test, expect } from './fixtures/auth'

const ADMIN_E2E_EMAIL =
  process.env.E2E_ADMIN_EMAIL ?? process.env.ADMIN_E2E_EMAIL ?? ''

test.describe('Admin state and city management', () => {
  test.skip(
    !ADMIN_E2E_EMAIL,
    'Set E2E_ADMIN_EMAIL (or ADMIN_E2E_EMAIL) to run admin state/city e2e tests.'
  )

  test('supports create/toggle state, city creation, and bulk import with confirmation dialogs', async ({
    page,
    loginAs,
  }) => {
    await loginAs(ADMIN_E2E_EMAIL)
    await page.goto('/admin/state-city')

    await expect(page.getByText('State & City Configuration')).toBeVisible()

    const uniqueSuffix = Date.now().toString().slice(-6)
    const stateName = `E2E State ${uniqueSuffix}`

    await page.getByTestId('admin-state-name-input').fill(stateName)

    const createStateDialogPromise = page.waitForEvent('dialog')
    await page.getByTestId('admin-add-state-button').click()
    const createStateDialog = await createStateDialogPromise
    expect(createStateDialog.message()).toContain('Create state')
    await createStateDialog.accept()

    const stateRow = page.locator('tr', { hasText: stateName }).first()
    await expect(stateRow).toBeVisible({ timeout: 15_000 })

    const deactivateStateDialogPromise = page.waitForEvent('dialog')
    await stateRow.getByRole('button', { name: 'Deactivate' }).click()
    const deactivateStateDialog = await deactivateStateDialogPromise
    expect(deactivateStateDialog.message()).toContain('Deactivate state')
    await deactivateStateDialog.accept()
    await expect(stateRow.getByText('Inactive')).toBeVisible({
      timeout: 15_000,
    })

    const cityName = `E2E City ${uniqueSuffix}`
    await page.getByTestId('admin-city-name-input').fill(cityName)

    const createCityDialogPromise = page.waitForEvent('dialog')
    await page.getByTestId('admin-add-city-button').click()
    const createCityDialog = await createCityDialogPromise
    expect(createCityDialog.message()).toContain('Create city')
    await createCityDialog.accept()

    await expect(page.locator('tr', { hasText: cityName }).first()).toBeVisible(
      {
        timeout: 15_000,
      }
    )

    const bulkCityA = `E2E Bulk A ${uniqueSuffix}`
    const bulkCityB = `E2E Bulk B ${uniqueSuffix}`

    await page
      .getByTestId('admin-bulk-city-input')
      .fill(`${bulkCityA}, ${bulkCityA}\n${bulkCityB}\n1234`)

    const bulkImportDialogPromise = page.waitForEvent('dialog')
    await page.getByTestId('admin-bulk-city-import-button').click()
    const bulkImportDialog = await bulkImportDialogPromise
    expect(bulkImportDialog.message()).toContain('Import cities')
    await bulkImportDialog.accept()

    const summary = page.getByTestId('admin-bulk-city-summary')
    await expect(summary).toBeVisible({ timeout: 15_000 })
    await expect(summary).toContainText('inserted')
    await expect(summary).toContainText('duplicates')
    await expect(summary).toContainText('invalid')
    await expect(summary).toContainText(bulkCityA)
    await expect(summary).toContainText(bulkCityB)
  })
})
