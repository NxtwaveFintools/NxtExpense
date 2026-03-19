import { defineConfig, devices } from '@playwright/test'

const normalizedExternalBaseUrl = process.env.E2E_BASE_URL?.trim() ?? ''
const runAgainstExternalBaseUrl = normalizedExternalBaseUrl.length > 0
const localSlowMoRaw = Number(process.env.PW_SLOW_MO ?? '120')
const localSlowMo = Number.isFinite(localSlowMoRaw) ? localSlowMoRaw : 120
const workersRaw = process.env.PW_WORKERS?.trim() ?? ''
const resolvedWorkers = (() => {
  if (!workersRaw) {
    return 1
  }

  if (workersRaw.endsWith('%')) {
    return workersRaw
  }

  const parsedWorkers = Number.parseInt(workersRaw, 10)
  return Number.isFinite(parsedWorkers) && parsedWorkers > 0 ? parsedWorkers : 1
})()

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: resolvedWorkers,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL: runAgainstExternalBaseUrl
      ? normalizedExternalBaseUrl
      : 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: process.env.PW_HEADED === '1' ? false : true,
    launchOptions:
      process.env.PW_HEADED === '1' ? { slowMo: localSlowMo } : undefined,
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
