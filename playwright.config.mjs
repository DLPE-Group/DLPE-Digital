import { defineConfig, devices } from '@playwright/test';

const PORT = 4100;
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/ui',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: BASE,
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node tests/serve-test.mjs',
    url: `${BASE}/api/health`,
    timeout: 120000,
    reuseExistingServer: false,
  },
});
