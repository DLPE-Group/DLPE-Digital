import { test, expect } from '@playwright/test';

// Entitlement gating (Phase 3) proven against TWO real tenants:
//  - the fleet demo (dlpe-demo) HAS vehicle + fleet_operator types → fleet views show
//  - the non-fleet fixture (testco-nonfleet) has neither → fleet views hidden,
//    while its own 'Projects' track still renders (Phase 1 dynamic tracks).
async function login(page, email) {
  await page.goto('/');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('demo1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByPlaceholder(/search vehicles/i)).toBeVisible({ timeout: 15000 });
}

test('fleet tenant shows Vehicles / Timelines / Portal and its four tracks', async ({ page }) => {
  await login(page, 'r.mertens@group.eu');
  const menu = page.locator('.sideMenu');
  await expect(menu.getByText('Vehicles', { exact: true })).toBeVisible();
  await expect(menu.getByText('Vehicle timelines', { exact: true })).toBeVisible();
  await expect(menu.getByText('Customer portal', { exact: true })).toBeVisible();
  for (const t of ['Sales', 'Operations', 'Workshop', 'Finance']) {
    await expect(menu.getByText(t, { exact: true })).toBeVisible();
  }
});

test('non-fleet tenant hides fleet views but shows its own track', async ({ page }) => {
  await login(page, 'admin@testco.test');
  const menu = page.locator('.sideMenu');
  // its data-model-driven track renders …
  await expect(menu.getByText('Projects', { exact: true })).toBeVisible();
  // … but no fleet-specific surfaces, and none of the demo's tracks
  await expect(menu.getByText('Vehicles', { exact: true })).toHaveCount(0);
  await expect(menu.getByText('Vehicle timelines', { exact: true })).toHaveCount(0);
  await expect(menu.getByText('Customer portal', { exact: true })).toHaveCount(0);
  await expect(menu.getByText('Sales', { exact: true })).toHaveCount(0);
});
