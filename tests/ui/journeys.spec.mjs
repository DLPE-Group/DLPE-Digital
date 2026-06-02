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

test('login lands in the console shell', async ({ page }) => {
  await login(page);
  await expect(page.locator('.sideMenu')).toContainText('Overview');
});

test('notifications bell opens a real dropdown', async ({ page }) => {
  await login(page);
  await page.getByTitle('Notifications').click();
  await expect(page.getByText('Notifications', { exact: true })).toBeVisible();
});

test('global search returns Brussels', async ({ page }) => {
  await login(page);
  await page.getByPlaceholder(/search vehicles/i).fill('brussels');
  await expect(page.locator('.searchResult').first()).toContainText(/brussels/i, { timeout: 10000 });
});

test('integrations view shows Test buttons (list from API)', async ({ page }) => {
  await login(page);
  await navTo(page, 'Integrations');
  await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Test/ }).first()).toBeVisible();
});

test('settings shows the Simulated/No-delivery badges', async ({ page }) => {
  await login(page);
  await navTo(page, 'Settings');
  await expect(page.getByText('Enforce stage locks')).toBeVisible();
  await expect(page.locator('.simBadge').first()).toBeVisible();
});

test('customer portal loads with the message + report actions', async ({ page }) => {
  await login(page);
  await navTo(page, 'Customer portal');
  await expect(page.getByRole('button', { name: /message account team/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /fleet report/i })).toBeVisible();
});

test('audit view loads with a Revert action', async ({ page }) => {
  await login(page);
  await navTo(page, 'Audit log');
  await expect(page.getByRole('heading', { name: /audit log/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /revert/i }).first()).toBeVisible();
});

test('data model view lists tracks and entity types from the API', async ({ page }) => {
  await login(page);
  await navTo(page, 'Data model');
  await expect(page.getByRole('heading', { name: 'Data model' })).toBeVisible();
  await expect(page.getByText('Tracks (pipelines)')).toBeVisible();
  // built-in type labels prove the data came from the API (exact avoids the
  // "Contract drafted" stage chip / the subtitle text)
  await expect(page.getByText('Contract', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Vehicle', { exact: true }).first()).toBeVisible();
  // no-code authoring controls are present
  await expect(page.getByRole('button', { name: /new entity type/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /add field/i }).first()).toBeVisible();
});
