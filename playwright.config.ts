import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
    },
  },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  updateSnapshots: process.env.UPDATE_SNAPSHOTS ? 'all' : 'none',
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    {
      name: 'public-chromium',
      testMatch: /public-page\.spec\.ts/,
      use: {
        baseURL: 'http://127.0.0.1:4173',
        browserName: 'chromium',
      },
    },
    {
      name: 'kiosk-visual',
      testMatch: /kiosk-visual\.spec\.ts/,
      use: {
        baseURL: 'http://127.0.0.1:4174',
        browserName: 'chromium',
      },
    },
    {
      name: 'kiosk-electron',
      testMatch: /kiosk-electron\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @grace-booth/public dev --mode test',
      url: 'http://127.0.0.1:4173/photo',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @grace-booth/kiosk dev:renderer',
      url: 'http://127.0.0.1:4174/?visual=attract',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  use: {
    actionTimeout: 10_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
