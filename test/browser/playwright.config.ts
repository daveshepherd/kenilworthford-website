import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests of the site build, run by the build after the unit tests.
 * They need the site built first (npx projen site:build).
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.browser.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  outputDir: '../../test-reports/browser',
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
});
