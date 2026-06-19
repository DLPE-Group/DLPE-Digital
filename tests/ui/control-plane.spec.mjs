import { test, expect } from '@playwright/test';

async function login(page, email = 'r.mertens@group.eu') {
  await page.goto('/');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('demo1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  // app shell is up once the header search is present
  await expect(page.getByPlaceholder(/search vehicles/i)).toBeVisible({ timeout: 15000 });
}

const navTo = (page, label) =>
  page.locator('.sideMenu').getByText(label, { exact: true }).first().click();

test('control plane: suspend and reactivate demo tenant', async ({ page }) => {
  await login(page);
  await navTo(page, 'Control plane');

  // Heading is visible
  await expect(page.getByRole('heading', { name: 'Control plane' })).toBeVisible({ timeout: 10000 });

  // Locate the demo tenant row by slug — scope all assertions to it
  const tenantRow = page.locator('div').filter({ hasText: 'dlpe-demo' }).filter({ has: page.getByRole('button') }).first();

  // Row is visible and shows the DLPE Demo tenant
  await expect(tenantRow).toBeVisible({ timeout: 10000 });
  await expect(tenantRow).toContainText('DLPE Demo');
  await expect(tenantRow).toContainText('ACTIVE');

  // Suspend the tenant
  await tenantRow.getByRole('button', { name: 'Suspend' }).click();

  // Wait for the UI to reload and show SUSPENDED in the same row
  const suspendedRow = page.locator('div').filter({ hasText: 'dlpe-demo' }).filter({ has: page.getByRole('button') }).first();
  await expect(suspendedRow).toContainText('SUSPENDED', { timeout: 10000 });

  // Reactivate — leave tenant ACTIVE so other tests/runs are not affected
  await suspendedRow.getByRole('button', { name: 'Reactivate' }).click();

  const reactivatedRow = page.locator('div').filter({ hasText: 'dlpe-demo' }).filter({ has: page.getByRole('button') }).first();
  await expect(reactivatedRow).toContainText('ACTIVE', { timeout: 10000 });
});
