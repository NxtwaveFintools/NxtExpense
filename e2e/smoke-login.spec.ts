import { test, expect } from '@playwright/test'

test.describe('Smoke - Public Login', () => {
  test('login page renders public auth entrypoint', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: /nxtexpense/i })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /continue with microsoft/i })
    ).toBeVisible()
  })
})
