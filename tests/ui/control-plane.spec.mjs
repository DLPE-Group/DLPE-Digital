import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';

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

// Clean up any cap-* blueprints before and after the capture journey so reruns are deterministic.
async function deleteCapBlueprints() {
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
  try {
    await prisma.blueprint.deleteMany({ where: { key: { startsWith: 'cap-' } } });
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeAll(deleteCapBlueprints);
test.afterAll(deleteCapBlueprints);

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

  // Plan column: demo tenant must show enterprise plan key
  await expect(tenantRow).toContainText('enterprise', { timeout: 10000 });

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

test('control plane: capture blueprint from demo tenant', async ({ page }) => {
  await login(page);
  await navTo(page, 'Control plane');

  // Heading is visible
  await expect(page.getByRole('heading', { name: 'Control plane' })).toBeVisible({ timeout: 10000 });

  // Scope to the Capture section to avoid selector collisions with the blueprint list labels
  const captureSection = page.locator('section').filter({ hasText: 'Capture blueprint from tenant' });
  await expect(captureSection).toBeVisible({ timeout: 10000 });

  // Select the demo tenant from the Source tenant dropdown — use label text (partial match via value)
  // The option text is "DLPE Demo (dlpe-demo)"; select by the visible label string
  const selectEl = captureSection.locator('select');
  await selectEl.selectOption({ label: 'DLPE Demo (dlpe-demo)' });

  // Fill Blueprint key and Blueprint name (scoped to the Capture card)
  await captureSection.getByPlaceholder('e.g. my-template').fill('cap-ui');
  await captureSection.getByPlaceholder('e.g. My Template').fill('Cap UI Test');

  // Click Capture
  await captureSection.getByRole('button', { name: 'Capture' }).click();

  // The blueprint list should now contain a row with the key cap-ui
  const blueprintList = page.locator('section').filter({ hasText: 'Blueprints' }).first();
  await expect(blueprintList.locator('code').filter({ hasText: 'cap-ui' })).toBeVisible({ timeout: 10000 });
});
