import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test-e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
    baseURL: 'http://127.0.0.1:4173',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node server.mjs',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    env: {
      ADMIN_TOKEN: 'test-token',
      LLM_API_KEY: 'test-key',
      HOST: '127.0.0.1',
      PORT: '4173',
    },
  },
});
