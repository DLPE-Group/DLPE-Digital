import { test, expect } from '@playwright/test';

// Reports (Phase 2 + Phase 4): the Dashboard tab shows generic, track-driven
// metrics (no hardcoded fleet catalogue), and a report generates from live data.
async function login(page, email = 'r.mertens@group.eu') {
  await page.goto('/');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('demo1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByPlaceholder(/search vehicles/i)).toBeVisible({ timeout: 15000 });
}

const navTo = (page, label) =>
  page.locator('.sideMenu').getByText(label, { exact: true }).first().click();

test('reports dashboard renders generic, track-driven metrics', async ({ page }) => {
  await login(page);
  await navTo(page, 'Reports');
  // Generic metric tiles from the rewritten dashboardSnapshot.
  await expect(page.getByText('Open items', { exact: true }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Open items by track').first()).toBeVisible();
});

test('generates a report from a template', async ({ page }) => {
  await login(page);
  await navTo(page, 'Reports');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByText('Weekly fleet summary').click();
  // The generated report document opens with an executive summary.
  await expect(page.getByText('Executive summary')).toBeVisible({ timeout: 20000 });
});
