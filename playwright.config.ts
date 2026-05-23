import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts$/,

  fullyParallel: true,
  workers: process.env.CI ? 1 : 4,

  retries: process.env.CI ? 2 : 1,
  timeout: 30 * 1000,
  expect: { timeout: 10 * 1000 },

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
    process.env.CI ? ['github'] : [],
  ].filter(Boolean) as unknown as PlaywrightTestConfig['reporter'],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    reducedMotion: 'reduce',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  snapshotPathTemplate:
    '{snapshotDir}/{testFileDir}/{testFileName}-{platform}{ext}',
  snapshotDir: 'e2e/__snapshots__',
});
