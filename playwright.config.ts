import { defineConfig, devices } from '@playwright/test'

const normalizedExternalBaseUrl = process.env.E2E_BASE_URL?.trim() ?? ''
const runAgainstExternalBaseUrl = normalizedExternalBaseUrl.length > 0
const localSlowMoRaw = Number(process.env.PW_SLOW_MO ?? '120')
const localSlowMo = Number.isFinite(localSlowMoRaw) ? localSlowMoRaw : 120

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 3 : (process.env.PW_WORKERS ?? '50%'),
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL: runAgainstExternalBaseUrl
      ? normalizedExternalBaseUrl
      : 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: process.env.CI ? true : false,
    launchOptions: process.env.CI ? undefined : { slowMo: localSlowMo },
  },
  webServer: runAgainstExternalBaseUrl
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
